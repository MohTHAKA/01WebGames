import { DEFAULT_DRIVE_SPEED, DEFAULT_MOTOR_SPEED, LIMITS, SENSOR_MAX_CM, SENSOR_MIN_CM } from './calibration.ts';
import type { Command, MotorId, MoveDirection, MoveUnit } from './types.ts';

export const BLOCKS = {
    start: 'zero1_start',
    move: 'zero1_move',
    moveUntil: 'zero1_move_until',
    repeat: 'zero1_repeat',
    grab: 'zero1_grab',
    release: 'zero1_release',
    setSpeed: 'zero1_set_speed',
    startMove: 'zero1_start_move',
    stop: 'zero1_stop',
    steerFor: 'zero1_steer_for',
    startSteer: 'zero1_start_steer',
    wheels: 'zero1_wheels',
    wheelsFor: 'zero1_wheels_for',
    wait: 'zero1_wait',
    motorFor: 'zero1_motor_for',
    motorSetSpeed: 'zero1_motor_set_speed',
    motorStart: 'zero1_motor_start',
    motorStop: 'zero1_motor_stop'
} as const;

export const START_BLOCK = BLOCKS.start;
export const MOVE_BLOCK = BLOCKS.move;

/** Minimal shape of Blockly's JSON serialization that the compiler reads. */
export interface BlockState {
    type?: unknown;
    id?: unknown;
    fields?: unknown;
    /** Statement inputs, e.g. the body of a repeat block under `DO`. */
    inputs?: unknown;
    next?: { block?: BlockState };
}

export interface WorkspaceState {
    blocks?: { blocks?: BlockState[] };
}

export type CompileError =
    | { code: 'noStart' }
    | { code: 'unknownBlock'; blockId: string }
    | { code: 'invalidAmount'; blockId: string }
    | { code: 'invalidValue'; blockId: string }
    | { code: 'zeroSpeed'; blockId: string }
    | { code: 'invalidField'; blockId: string }
    | { code: 'tooManyCommands' };

export type CompileResult = { ok: true; program: Command[]; usedBlocks: string[] } | { ok: false; error: CompileError };

const MAX_BY_UNIT: Record<MoveUnit, number> = {
    rotations: LIMITS.maxRotations,
    seconds: LIMITS.maxSeconds,
    degrees: LIMITS.maxDegrees
};

/** Repeat blocks may sit inside one another this deep (a repeat inside a repeat is depth 1). */
const MAX_REPEAT_DEPTH = 2;

const isUnit = (v: unknown): v is MoveUnit => v === 'rotations' || v === 'seconds' || v === 'degrees';
const isDirection = (v: unknown): v is MoveDirection => v === 'forward' || v === 'backward';
const isMotor = (v: unknown): v is MotorId => v === 'left' || v === 'right' || v === 'arm';

const asRecord = (v: unknown): Record<string, unknown> =>
    typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {};

/**
 * Steering -100..100: 0 straight, +/-50 one wheel stops, +/-100 spin in place. Positive steers right
 * (the left wheel keeps the speed).
 */
export const steerSpeeds = (speed: number, steering: number): { left: number; right: number } => {
    const factor = 1 - Math.abs(steering) / 50;
    return steering >= 0 ? { left: speed, right: speed * factor } : { left: speed * factor, right: speed };
};

const inRange = (v: number, min: number, max: number): boolean => Number.isFinite(v) && v >= min && v <= max;

type Failure = Exclude<CompileError['code'], 'noStart' | 'tooManyCommands'>;

/**
 * Turns a serialized Blockly workspace into a validated command list. Only the chain under the start
 * block runs; nothing is generated as JavaScript and nothing is evaluated.
 */
export const compileWorkspace = (state: WorkspaceState, allowedBlockTypes: readonly string[]): CompileResult => {
    const top = state.blocks?.blocks ?? [];
    const start = top.find((b) => b.type === START_BLOCK);
    if (!start) return { ok: false, error: { code: 'noStart' } };

    const program: Command[] = [];
    const used = new Set<string>();
    let driveSpeed = DEFAULT_DRIVE_SPEED;
    const motorSpeed: Record<MotorId, number> = {
        left: DEFAULT_MOTOR_SPEED,
        right: DEFAULT_MOTOR_SPEED,
        arm: DEFAULT_MOTOR_SPEED
    };
    const blockTypes: string[] = Object.values(BLOCKS);

    /** Compiles one chain of blocks (the main program, or the body of a repeat). */
    const walk = (first: BlockState | undefined, depth: number): CompileResult | null => {
        let cur = first;
        while (cur) {
            const blockId = typeof cur.id === 'string' ? cur.id : '';
            const type = typeof cur.type === 'string' ? cur.type : '';
            const fail = (code: Failure): CompileResult => ({ ok: false, error: { code, blockId } });
            if (!blockTypes.includes(type) || type === START_BLOCK || !allowedBlockTypes.includes(type)) {
                return fail('unknownBlock');
            }
            used.add(type);
            const f = asRecord(cur.fields);
            const amount = Number(f.AMOUNT);
            const unit = f.UNIT;
            const sign = f.DIRECTION === 'backward' ? -1 : 1;
            /** Validates the amount/unit fields of a timed block; the result is null when valid. */
            const checkTimed = (refSpeed: number): CompileResult | null => {
                if (!isUnit(unit)) return fail('invalidField');
                if (!inRange(amount, 0, MAX_BY_UNIT[unit]) || amount === 0) return fail('invalidAmount');
                if (refSpeed === 0 && unit !== 'seconds') return fail('zeroSpeed');
                return null;
            };

            switch (type) {
                case BLOCKS.move: {
                    if (!isDirection(f.DIRECTION)) return fail('invalidField');
                    const bad = checkTimed(driveSpeed);
                    if (bad) return bad;
                    const s = sign * driveSpeed;
                    program.push({ type: 'drive', blockId, left: s, right: s, amount, unit: unit as MoveUnit });
                    break;
                }
                case BLOCKS.grab:
                    program.push({ type: 'grab', blockId });
                    break;
                case BLOCKS.release:
                    program.push({ type: 'release', blockId });
                    break;
                case BLOCKS.repeat: {
                    const times = Number(f.TIMES);
                    if (!Number.isInteger(times) || !inRange(times, 1, LIMITS.maxRepeat) || depth >= MAX_REPEAT_DEPTH) {
                        return fail('invalidValue');
                    }
                    // Unrolled: each pass compiles the body again so speed changes inside it carry over.
                    const body = asRecord(asRecord(cur.inputs).DO).block as BlockState | undefined;
                    for (let i = 0; i < times; i++) {
                        const bad = walk(body, depth + 1);
                        if (bad) return bad;
                    }
                    break;
                }
                case BLOCKS.moveUntil: {
                    const distanceCm = Number(f.DISTANCE);
                    if (!inRange(distanceCm, SENSOR_MIN_CM, SENSOR_MAX_CM)) return fail('invalidValue');
                    if (driveSpeed === 0) return fail('zeroSpeed');
                    program.push({ type: 'driveUntil', blockId, left: driveSpeed, right: driveSpeed, distanceCm });
                    break;
                }
                case BLOCKS.setSpeed: {
                    const v = Number(f.SPEED);
                    if (!inRange(v, 0, 100)) return fail('invalidValue');
                    driveSpeed = v;
                    break;
                }
                case BLOCKS.startMove: {
                    if (!isDirection(f.DIRECTION)) return fail('invalidField');
                    const s = sign * driveSpeed;
                    program.push({ type: 'run', blockId, left: s, right: s });
                    break;
                }
                case BLOCKS.stop:
                    program.push({ type: 'run', blockId, left: 0, right: 0, arm: 0 });
                    break;
                case BLOCKS.steerFor: {
                    const steering = Number(f.STEERING);
                    if (!inRange(steering, -100, 100)) return fail('invalidValue');
                    const bad = checkTimed(driveSpeed);
                    if (bad) return bad;
                    const { left, right } = steerSpeeds(driveSpeed, steering);
                    program.push({ type: 'drive', blockId, left, right, amount, unit: unit as MoveUnit });
                    break;
                }
                case BLOCKS.startSteer: {
                    const steering = Number(f.STEERING);
                    if (!inRange(steering, -100, 100)) return fail('invalidValue');
                    const { left, right } = steerSpeeds(driveSpeed, steering);
                    program.push({ type: 'run', blockId, left, right });
                    break;
                }
                case BLOCKS.wheels: {
                    const left = Number(f.LEFT);
                    const right = Number(f.RIGHT);
                    if (!inRange(left, -100, 100) || !inRange(right, -100, 100)) return fail('invalidValue');
                    program.push({ type: 'run', blockId, left, right });
                    break;
                }
                case BLOCKS.wheelsFor: {
                    const left = Number(f.LEFT);
                    const right = Number(f.RIGHT);
                    if (!inRange(left, -100, 100) || !inRange(right, -100, 100)) return fail('invalidValue');
                    const bad = checkTimed(Math.max(Math.abs(left), Math.abs(right)));
                    if (bad) return bad;
                    program.push({ type: 'drive', blockId, left, right, amount, unit: unit as MoveUnit });
                    break;
                }
                case BLOCKS.wait: {
                    const seconds = Number(f.SECONDS);
                    if (!inRange(seconds, 0, LIMITS.maxSeconds) || seconds === 0) return fail('invalidAmount');
                    program.push({ type: 'wait', blockId, seconds });
                    break;
                }
                case BLOCKS.motorSetSpeed: {
                    const v = Number(f.SPEED);
                    if (!isMotor(f.MOTOR)) return fail('invalidField');
                    if (!inRange(v, 0, 100)) return fail('invalidValue');
                    motorSpeed[f.MOTOR] = v;
                    break;
                }
                case BLOCKS.motorFor: {
                    if (!isMotor(f.MOTOR) || !isDirection(f.DIRECTION)) return fail('invalidField');
                    const speed = motorSpeed[f.MOTOR];
                    const bad = checkTimed(speed);
                    if (bad) return bad;
                    program.push({
                        type: 'motorFor',
                        blockId,
                        motor: f.MOTOR,
                        speed: sign * speed,
                        amount,
                        unit: unit as MoveUnit
                    });
                    break;
                }
                case BLOCKS.motorStart: {
                    if (!isMotor(f.MOTOR) || !isDirection(f.DIRECTION)) return fail('invalidField');
                    program.push({ type: 'run', blockId, [f.MOTOR]: sign * motorSpeed[f.MOTOR] });
                    break;
                }
                case BLOCKS.motorStop: {
                    if (f.MOTOR === 'all') program.push({ type: 'run', blockId, left: 0, right: 0, arm: 0 });
                    else if (isMotor(f.MOTOR)) program.push({ type: 'run', blockId, [f.MOTOR]: 0 });
                    else return fail('invalidField');
                    break;
                }
            }
            if (program.length > LIMITS.maxCommands) return { ok: false, error: { code: 'tooManyCommands' } };
            cur = cur.next?.block;
        }
        return null;
    };

    const error = walk(start.next?.block, 0);
    if (error) return error;
    return { ok: true, program, usedBlocks: [...used] };
};
