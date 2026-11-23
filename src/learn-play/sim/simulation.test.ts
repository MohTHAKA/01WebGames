import { describe, expect, it } from 'vitest';

import { gameLevels } from '../game-levels.ts';
import { getMission, missions, nextMissionHref } from '../missions.ts';
import {
    grab,
    release,
    moveUntil,
    repeat,
    motorFor,
    motorSpeed,
    motorStart,
    motorStop,
    mv,
    setSpeed,
    gameSolutions,
    solutions,
    startMove,
    steerFor,
    stop,
    toWorkspaceState,
    wait
} from '../solutions.ts';
import type { SolutionBlock } from '../solutions.ts';

import { DEFAULT_CALIBRATION, metersPerRotation } from './calibration.ts';
import { integrateDrive } from './drive.ts';
import { evaluateMission } from './evaluate.ts';
import { BLOCKS, START_BLOCK, compileWorkspace } from './program.ts';
import type { WorkspaceState } from './program.ts';
import { Simulation, distanceAheadCm, timedDuration } from './simulation.ts';
import type { SimOutcome } from './simulation.ts';

interface RunResult {
    sim: Simulation;
    outcome: SimOutcome | null;
    compileError?: string;
}

const run = (taskId: number, chain: readonly SolutionBlock[], done: ReadonlySet<string> = new Set()): RunResult => {
    const mission = getMission(taskId);
    if (!mission) throw new Error(`no mission ${taskId}`);
    const compiled = compileWorkspace(toWorkspaceState(chain), mission.allowedBlockTypes);
    if (!compiled.ok) {
        const sim = new Simulation(mission, [], () => ({ ok: false }));
        return { sim, outcome: null, compileError: compiled.error.code };
    }
    const sim = new Simulation(mission, compiled.program, (s) =>
        evaluateMission(s, { doneKeys: done, usedBlocks: compiled.usedBlocks })
    );
    sim.start();
    sim.runToEnd();
    return { sim, outcome: sim.outcome };
};

const reasonOf = (r: RunResult): string | undefined => r.compileError ?? r.outcome?.reason;

describe('calibration conversions', () => {
    it('one wheel rotation travels the wheel circumference', () => {
        const { sim } = run(1, [mv('forward', 1, 'rotations')]);
        expect(sim.pose.y - sim.mission.startPose.y).toBeCloseTo(metersPerRotation(DEFAULT_CALIBRATION), 3);
        expect(sim.rightWheelAngle).toBeCloseTo(2 * Math.PI, 2);
    });

    it('degrees and rotations are equivalent (360 degrees = 1 rotation)', () => {
        const c = DEFAULT_CALIBRATION;
        expect(timedDuration('rotations', 1, 50, c)).toBeCloseTo(timedDuration('degrees', 360, 50, c), 9);
    });

    it('spinning in place: half a rotation is exactly a quarter turn', () => {
        const { sim } = run(16, [steerFor(100, 0.5, 'rotations')]);
        expect(sim.pose.headingRadians).toBeCloseTo(Math.PI / 2, 3);
        expect(Math.hypot(sim.pose.x, sim.pose.y - sim.mission.startPose.y)).toBeLessThan(1e-6);
    });

    it('moving backward reverses the pose and wheel direction', () => {
        const { sim } = run(6, [mv('backward', 1, 'rotations')]);
        expect(sim.pose.y).toBeLessThan(sim.mission.startPose.y);
        expect(sim.leftWheelAngle).toBeLessThan(0);
        expect(sim.pose.headingRadians).toBe(0);
    });
});

describe('differential steering', () => {
    it('equal wheel speeds go straight, opposite speeds spin in place', () => {
        const c = DEFAULT_CALIBRATION;
        const start = { x: 0, y: 0, headingRadians: 0 };
        expect(integrateDrive(start, 5, 5, 1, c).headingRadians).toBe(0);
        const spin = integrateDrive(start, 5, -5, 1, c);
        expect(spin.x).toBeCloseTo(0, 9);
        expect(spin.y).toBeCloseTo(0, 9);
        expect(spin.headingRadians).toBeGreaterThan(0);
    });
});

describe('collision and bounds', () => {
    it('fails safely when hitting the box in task 4', () => {
        expect(reasonOf(run(4, [mv('forward', 3000, 'degrees')]))).toBe('collision');
    });

    it('fails when leaving the arena', () => {
        expect(reasonOf(run(1, [mv('forward', 20, 'rotations')]))).toBe('outOfBounds');
    });

    it('fails when exceeding the simulated-time budget', () => {
        const r = run(1, [mv('forward', 60, 'seconds'), mv('backward', 60, 'seconds'), mv('forward', 60, 'seconds')]);
        expect(r.sim.status).toBe('failed');
    });

    it('collides with the gate posts when driving into them', () => {
        const r = run(42, [
            mv('forward', 1, 'rotations'),
            motorFor('left', 'forward', 1, 'rotations'),
            mv('forward', 3, 'rotations')
        ]);
        expect(reasonOf(r)).toBe('collision');
    });
});

describe('determinism', () => {
    const make = (taskId: number): Simulation => {
        const mission = getMission(taskId);
        if (!mission) throw new Error('missing');
        const compiled = compileWorkspace(toWorkspaceState(solutions[taskId]), mission.allowedBlockTypes);
        if (!compiled.ok) throw new Error('compile');
        const s = new Simulation(mission, compiled.program, (x) =>
            evaluateMission(x, { usedBlocks: compiled.usedBlocks })
        );
        s.start();
        return s;
    };

    it('replaying after reset gives identical results', () => {
        const sim = make(24);
        sim.runToEnd();
        const first = { ...sim.pose, t: sim.time, status: sim.status, arm: sim.armAngle };
        sim.start();
        sim.runToEnd();
        expect({ ...sim.pose, t: sim.time, status: sim.status, arm: sim.armAngle }).toEqual(first);
    });

    it('stepping per command matches running to the end', () => {
        const a = make(22);
        a.runToEnd();
        const b = make(22);
        while (b.status === 'running') b.stepCommand();
        expect(b.pose).toEqual(a.pose);
        expect(b.status).toBe(a.status);
    });
});

describe('mission catalogue', () => {
    it('has one mission per task 1..48 with matching units', () => {
        expect(missions.map((m) => m.taskId)).toEqual(Array.from({ length: 48 }, (_, i) => i + 1));
        const ranges = [7, 4, 7, 6, 8, 7, 9];
        let id = 1;
        ranges.forEach((n, i) => {
            for (let k = 0; k < n; k++) expect(getMission(id++)?.unitId).toBe(i + 1);
        });
    });

    it('every task has a reference solution that completes its mission', () => {
        for (const m of missions) {
            expect(solutions[m.taskId], `solution ${m.taskId}`).toBeDefined();
            if (m.successConditions.some((c) => c.type === 'subTrials')) continue; // covered below
            const r = run(m.taskId, solutions[m.taskId]);
            expect(r.compileError, `compile ${m.taskId}`).toBeUndefined();
            expect(r.outcome, `task ${m.taskId} ${r.outcome?.reason}`).toMatchObject({ ok: true });
        }
    });

    it('sub-trial missions need every key, once each', () => {
        const unitRuns = [
            ['rotations', mv('forward', 4, 'rotations')],
            ['seconds', mv('forward', 4, 'seconds')],
            ['degrees', mv('forward', 1440, 'degrees')]
        ] as const;
        const done = new Set<string>();
        for (const [key, block] of unitRuns) {
            const r = run(5, [block], done);
            expect(r.outcome?.trialKey).toBe(key);
            done.add(key);
            expect(r.outcome?.missionComplete).toBe(done.size === 3);
        }
        expect(reasonOf(run(5, [mv('forward', 4, 'rotations')], done))).toBe('trialAlreadyDone');
        expect(reasonOf(run(5, [mv('forward', 2, 'rotations'), mv('forward', 720, 'degrees')]))).toBe('mixedTrial');

        const bands: [number, SolutionBlock[], SolutionBlock[]][] = [
            [9, [setSpeed(25), mv('forward', 4, 'rotations')], [setSpeed(80), mv('forward', 4, 'rotations')]],
            [
                37,
                [motorSpeed('left', 30), motorFor('left', 'forward', 1, 'rotations')],
                [motorSpeed('left', 80), motorFor('left', 'forward', 1, 'rotations')]
            ]
        ];
        for (const [task, slow, fast] of bands) {
            expect(run(task, slow).outcome).toMatchObject({ ok: true, trialKey: 'slow', missionComplete: false });
            expect(run(task, fast, new Set(['slow'])).outcome).toMatchObject({
                ok: true,
                trialKey: 'fast',
                missionComplete: true
            });
            expect(run(task, slow, new Set(['slow'])).outcome?.reason).toBe('trialAlreadyDone');
        }
    });
});

describe('failure feedback', () => {
    it('task 1: empty program, task 2: wrong unit and short distance', () => {
        expect(reasonOf(run(1, []))).toBe('emptyProgram');
        expect(reasonOf(run(2, [mv('forward', 4, 'seconds')]))).toBe('wrongUnit');
        expect(reasonOf(run(2, [mv('forward', 2, 'rotations')]))).toBe('missedTarget');
    });

    it('task 4 and 7 distinguish near misses', () => {
        expect(reasonOf(run(4, [mv('forward', 1500, 'degrees')]))).toBe('missedTarget');
        expect(reasonOf(run(7, [mv('forward', 4.5, 'rotations')]))).toBe('notReturned');
        expect(reasonOf(run(7, [mv('forward', 1, 'rotations')]))).toBe('notVisited');
    });

    it('task 8 needs a speed block and a different speed', () => {
        expect(reasonOf(run(8, [mv('forward', 4, 'rotations')]))).toBe('missingBlock');
        expect(reasonOf(run(8, [setSpeed(50), mv('forward', 4, 'rotations')]))).toBe('wrongSpeed');
    });

    it('task 10 needs the start/wait/stop blocks', () => {
        expect(reasonOf(run(10, [mv('forward', 4, 'rotations')]))).toBe('missingBlock');
        expect(reasonOf(run(10, [startMove('forward'), wait(2), stop()]))).toBe('missedTarget');
    });

    it('task 17 rejects rotations, task 25 rejects the wrong motor', () => {
        expect(reasonOf(run(17, [steerFor(100, 0.5, 'rotations')]))).toBe('wrongUnit');
        expect(reasonOf(run(25, [motorFor('right', 'forward', 1, 'rotations')]))).toBe('wrongMotor');
        expect(reasonOf(run(25, [motorFor('left', 'forward', 2, 'rotations')]))).toBe('headingOff');
    });

    it('task 24 needs the corners in order, not just any loop', () => {
        const r = run(24, [mv('forward', 2, 'rotations'), steerFor(100, 0.5, 'rotations')]);
        expect(reasonOf(r)).toBe('notVisited');
    });

    it('tasks 45-48: the arm angle is checked and stalls at its limits', () => {
        expect(reasonOf(run(45, [motorFor('arm', 'forward', 2, 'rotations')]))).toBe('armOff');
        expect(reasonOf(run(46, [motorFor('arm', 'backward', 100, 'degrees')]))).toBe('armOff');
        const r = run(48, [
            mv('forward', 4.5, 'rotations'),
            motorFor('arm', 'backward', 5, 'rotations'),
            mv('backward', 4.5, 'rotations')
        ]);
        expect(r.sim.armAngle).toBe(0);
        expect(r.outcome?.ok).toBe(true);
    });

    it('tasks 30 and 39: reference programs stop the motors', () => {
        expect(run(30, solutions[30]).outcome?.ok).toBe(true);
        // without a stop block the robot keeps running until the program ends, but the block is required
        const noStop = [motorStart('left', 'forward'), motorStart('right', 'forward'), wait(2.6), motorStop('all')];
        expect(run(30, noStop.slice(0, 3)).outcome?.reason).toBe('missingBlock');
        expect(run(39, solutions[39]).outcome?.ok).toBe(true);
    });
});

describe('workspace compiler', () => {
    const chain = (...blocks: object[]): WorkspaceState => {
        let next: object | undefined;
        for (const b of [...blocks].reverse()) next = { ...b, ...(next ? { next: { block: next } } : {}) };
        return {
            blocks: { blocks: [{ type: START_BLOCK, id: 's', ...(next ? { next: { block: next } } : {}) } as never] }
        };
    };
    const move = (id: string, amount: unknown, unit = 'rotations', direction = 'forward') => ({
        type: BLOCKS.move,
        id,
        fields: { DIRECTION: direction, AMOUNT: amount, UNIT: unit }
    });
    const allowed = [START_BLOCK, BLOCKS.move, BLOCKS.setSpeed, BLOCKS.motorFor, BLOCKS.motorSetSpeed];

    it('compiles a chain in order with block ids and the current speed', () => {
        const r = compileWorkspace(
            chain(
                { type: BLOCKS.setSpeed, id: 'v', fields: { SPEED: 80 } },
                move('a', 2),
                move('b', 3, 'seconds', 'backward')
            ),
            allowed
        );
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.program.map((c) => c.blockId)).toEqual(['a', 'b']);
            expect(r.program[1]).toMatchObject({ type: 'drive', left: -80, right: -80, unit: 'seconds', amount: 3 });
            expect(r.usedBlocks).toContain(BLOCKS.setSpeed);
        }
    });

    it('rejects missing start, bad numbers, unknown units and disallowed blocks', () => {
        expect(compileWorkspace({ blocks: { blocks: [] } }, allowed)).toEqual({
            ok: false,
            error: { code: 'noStart' }
        });
        for (const bad of [-1, 'abc', 1e9, 0]) {
            expect(compileWorkspace(chain(move('a', bad)), allowed)).toMatchObject({
                ok: false,
                error: { code: 'invalidAmount' }
            });
        }
        expect(compileWorkspace(chain(move('a', 1, 'parsecs')), allowed)).toMatchObject({
            ok: false,
            error: { code: 'invalidField' }
        });
        expect(compileWorkspace(chain(move('a', 1)), [START_BLOCK])).toMatchObject({
            ok: false,
            error: { code: 'unknownBlock' }
        });
        expect(
            compileWorkspace(chain({ type: BLOCKS.setSpeed, id: 'v', fields: { SPEED: 500 } }), allowed)
        ).toMatchObject({ ok: false, error: { code: 'invalidValue' } });
    });

    it('rejects zero speed for rotation-based moves but allows it for seconds', () => {
        const zero = { type: BLOCKS.setSpeed, id: 'v', fields: { SPEED: 0 } };
        expect(compileWorkspace(chain(zero, move('a', 1)), allowed)).toMatchObject({
            ok: false,
            error: { code: 'zeroSpeed' }
        });
        expect(compileWorkspace(chain(zero, move('a', 1, 'seconds')), allowed).ok).toBe(true);
    });

    it('caps program length', () => {
        const many = Array.from({ length: 101 }, (_, i) => move(`m${i}`, 1));
        expect(compileWorkspace(chain(...many), allowed)).toEqual({ ok: false, error: { code: 'tooManyCommands' } });
    });
});

describe('Coding Games levels', () => {
    it('every game level has a reference solution that completes it', () => {
        for (const m of gameLevels) {
            expect(gameSolutions[m.taskId], `solution ${m.taskId}`).toBeDefined();
            const r = run(m.taskId, gameSolutions[m.taskId]);
            expect(r.compileError, `compile ${m.taskId}`).toBeUndefined();
            expect(r.outcome, `level ${m.taskId} ${r.outcome?.reason}`).toMatchObject({ ok: true });
        }
    });

    it('levels fail when the route is wrong', () => {
        expect(reasonOf(run(1004, [mv('forward', 4, 'rotations')]))).toBe('collision');
        expect(reasonOf(run(1003, [mv('forward', 4, 'rotations')]))).toBe('notVisited');
        expect(reasonOf(run(1101, [mv('forward', 4, 'rotations')]))).toBe('collision');
    });

    it('cargo needs a lowered arm, a nearby crate and a drop on the target', () => {
        const reach = [mv('forward', 2.5, 'rotations')];
        expect(reasonOf(run(1501, [...reach, grab()]))).toBe('armUp');
        expect(reasonOf(run(1501, [grab()]))).toBe('armUp');
        const lowered = [motorFor('arm', 'backward', 1, 'rotations')];
        expect(reasonOf(run(1501, [...lowered, grab()]))).toBe('nothingToGrab');
        expect(reasonOf(run(1501, [...lowered, release()]))).toBe('nothingCarried');
        // Grab, but never release on the pad: the crate ends up elsewhere.
        expect(reasonOf(run(1501, [...lowered, ...reach, grab(), mv('forward', 1, 'rotations')]))).toBe('cargoMissed');
        const ok = run(1501, gameSolutions[1501]);
        expect(ok.sim.carrying).toBeNull();
        expect(ok.sim.cargoPos.get('c1')?.y).toBeCloseTo(1.2, 1);
    });

    it('distance sensor reads the free space ahead and stops the robot there', () => {
        const mission = getMission(1202);
        if (!mission) throw new Error('missing 1202');
        // Start (0, -1.4) facing +y: crate bottom edge at y = 0.5, robot radius 0.12.
        expect(distanceAheadCm(mission, mission.startPose)).toBeCloseTo((0.5 + 1.4 - 0.12) * 100, 3);
        // Facing right from the start the arena wall is 1.2 m away.
        const right = { ...mission.startPose, headingRadians: Math.PI / 2 };
        expect(distanceAheadCm(mission, right)).toBeCloseTo((1.2 - 0.12) * 100, 3);
        const r = run(1202, gameSolutions[1202]);
        expect(r.sim.sensorCm()).toBeLessThanOrEqual(25);
        expect(r.sim.sensorCm()).toBeGreaterThan(24);
    });

    it('sensor levels need the sensor block and reject bad values', () => {
        expect(reasonOf(run(1201, [mv('forward', 8.18, 'rotations')]))).toBe('missingBlock');
        expect(reasonOf(run(1202, [moveUntil(60)]))).toBe('missedTarget');
        expect(
            reasonOf(run(1204, [moveUntil(5), steerFor(100, 0.5, 'rotations'), mv('forward', 3, 'rotations')]))
        ).toBe('missedTarget');
        expect(run(1201, [moveUntil(1)]).compileError).toBe('invalidValue');
        // Other games do not offer the sensor block.
        expect(run(1001, [moveUntil(30)]).compileError).toBe('unknownBlock');
    });

    it('repeat blocks unroll, nest, and are validated', () => {
        const side = [mv('forward', 2, 'rotations'), steerFor(100, 0.5, 'rotations')];
        const looped = run(1301, [repeat(4, side)]);
        const flat = run(1301, [...side, ...side, ...side, ...side]);
        expect(looped.sim.program).toEqual(
            flat.sim.program.map((c, i) => ({ ...c, blockId: looped.sim.program[i].blockId }))
        );
        // Without the repeat block the lap does not count.
        expect(reasonOf(run(1301, [...side, ...side, ...side, ...side]))).toBe('missingBlock');
        // A repeat inside a repeat: 2 x (2 x side) is two laps' worth of half sides.
        expect(run(1301, [repeat(2, [repeat(2, side)])]).sim.program).toHaveLength(8);
        expect(run(1301, [repeat(0, side)]).compileError).toBe('invalidValue');
        expect(run(1301, [repeat(21, side)]).compileError).toBe('invalidValue');
        expect(run(1301, [repeat(2, [repeat(2, [repeat(2, side)])])]).compileError).toBe('invalidValue');
        expect(run(1301, [repeat(20, [repeat(20, side)])]).compileError).toBe('tooManyCommands');
        // Other games do not offer it.
        expect(run(1001, [repeat(2, side)]).compileError).toBe('unknownBlock');
    });

    it('arena levels are timed and skill based', () => {
        // The same routes at the default speed are too slow.
        expect(reasonOf(run(1401, [setSpeed(50), mv('forward', 7.95, 'rotations')]))).toBe('tooSlow');
        expect(reasonOf(run(1401, [mv('forward', 7.95, 'rotations')]))).toBe('missingBlock');
        expect(reasonOf(run(1404, [setSpeed(70), ...gameSolutions[1104]]))).toBe('tooSlow');
        // A wide turn clips the narrow gap.
        const clipped = [steerFor(100, 0.5, 'rotations'), mv('forward', 1.1, 'rotations')];
        expect(
            reasonOf(run(1402, [...clipped, steerFor(-100, 0.5, 'rotations'), mv('forward', 7.4, 'rotations')]))
        ).toBe('collision');
        // The arm must end up at the right angle.
        expect(
            reasonOf(
                run(1403, [
                    mv('forward', 4, 'rotations'),
                    motorFor('arm', 'forward', 1, 'rotations'),
                    mv('backward', 4, 'rotations')
                ])
            )
        ).toBe('armOff');
        expect(reasonOf(run(1403, [mv('forward', 4, 'rotations'), motorFor('arm', 'forward', 1.5, 'rotations')]))).toBe(
            'notReturned'
        );
        expect(nextMissionHref(1401)).toBe('#/play/1402');
        expect(nextMissionHref(1404)).toBeNull();
    });

    it('links to the next level of the same game only', () => {
        expect(nextMissionHref(1301)).toBe('#/play/1302');
        expect(nextMissionHref(1304)).toBeNull();
        expect(nextMissionHref(1201)).toBe('#/play/1202');
        expect(nextMissionHref(1204)).toBeNull();
        expect(nextMissionHref(1001)).toBe('#/play/1002');
        expect(nextMissionHref(1006)).toBeNull();
        expect(nextMissionHref(48)).toBeNull();
        expect(nextMissionHref(3)).toBe('#/task/4');
    });
});
