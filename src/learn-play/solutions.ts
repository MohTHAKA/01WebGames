import { BLOCKS, START_BLOCK } from './sim/program.ts';
import type { WorkspaceState } from './sim/program.ts';
import type { MotorId, MoveDirection, MoveUnit } from './sim/types.ts';

/** A block in a reference solution chain (under "when program starts"). */
export interface SolutionBlock {
    type: string;
    fields: Record<string, string | number>;
    /** Blocks inside a repeat. */
    body?: SolutionBlock[];
}

const b = (type: string, fields: Record<string, string | number> = {}): SolutionBlock => ({ type, fields });

export const repeat = (times: number, body: SolutionBlock[]): SolutionBlock => ({
    ...b(BLOCKS.repeat, { TIMES: times }),
    body
});

export const mv = (direction: MoveDirection, amount: number, unit: MoveUnit): SolutionBlock =>
    b(BLOCKS.move, { DIRECTION: direction, AMOUNT: amount, UNIT: unit });
export const moveUntil = (distanceCm: number): SolutionBlock => b(BLOCKS.moveUntil, { DISTANCE: distanceCm });
export const setSpeed = (speed: number): SolutionBlock => b(BLOCKS.setSpeed, { SPEED: speed });
export const startMove = (direction: MoveDirection): SolutionBlock => b(BLOCKS.startMove, { DIRECTION: direction });
export const stop = (): SolutionBlock => b(BLOCKS.stop);
export const steerFor = (steering: number, amount: number, unit: MoveUnit): SolutionBlock =>
    b(BLOCKS.steerFor, { STEERING: steering, AMOUNT: amount, UNIT: unit });
export const startSteer = (steering: number): SolutionBlock => b(BLOCKS.startSteer, { STEERING: steering });
export const wheelsFor = (left: number, right: number, amount: number, unit: MoveUnit): SolutionBlock =>
    b(BLOCKS.wheelsFor, { LEFT: left, RIGHT: right, AMOUNT: amount, UNIT: unit });
export const wait = (seconds: number): SolutionBlock => b(BLOCKS.wait, { SECONDS: seconds });
export const motorFor = (motor: MotorId, direction: MoveDirection, amount: number, unit: MoveUnit): SolutionBlock =>
    b(BLOCKS.motorFor, { MOTOR: motor, DIRECTION: direction, AMOUNT: amount, UNIT: unit });
export const motorSpeed = (motor: MotorId, speed: number): SolutionBlock =>
    b(BLOCKS.motorSetSpeed, { MOTOR: motor, SPEED: speed });
export const motorStart = (motor: MotorId, direction: MoveDirection): SolutionBlock =>
    b(BLOCKS.motorStart, { MOTOR: motor, DIRECTION: direction });
export const grab = (): SolutionBlock => b(BLOCKS.grab);
export const release = (): SolutionBlock => b(BLOCKS.release);
export const motorStop = (motor: MotorId | 'all'): SolutionBlock => b(BLOCKS.motorStop, { MOTOR: motor });

/** Builds a Blockly-style workspace state for a chain of blocks. */
const toChain = (chain: readonly SolutionBlock[], prefix: string): object | undefined => {
    let next: object | undefined;
    for (let i = chain.length - 1; i >= 0; i--) {
        const body = chain[i].body ? toChain(chain[i].body ?? [], `${prefix}${i}.`) : undefined;
        next = {
            type: chain[i].type,
            id: `${prefix}b${i}`,
            fields: chain[i].fields,
            ...(body ? { inputs: { DO: { block: body } } } : {}),
            ...(next ? { next: { block: next } } : {})
        };
    }
    return next;
};

export const toWorkspaceState = (chain: readonly SolutionBlock[]): WorkspaceState => {
    const next = toChain(chain, '');
    return {
        blocks: { blocks: [{ type: START_BLOCK, id: 'start', ...(next ? { next: { block: next } } : {}) } as never] }
    };
};

const SQUARE_SIDE = mv('forward', 2, 'rotations');
const TURN_RIGHT = steerFor(100, 0.5, 'rotations');

/** One reference solution per task; tests prove each one succeeds on its mission. */
export const solutions: Record<number, SolutionBlock[]> = {
    1: [mv('forward', 1, 'rotations')],
    2: [mv('forward', 4, 'rotations')],
    3: [mv('forward', 8, 'seconds')],
    4: [mv('forward', 1900, 'degrees')],
    5: [mv('forward', 4, 'rotations')],
    6: [mv('backward', 5.7, 'rotations')],
    7: [mv('forward', 4.5, 'rotations'), mv('backward', 4.5, 'rotations')],
    8: [setSpeed(80), mv('forward', 4, 'rotations')],
    9: [setSpeed(25), mv('forward', 4, 'rotations')],
    10: [startMove('forward'), wait(4), stop()],
    11: [startMove('forward'), wait(5.2), stop()],
    12: [steerFor(10, 3, 'rotations')],
    13: [steerFor(20, 3, 'rotations')],
    14: [steerFor(-10, 3, 'rotations')],
    15: [steerFor(100, 1, 'rotations')],
    16: [steerFor(100, 0.5, 'rotations')],
    17: [steerFor(100, 180, 'degrees')],
    18: [steerFor(-100, 0.5, 'rotations')],
    19: [setSpeed(80), steerFor(20, 2, 'rotations')],
    20: [wheelsFor(60, 30, 2, 'rotations')],
    21: [startSteer(-20), wait(2), stop()],
    22: [mv('forward', 2, 'rotations'), TURN_RIGHT, mv('forward', 2, 'rotations')],
    23: [
        mv('forward', 2, 'rotations'),
        TURN_RIGHT,
        mv('forward', 2, 'rotations'),
        steerFor(-100, 0.5, 'rotations'),
        mv('forward', 4, 'rotations')
    ],
    24: [SQUARE_SIDE, TURN_RIGHT, SQUARE_SIDE, TURN_RIGHT, SQUARE_SIDE, TURN_RIGHT, SQUARE_SIDE, TURN_RIGHT],
    25: [motorFor('left', 'forward', 1, 'rotations')],
    26: [motorFor('right', 'forward', 1, 'rotations')],
    27: [motorFor('left', 'forward', 2, 'rotations')],
    28: [motorFor('left', 'forward', 180, 'degrees')],
    29: [motorFor('left', 'forward', 1, 'seconds')],
    30: [motorStart('left', 'forward'), motorStart('right', 'forward'), wait(2.6), motorStop('all')],
    31: [motorFor('left', 'backward', 1, 'rotations')],
    32: [motorStart('left', 'backward'), motorStart('right', 'backward'), wait(3.8), motorStop('all')],
    33: [motorSpeed('left', 40), motorFor('left', 'forward', 1, 'rotations')],
    34: [motorSpeed('left', 100), motorFor('left', 'forward', 1, 'seconds')],
    35: [motorStart('left', 'forward'), wait(0.7), motorStop('left')],
    36: [motorSpeed('left', 50), motorFor('left', 'forward', 2, 'seconds')],
    37: [motorSpeed('left', 30), motorFor('left', 'forward', 1, 'rotations')],
    38: [motorSpeed('right', 25), motorFor('right', 'forward', 1, 'rotations')],
    39: [
        motorSpeed('left', 100),
        motorSpeed('right', 100),
        motorStart('left', 'forward'),
        motorStart('right', 'forward'),
        wait(2),
        motorStop('all')
    ],
    40: [motorFor('left', 'forward', 1, 'rotations'), mv('forward', 2, 'rotations')],
    41: [motorFor('right', 'forward', 1, 'rotations'), mv('forward', 2, 'rotations')],
    42: [mv('forward', 2, 'rotations'), motorFor('left', 'forward', 1, 'rotations'), mv('forward', 2, 'rotations')],
    43: [mv('forward', 2, 'rotations'), motorFor('right', 'forward', 1, 'rotations'), mv('forward', 2, 'rotations')],
    44: [motorFor('left', 'forward', 540, 'degrees')],
    45: [motorFor('arm', 'forward', 1, 'rotations')],
    46: [motorFor('arm', 'backward', 360, 'degrees')],
    47: [motorSpeed('arm', 30), motorFor('arm', 'forward', 2, 'seconds')],
    48: [mv('forward', 4.5, 'rotations'), motorFor('arm', 'backward', 360, 'degrees'), mv('backward', 4.5, 'rotations')]
};

const TURN_LEFT = steerFor(-100, 0.5, 'rotations');
/** Robo Logistics starts with the arm raised to 360 degrees; one rotation lowers it. */
const LOWER_ARM = motorFor('arm', 'backward', 1, 'rotations');

/** Reference solutions for the Coding Games levels (verified by tests). */
export const gameSolutions: Record<number, SolutionBlock[]> = {
    1001: [mv('forward', 4, 'rotations')],
    1002: [mv('forward', 3, 'rotations'), TURN_RIGHT, mv('forward', 2.5, 'rotations')],
    1003: [
        mv('forward', 2, 'rotations'),
        TURN_RIGHT,
        mv('forward', 2, 'rotations'),
        TURN_LEFT,
        mv('forward', 2, 'rotations')
    ],
    1004: [
        mv('forward', 2, 'rotations'),
        TURN_LEFT,
        mv('forward', 2, 'rotations'),
        TURN_RIGHT,
        mv('forward', 4, 'rotations')
    ],
    1005: [
        mv('forward', 1.25, 'rotations'),
        TURN_RIGHT,
        mv('forward', 1.25, 'rotations'),
        TURN_LEFT,
        mv('forward', 1.25, 'rotations'),
        TURN_RIGHT,
        mv('forward', 1.25, 'rotations')
    ],
    1006: solutions[24],
    1101: [
        mv('forward', 2, 'rotations'),
        TURN_RIGHT,
        mv('forward', 2.27, 'rotations'),
        TURN_LEFT,
        mv('forward', 3, 'rotations')
    ],
    1102: [
        TURN_RIGHT,
        mv('forward', 2, 'rotations'),
        TURN_LEFT,
        mv('forward', 3.4, 'rotations'),
        TURN_LEFT,
        mv('forward', 4, 'rotations'),
        TURN_RIGHT,
        mv('forward', 3, 'rotations')
    ],
    1103: [
        mv('forward', 8, 'rotations'),
        TURN_RIGHT,
        mv('forward', 1.7, 'rotations'),
        TURN_RIGHT,
        mv('forward', 2.6, 'rotations')
    ],
    1104: [
        TURN_RIGHT,
        mv('forward', 2, 'rotations'),
        TURN_LEFT,
        mv('forward', 3, 'rotations'),
        TURN_LEFT,
        mv('forward', 4, 'rotations'),
        TURN_RIGHT,
        mv('forward', 2, 'rotations'),
        TURN_RIGHT,
        mv('forward', 4, 'rotations'),
        TURN_LEFT,
        mv('forward', 3, 'rotations')
    ],
    1201: [moveUntil(30)],
    1202: [moveUntil(25)],
    1203: [moveUntil(30), TURN_RIGHT, moveUntil(30)],
    1204: [moveUntil(20), TURN_RIGHT, moveUntil(30), TURN_LEFT, moveUntil(30)],
    1301: [repeat(4, [mv('forward', 2, 'rotations'), TURN_RIGHT])],
    1302: [repeat(3, [mv('forward', 1, 'rotations'), TURN_RIGHT, mv('forward', 1, 'rotations'), TURN_LEFT])],
    1303: [repeat(4, [mv('forward', 3, 'rotations'), TURN_RIGHT])],
    1304: [repeat(8, [mv('forward', 1, 'rotations'), steerFor(100, 0.25, 'rotations')])],
    1401: [setSpeed(100), mv('forward', 7.95, 'rotations')],
    1402: [TURN_RIGHT, mv('forward', 0.85, 'rotations'), TURN_LEFT, mv('forward', 7.4, 'rotations')],
    1403: [mv('forward', 4, 'rotations'), motorFor('arm', 'forward', 1.5, 'rotations'), mv('backward', 4, 'rotations')],
    1404: [],
    1501: [LOWER_ARM, mv('forward', 2.5, 'rotations'), grab(), mv('forward', 4.32, 'rotations'), release()],
    1502: [
        LOWER_ARM,
        mv('forward', 2.5, 'rotations'),
        grab(),
        TURN_RIGHT,
        mv('forward', 2.5, 'rotations'),
        TURN_LEFT,
        mv('forward', 2.9, 'rotations'),
        release()
    ],
    1503: [
        LOWER_ARM,
        mv('forward', 0.71, 'rotations'),
        grab(),
        TURN_RIGHT,
        mv('forward', 2.27, 'rotations'),
        TURN_LEFT,
        mv('forward', 5.54, 'rotations'),
        release()
    ],
    1504: [
        LOWER_ARM,
        TURN_LEFT,
        mv('forward', 1.7, 'rotations'),
        TURN_RIGHT,
        mv('forward', 2.27, 'rotations'),
        grab(),
        mv('forward', 3.98, 'rotations'),
        release(),
        mv('backward', 6.25, 'rotations'),
        TURN_RIGHT,
        mv('forward', 3.41, 'rotations'),
        TURN_LEFT,
        mv('forward', 2.27, 'rotations'),
        grab(),
        mv('forward', 3.98, 'rotations'),
        release()
    ]
};
// Grand prix is the Logic Maze zigzag driven at full speed.
gameSolutions[1404] = [setSpeed(100), ...gameSolutions[1104]];
