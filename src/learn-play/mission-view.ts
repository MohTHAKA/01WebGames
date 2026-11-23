import type * as BlocklyTypes from 'blockly';

import { createWorkspace, helpEntries, saveState } from './blocks.ts';
import type { Lang } from './curriculum.ts';
import { el } from './dom.ts';
import { dynamicKey, mt } from './mission-i18n.ts';
import type { MissionStringKey } from './mission-i18n.ts';
import { getMission, missionText, nextMissionHref } from './missions.ts';
import type { ProgressStore } from './progress.ts';
import { createArenaScene } from './scene.ts';
import type { ArenaScene } from './scene.ts';
import { createSfx } from './sfx.ts';
import { FIXED_DT } from './sim/calibration.ts';
import { evaluateMission } from './sim/evaluate.ts';
import { BLOCKS, START_BLOCK, compileWorkspace } from './sim/program.ts';
import { Simulation, distanceAheadCm } from './sim/simulation.ts';
import type { Command, RobotPose } from './sim/types.ts';

export interface MissionContext {
    lang: Lang;
    taskId: number;
    store: ProgressStore;
}

export const isPlayable = (taskId: number): boolean => getMission(taskId) !== undefined;

/**
 * Mounts a mission (arena + Blockly + controls) into `host`. Returns a disposer that releases the
 * WebGL context, Blockly workspace, observers and the fallback frame loop.
 */
export const mountMission = async (host: HTMLElement, ctx: MissionContext): Promise<() => void> => {
    const { lang, taskId, store } = ctx;
    const mission = getMission(taskId);
    const text = missionText[taskId];
    if (!mission || !text) throw new Error(`No mission for task ${taskId}`);
    const L = (k: MissionStringKey): string => mt(lang, k);

    // ---- DOM ----
    // Static, hard-coded SVG paths (24x24 viewBox); never built from user input.
    const ICONS = {
        run: '<path d="M7 4.5v15l12-7.5z"/>',
        pause: '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>',
        step: '<path d="M5 4.5v15l9-7.5zM16 4h3v16h-3z"/>',
        stop: '<path d="M6 6h12v12H6z"/>',
        reset: '<path d="M12 5V2L7 6.5 12 11V8a5 5 0 1 1-5 5H5a7 7 0 1 0 7-8z"/>',
        hint: '<path d="M9 21h6v-1H9zm3-19a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>',
        soundOn:
            '<path d="M3 9v6h4l5 4V5L7 9zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/>',
        soundOff:
            '<path d="M3 9v6h4l5 4V5L7 9zm13.6 3 2.4-2.4-1.4-1.4-2.4 2.4-2.4-2.4-1.4 1.4 2.4 2.4-2.4 2.4 1.4 1.4 2.4-2.4 2.4 2.4 1.4-1.4z"/>'
    } as const;
    const icon = (name: keyof typeof ICONS): SVGElement => {
        const doc = new DOMParser().parseFromString(
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`,
            'image/svg+xml'
        );
        return document.importNode(doc.documentElement, true) as unknown as SVGElement;
    };
    const setBtn = (btn: HTMLButtonElement, name: keyof typeof ICONS, label: string): void => {
        btn.replaceChildren(icon(name));
        btn.setAttribute('aria-label', label);
        btn.title = label;
    };
    const mkBtn = (key: MissionStringKey, name: keyof typeof ICONS, extra = ''): HTMLButtonElement => {
        const b = el('button', { type: 'button', class: `lp-btn lp-ctl lp-ctl-icon ${extra}`.trim() });
        setBtn(b, name, L(key));
        return b;
    };
    const runBtn = mkBtn('run', 'run');
    const pauseBtn = mkBtn('pause', 'pause', 'lp-btn-alt');
    const stepBtn = mkBtn('step', 'step', 'lp-btn-alt');
    const stopBtn = mkBtn('stop', 'stop', 'lp-btn-alt');
    const resetBtn = mkBtn('reset', 'reset', 'lp-btn-alt');
    const hintBtn = mkBtn('hint', 'hint', 'lp-btn-alt');
    // Hints unlock 5 seconds after the mission opens
    hintBtn.disabled = true;
    const hintTimer = window.setTimeout(() => {
        hintBtn.disabled = false;
    }, 5000);
    const sfx = createSfx();
    const soundBtn = mkBtn(
        sfx.isMuted() ? 'soundOff' : 'soundOn',
        sfx.isMuted() ? 'soundOff' : 'soundOn',
        'lp-btn-alt'
    );
    soundBtn.setAttribute('aria-pressed', String(!sfx.isMuted()));

    const speedSel = el('select', { id: 'lp-speed', class: 'lp-select' });
    for (const s of [1, 2, 4]) speedSel.append(el('option', { value: String(s) }, `${s}x`));
    const speedLabel = el('label', { for: 'lp-speed', class: 'lp-muted' }, L('speed'));

    const canvas = el('canvas', { class: 'lp-canvas', 'aria-label': L('arena'), role: 'img' });
    const arena = el('div', { class: 'lp-arena' }, canvas);
    const feedback = el('div', { class: 'lp-feedback', role: 'status', 'aria-live': 'polite' }, L('readyMsg'));
    const trialsEl = el('p', { class: 'lp-muted' });
    const timeEl = el('span', { class: 'lp-muted' });
    const blocksHost = el('div', { class: 'lp-blocks', 'aria-label': L('blocksArea') });

    const help = el(
        'details',
        { class: 'lp-help' },
        el('summary', {}, L('helpTitle')),
        ...helpEntries(mission.allowedBlockTypes).map((b) =>
            el('p', {}, el('strong', {}, `${L(b.label)}: `), L(b.help))
        )
    );
    const left = el(
        'div',
        { class: 'lp-mission-left' },
        arena,
        el('div', { class: 'lp-controls' }, runBtn, pauseBtn, stepBtn, stopBtn, resetBtn, hintBtn, soundBtn),
        el('div', { class: 'lp-controls' }, speedLabel, speedSel, timeEl),
        feedback,
        trialsEl
    );
    host.replaceChildren(
        el(
            'div',
            { class: 'lp-instructions' },
            el('p', {}, el('strong', {}, `${L('instructions')}: `), text.instructions[lang]),
            el('p', { class: 'lp-muted' }, L('successNote')),
            help
        ),
        el('div', { class: 'lp-mission-grid' }, left, blocksHost)
    );

    // ---- Blockly ----
    const workspace: BlocklyTypes.WorkspaceSvg = await createWorkspace(
        blocksHost,
        lang,
        mission.allowedBlockTypes,
        store.load(taskId).workspace
    );
    const Blockly = await import('blockly');
    workspace.addChangeListener((e) => {
        if (e.isUiEvent) return;
        const p = store.load(taskId);
        store.save(taskId, { ...p, workspace: saveState(workspace) });
    });

    // ---- PlayCanvas ----
    let scene: ArenaScene | null = null;
    try {
        scene = await createArenaScene(canvas, mission);
    } catch {
        arena.replaceChildren(el('p', { class: 'lp-muted lp-pad' }, L('webglError')));
    }

    // ---- state ----
    let sim: Simulation | null = null;
    let program: Command[] = [];
    let paused = false;
    let acc = 0;
    let hintIdx = 0;
    let displayPose: RobotPose = { ...mission.startPose };
    let lastHighlight: string | null = null;
    let disposed = false;

    const say = (msg: string, tone: 'info' | 'ok' | 'bad' = 'info'): void => {
        feedback.className = `lp-feedback lp-${tone}`;
        feedback.replaceChildren(msg);
    };

    const highlight = (id: string | null): void => {
        if (id === lastHighlight) return;
        lastHighlight = id;
        workspace.highlightBlock(id);
    };

    const trialCond = mission.successConditions.find((c) => c.type === 'subTrials');
    const trialLabel = (key: string): string =>
        L(
            (trialCond?.type === 'subTrials' && trialCond.kind === 'unit'
                ? `unit_${key}`
                : `band_${key}`) as MissionStringKey
        );
    const showTrials = (): void => {
        if (trialCond?.type !== 'subTrials') return;
        const done = store.load(taskId).trialUnits;
        trialsEl.textContent = `${L('trialsDone')}: ${done.map(trialLabel).join(', ') || '-'} (${done.length}/${trialCond.keys.length})`;
    };
    showTrials();
    const refreshButtons = (): void => {
        const running = sim?.status === 'running';
        pauseBtn.disabled = !running;
        stopBtn.disabled = !running;
        if (paused) setBtn(pauseBtn, 'run', L('resume'));
        else setBtn(pauseBtn, 'pause', L('pause'));
        runBtn.disabled = running === true && !paused;
    };

    let usedBlocks: string[] = [];
    const compile = (): Command[] | null => {
        const result = compileWorkspace(saveState(workspace), mission.allowedBlockTypes);
        if (!result.ok) {
            say(L(dynamicKey('compile', result.error.code)), 'bad');
            if ('blockId' in result.error) workspace.getBlockById(result.error.blockId)?.select();
            return null;
        }
        usedBlocks = result.usedBlocks;
        return result.program;
    };

    // ---- sound and effects: derived from changes in the simulation, never fed back into it ----
    const MAX_SPEED_MPS = 0.704;
    const DUST_EVERY_M = 0.15;
    let fxPose: RobotPose = { ...mission.startPose };
    let fxArm = mission.startArm;
    let fxCarrying: string | null = null;
    let fxVisited = 0;
    let fxCommand = -1;
    let fxTravel = 0;
    const resetFxTracking = (s: Simulation): void => {
        fxPose = { ...s.pose };
        fxArm = s.armAngle;
        fxCarrying = s.carrying;
        fxVisited = s.visited.size;
        fxCommand = s.commandIndex;
        fxTravel = 0;
    };
    const silence = (): void => {
        sfx.setMotor(0);
        sfx.setServo(0);
    };
    /** Called once per rendered frame while a run exists; `moving` is false when paused. */
    const fxFrame = (s: Simulation, dt: number, moving: boolean): void => {
        if (!moving || dt <= 0) {
            silence();
            // Stepping: a quiet tick each time the next command begins.
            if (s.status === 'running' && s.commandIndex !== fxCommand) sfx.play('tick');
        } else {
            const moved = Math.hypot(s.pose.x - fxPose.x, s.pose.y - fxPose.y);
            const turned = Math.abs(s.pose.headingRadians - fxPose.headingRadians);
            const mult = Number(speedSel.value) || 1;
            const level =
                moved > 1e-5
                    ? Math.min(1, Math.max(0.2, moved / (dt * mult) / MAX_SPEED_MPS))
                    : turned > 1e-4
                      ? 0.4
                      : 0;
            sfx.setMotor(level);
            sfx.setServo(Math.abs(s.armAngle - fxArm) > 0.01 ? 0.6 : 0);
            fxTravel += moved;
            while (fxTravel >= DUST_EVERY_M) {
                fxTravel -= DUST_EVERY_M;
                const back = 0.12;
                scene?.burst(
                    'dust',
                    s.pose.x - Math.sin(s.pose.headingRadians) * back,
                    s.pose.y - Math.cos(s.pose.headingRadians) * back
                );
            }
        }
        fxPose = { ...s.pose };
        fxArm = s.armAngle;
        fxCommand = s.commandIndex;
        if (s.carrying !== fxCarrying) {
            const id = s.carrying ?? fxCarrying;
            const at = id ? s.cargoPos.get(id) : undefined;
            if (s.carrying) {
                sfx.play('grab');
                if (at) scene?.burst('spark', at.x, at.y);
            } else {
                sfx.play('release');
                if (at) scene?.burst('drop', at.x, at.y);
            }
            fxCarrying = s.carrying;
        }
        if (s.visited.size > fxVisited) {
            fxVisited = s.visited.size;
            const zone = mission.zones.find((z) => z.id === s.visitedOrder[s.visitedOrder.length - 1]);
            sfx.play('zone');
            if (zone) scene?.burst('ring', zone.x, zone.y);
        }
    };
    const fxFinish = (s: Simulation): void => {
        silence();
        if (s.outcome?.ok) {
            sfx.play('success');
            scene?.burst('confetti', s.pose.x, s.pose.y);
        } else if (s.outcome?.reason === 'collision') {
            sfx.play('bump');
            scene?.burst('hit', s.pose.x, s.pose.y);
            scene?.flashRobot();
            scene?.shake();
        } else {
            sfx.play('fail');
        }
    };

    const startRun = (stepMode: boolean): boolean => {
        const compiled = compile();
        if (!compiled) return false;
        program = compiled;
        const doneKeys = new Set(store.load(taskId).trialUnits);
        sim = new Simulation(mission, program, (s) => evaluateMission(s, { doneKeys, usedBlocks }));
        // Keep the on-screen pose: Play must not snap the robot back to the start.
        // Cargo missions always restart from the beginning so the crates and the robot stay in step.
        sim.start(mission.cargo ? undefined : displayPose);
        paused = stepMode;
        acc = 0;
        resetFxTracking(sim);
        sfx.play('start');
        scene?.burst('ring', sim.pose.x, sim.pose.y);
        feedback.className = 'lp-feedback';
        say(stepMode ? L('pausedMsg') : L('runningMsg'));
        return true;
    };

    const finishRun = (finished: Simulation): void => {
        const outcome = finished.outcome;
        highlight(null);
        if (!outcome) return;
        if (outcome.ok) {
            const p = store.load(taskId);
            const trialUnits =
                outcome.trialKey && !p.trialUnits.includes(outcome.trialKey)
                    ? [...p.trialUnits, outcome.trialKey]
                    : p.trialUnits;
            store.save(taskId, {
                ...p,
                trialUnits,
                completed: p.completed || outcome.missionComplete !== false
            });
            showTrials();
            const next = outcome.missionComplete !== false ? nextMissionHref(taskId) : null;
            feedback.className = 'lp-feedback lp-ok';
            feedback.replaceChildren(
                el('strong', {}, outcome.missionComplete === false ? L('resultTrial') : L('resultSuccess'))
            );
            if (next) feedback.append(' ', el('a', { class: 'lp-btn lp-btn-small', href: next }, L('nextMission')));
        } else {
            const reason = outcome.reason ?? 'invalidProgram';
            feedback.className = 'lp-feedback lp-bad';
            const retry = el('button', { type: 'button', class: 'lp-btn lp-btn-small' }, L('retry'));
            retry.addEventListener('click', () => reset(false));
            feedback.replaceChildren(
                el('strong', {}, `${L('resultFail')} `),
                L(dynamicKey('reason', reason)),
                ' ',
                retry
            );
        }
    };

    const reset = (announce = true): void => {
        sim = null;
        paused = false;
        acc = 0;
        silence();
        displayPose = { ...mission.startPose };
        highlight(null);
        if (announce) say(L('resetMsg'));
        refreshButtons();
    };

    // ---- controls ----
    runBtn.addEventListener('click', () => {
        if (sim?.status === 'running' && paused) paused = false;
        else if (!startRun(false)) return;
        refreshButtons();
    });
    pauseBtn.addEventListener('click', () => {
        if (sim?.status !== 'running') return;
        paused = !paused;
        say(paused ? L('pausedMsg') : L('runningMsg'));
        refreshButtons();
    });
    stepBtn.addEventListener('click', () => {
        if (sim?.status !== 'running' && !startRun(true)) return;
        paused = true;
        sim?.stepCommand();
        refreshButtons();
    });
    stopBtn.addEventListener('click', () => {
        if (sim?.status !== 'running') return;
        displayPose = { ...sim.pose };
        sim = null;
        paused = false;
        silence();
        highlight(null);
        say(L('stoppedMsg'));
        refreshButtons();
    });
    resetBtn.addEventListener('click', () => reset(true));
    soundBtn.addEventListener('click', () => {
        sfx.setMuted(!sfx.isMuted());
        const name = sfx.isMuted() ? 'soundOff' : 'soundOn';
        setBtn(soundBtn, name, L(name));
        soundBtn.setAttribute('aria-pressed', String(!sfx.isMuted()));
        if (!sfx.isMuted()) sfx.play('tick');
    });
    hintBtn.addEventListener('click', () => {
        const hints = text.hints[lang];
        if (hintIdx >= hints.length) {
            say(L('noHints'));
            return;
        }
        say(hints[hintIdx], 'info');
        hintIdx++;
    });

    // ---- readouts ----
    const showsArm = mission.successConditions.some((c) => c.type === 'armBetween') || !!mission.cargo;
    const startCargo = new Map((mission.cargo ?? []).map((c) => [c.id, { x: c.x, y: c.y }]));
    const showsSensor = mission.allowedBlockTypes.includes(BLOCKS.moveUntil);
    const readout = (time: number, pose: RobotPose, arm: number): string => {
        const deg = ((((pose.headingRadians * 180) / Math.PI) % 360) + 360) % 360;
        const parts = [`${L('simTime')}: ${time.toFixed(1)}s`, `${L('heading')}: ${Math.round(deg)}°`];
        if (showsArm) parts.push(`${L('arm')}: ${Math.round(arm)}°`);
        if (showsSensor) parts.push(`${L('distance')}: ${Math.round(distanceAheadCm(mission, pose))} cm`);
        return parts.join(' · ');
    };

    // ---- frame loop ----
    let lastStatus = 'idle';
    const frame = (dt: number): void => {
        if (disposed) return;
        const s = sim;
        if (s) {
            const wasMoving = s.status === 'running' && !paused;
            if (s.status === 'running' && !paused) {
                acc = Math.min(acc + dt * Number(speedSel.value), 0.5);
                while (acc >= FIXED_DT && s.status === 'running') {
                    s.step();
                    acc -= FIXED_DT;
                }
            }
            displayPose = s.pose;
            fxFrame(s, dt, wasMoving);
            timeEl.textContent = readout(s.time, s.pose, s.armAngle);
            highlight(s.status === 'running' && s.commandIndex >= 0 ? program[s.commandIndex].blockId : null);
            if (s.status !== lastStatus) {
                lastStatus = s.status;
                if (s.status === 'success' || s.status === 'failed') {
                    finishRun(s);
                    fxFinish(s);
                    refreshButtons();
                }
            }
        } else {
            lastStatus = 'idle';
            timeEl.textContent = readout(0, displayPose, mission.startArm);
        }
        scene?.setPose(displayPose);
        scene?.setCargo(s ? s.cargoPos : startCargo);
    };

    let raf = 0;
    if (scene) scene.onFrame(frame);
    else {
        let prev = performance.now();
        const loop = (t: number): void => {
            frame((t - prev) / 1000);
            prev = t;
            if (!disposed) raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
    }

    const syncArenaGrid = (): void => {
        const result = scene?.resize(arena.clientWidth, arena.clientHeight);
        const cell = Math.max(8, result?.cellCssPx ?? 24);
        arena.style.setProperty('--lp-grid-cell', `${cell}px`);
        Blockly.svgResize(workspace);
    };
    const ro = new ResizeObserver(() => syncArenaGrid());
    ro.observe(arena);
    ro.observe(blocksHost);
    syncArenaGrid();
    refreshButtons();
    if (!workspace.getTopBlocks(false).some((b) => b.type === START_BLOCK)) say(L('compile_noStart'), 'bad');

    return () => {
        disposed = true;
        window.clearTimeout(hintTimer);
        cancelAnimationFrame(raf);
        ro.disconnect();
        workspace.dispose();
        scene?.destroy();
        sfx.dispose();
        host.replaceChildren();
    };
};
