import type { SimOutcome, Simulation } from './simulation.ts';
import type { Command, MoveUnit } from './types.ts';

export interface EvalContext {
    /** Sub-trial keys already satisfied in earlier runs. */
    doneKeys?: ReadonlySet<string>;
    /** Block types present in the compiled program. */
    usedBlocks?: readonly string[];
}

export type SpeedBand = 'slow' | 'mid' | 'fast';

/** Absolute, non-zero speeds the program commands. */
export const speedsUsed = (program: readonly Command[]): number[] => {
    const out: number[] = [];
    const push = (v: number | undefined): void => {
        if (v !== undefined && v !== 0) out.push(Math.abs(v));
    };
    for (const c of program) {
        if (c.type === 'drive') {
            push(c.left);
            push(c.right);
        } else if (c.type === 'motorFor') push(c.speed);
        else if (c.type === 'run') {
            push(c.left);
            push(c.right);
            push(c.arm);
        }
    }
    return out;
};

export const speedBand = (program: readonly Command[]): SpeedBand => {
    const top = Math.max(0, ...speedsUsed(program));
    if (top <= 30) return 'slow';
    if (top >= 70) return 'fast';
    return 'mid';
};

const timedUnits = (program: readonly Command[]): Set<MoveUnit> => {
    const units = new Set<MoveUnit>();
    for (const c of program) if (c.type === 'drive' || c.type === 'motorFor') units.add(c.unit);
    return units;
};

const hasNegative = (program: readonly Command[]): boolean =>
    program.some((c) => {
        if (c.type === 'drive') return c.left < 0 || c.right < 0;
        if (c.type === 'motorFor') return c.speed < 0;
        if (c.type === 'run') return (c.left ?? 0) < 0 || (c.right ?? 0) < 0 || (c.arm ?? 0) < 0;
        return false;
    });

const wrapAngle = (a: number): number => {
    const t = 2 * Math.PI;
    return ((((a + Math.PI) % t) + t) % t) - Math.PI;
};

const inZone = (sim: Simulation, id: string): boolean => {
    const z = sim.mission.zones.find((zone) => zone.id === id);
    return !!z && Math.hypot(sim.pose.x - z.x, sim.pose.y - z.y) <= z.radius;
};

/**
 * Checks a finished (collision-free) program against the mission's success conditions.
 * Conditions are checked in order, so the first failing one decides the feedback.
 */
export const evaluateMission = (sim: Simulation, ctx: EvalContext = {}): SimOutcome => {
    const { successConditions, startPose } = sim.mission;
    const program = sim.program;
    const used = ctx.usedBlocks ?? [];
    const done = ctx.doneKeys ?? new Set<string>();
    let trialKey: string | undefined;
    let missionComplete = true;

    for (const cond of successConditions) {
        switch (cond.type) {
            case 'moved':
                if (program.length === 0) return { ok: false, reason: 'noMovement' };
                break;
            case 'usesOnlyUnit': {
                const units = timedUnits(program);
                if (units.size !== 1 || !units.has(cond.unit)) return { ok: false, reason: 'wrongUnit' };
                break;
            }
            case 'usesDirection':
                if (cond.direction === 'backward' && !hasNegative(program))
                    return { ok: false, reason: 'wrongDirection' };
                break;
            case 'usesBlock':
                if (!used.includes(cond.block)) return { ok: false, reason: 'missingBlock' };
                break;
            case 'usesSpeedOtherThan':
                if (!speedsUsed(program).some((s) => s !== cond.value)) return { ok: false, reason: 'wrongSpeed' };
                break;
            case 'usesSpeedAtMost': {
                const speeds = speedsUsed(program);
                if (speeds.length === 0 || speeds.some((s) => s > cond.value))
                    return { ok: false, reason: 'wrongSpeed' };
                break;
            }
            case 'usesOnlyMotor':
                for (const c of program) {
                    if (c.type === 'drive') return { ok: false, reason: 'wrongMotor' };
                    if (c.type === 'motorFor' && c.motor !== cond.motor) return { ok: false, reason: 'wrongMotor' };
                    if (c.type === 'run') {
                        const others = (['left', 'right', 'arm'] as const).filter((m) => m !== cond.motor);
                        if (others.some((m) => (c[m] ?? 0) !== 0)) return { ok: false, reason: 'wrongMotor' };
                    }
                }
                break;
            case 'endsInZone':
                if (!inZone(sim, cond.zone)) return { ok: false, reason: 'missedTarget' };
                break;
            case 'visitedZone':
                if (!sim.visited.has(cond.zone)) return { ok: false, reason: 'notVisited' };
                break;
            case 'visitedInOrder': {
                if (!cond.zones.every((z) => sim.visited.has(z))) return { ok: false, reason: 'notVisited' };
                const order = cond.zones.map((z) => sim.visitedOrder.indexOf(z));
                if (order.some((v, i) => i > 0 && v < order[i - 1])) return { ok: false, reason: 'notInOrder' };
                break;
            }
            case 'endsNearStart':
                if (Math.hypot(sim.pose.x - startPose.x, sim.pose.y - startPose.y) > cond.tolerance) {
                    return { ok: false, reason: 'notReturned' };
                }
                break;
            case 'headingUnchanged':
                if (Math.abs(wrapAngle(sim.pose.headingRadians - startPose.headingRadians)) > cond.tolerance) {
                    return { ok: false, reason: 'headingChanged' };
                }
                break;
            case 'headingNear':
                if (Math.abs(wrapAngle(sim.pose.headingRadians - cond.radians)) > cond.tolerance) {
                    return { ok: false, reason: 'headingOff' };
                }
                break;
            case 'armBetween':
                if (sim.armAngle < cond.min || sim.armAngle > cond.max) return { ok: false, reason: 'armOff' };
                break;
            case 'cargoIn': {
                const z = sim.mission.zones.find((zone) => zone.id === cond.zone);
                const p = sim.cargoPos.get(cond.cargo);
                if (!z || !p || Math.hypot(p.x - z.x, p.y - z.y) > z.radius)
                    return { ok: false, reason: 'cargoMissed' };
                break;
            }
            case 'withinSeconds':
                if (sim.time > cond.seconds) return { ok: false, reason: 'tooSlow' };
                break;
            case 'subTrials': {
                let key: string;
                if (cond.kind === 'unit') {
                    const units = timedUnits(program);
                    if (units.size !== 1) return { ok: false, reason: 'mixedTrial' };
                    key = [...units][0];
                } else {
                    key = speedBand(program);
                }
                if (!cond.keys.includes(key)) return { ok: false, reason: 'wrongSpeed' };
                if (done.has(key)) return { ok: false, reason: 'trialAlreadyDone' };
                trialKey = key;
                const all = new Set(done).add(key);
                missionComplete = cond.keys.every((k) => all.has(k));
                break;
            }
        }
    }
    return { ok: true, trialKey, missionComplete };
};
