import { gameLevelText, gameLevels } from './game-levels.ts';
import { missionText as taskText } from './mission-text.ts';
import type { MissionText } from './mission-text.ts';
import { BLOCKS as B } from './sim/program.ts';
import type { Condition, MissionDefinition, Rect, Zone } from './sim/types.ts';

/**
 * IMPLEMENTATION-ONLY metadata (maps, tolerances, start poses, success conditions) for all 48 tasks.
 * Only Unit 1 objectives follow the implementation brief; every other mission is an editorial design
 * (see docs/learn-play/mission-specifications.md). Every mission has a reference solution in
 * solutions.ts that the tests run against it.
 */
const START = { x: 0, y: -1.4, headingRadians: 0 };
const ARENA = { halfWidth: 1.2, halfHeight: 1.9 };
const QUARTER = Math.PI / 2;

const U1 = [B.start, B.move];
const U2 = [B.start, B.move, B.setSpeed, B.startMove, B.stop, B.wait];
const U3 = [B.start, B.move, B.steerFor];
const U4 = [B.start, B.move, B.setSpeed, B.steerFor, B.startSteer, B.wheelsFor, B.wheels, B.wait, B.stop];
const U5 = [B.start, B.motorFor, B.motorStart, B.motorStop, B.wait];
const U6 = [...U5, B.motorSetSpeed];
const U7 = [B.start, B.move, B.motorFor, B.motorSetSpeed, B.motorStart, B.motorStop, B.wait];

const flag = (x: number, y: number, radius = 0.2, id = 'flag'): Zone => ({ id, kind: 'flag', x, y, radius });
const box = (cx: number, cy: number, halfWidth: number, halfHeight: number): Rect => ({
    cx,
    cy,
    halfWidth,
    halfHeight
});

const only = (motor: 'left' | 'right' | 'arm'): Condition => ({ type: 'usesOnlyMotor', motor });
const uses = (block: string): Condition => ({ type: 'usesBlock', block });
const heading = (radians: number, tolerance: number): Condition => ({ type: 'headingNear', radians, tolerance });
const inZone = (zone: string): Condition => ({ type: 'endsInZone', zone });

interface Spec {
    unitId: number;
    blocks: string[];
    conditions: Condition[];
    zones?: Zone[];
    obstacles?: Rect[];
    startPose?: MissionDefinition['startPose'];
    startArm?: number;
}

const define = (taskId: number, s: Spec): MissionDefinition => ({
    taskId,
    unitId: s.unitId,
    mapId: `unit${s.unitId}-task${taskId}`,
    allowedBlockTypes: s.blocks,
    startPose: s.startPose ?? START,
    startArm: s.startArm ?? 0,
    ...ARENA,
    obstacles: s.obstacles ?? [],
    zones: s.zones ?? [],
    successConditions: s.conditions
});

const deadEnd: Pick<Spec, 'startPose' | 'obstacles'> = {
    startPose: { x: 0, y: 0.7, headingRadians: 0 },
    obstacles: [box(-0.4, 0.1, 0.05, 1.0), box(0.4, 0.1, 0.05, 1.0), box(0, 1.15, 0.45, 0.05)]
};

/** Posts either side of a gate at (x, y); the gap leaves the robot a comfortable margin. */
const gatePosts = (x: number, y: number): Rect[] => [box(x, y + 0.38, 0.04, 0.04), box(x, y - 0.38, 0.04, 0.04)];

const SQUARE = [
    { id: 'b', kind: 'flag', x: 0, y: -0.696, radius: 0.2 },
    { id: 'c', kind: 'flag', x: 0.704, y: -0.696, radius: 0.2 },
    { id: 'd', kind: 'flag', x: 0.704, y: -1.4, radius: 0.2 }
] satisfies Zone[];

const ARM_SPEEDS: Condition[] = [only('arm')];

export const missions: readonly MissionDefinition[] = [
    // Unit 1 - the move block (objectives from the implementation brief)
    define(1, { unitId: 1, blocks: U1, conditions: [{ type: 'moved' }] }),
    define(2, {
        unitId: 1,
        blocks: U1,
        zones: [flag(0, 0, 0.15)],
        conditions: [{ type: 'usesOnlyUnit', unit: 'rotations' }, inZone('flag')]
    }),
    define(3, {
        unitId: 1,
        blocks: U1,
        obstacles: [box(-0.33, 0.2, 0.05, 0.6), box(0.33, 0.2, 0.05, 0.6)],
        zones: [{ id: 'exit', kind: 'exit', x: 0, y: 1.4, radius: 0.2 }],
        conditions: [{ type: 'usesOnlyUnit', unit: 'seconds' }, inZone('exit')]
    }),
    define(4, {
        unitId: 1,
        blocks: U1,
        // Crate sits well past the stop flag so the upright flag sprite does not sit on the box.
        obstacles: [box(0, 1.35, 0.15, 0.15)],
        zones: [flag(0, 0.45, 0.12, 'stop')],
        conditions: [{ type: 'usesOnlyUnit', unit: 'degrees' }, inZone('stop')]
    }),
    define(5, {
        unitId: 1,
        blocks: U1,
        zones: [flag(0, 0, 0.15)],
        conditions: [inZone('flag'), { type: 'subTrials', kind: 'unit', keys: ['rotations', 'seconds', 'degrees'] }]
    }),
    define(6, {
        unitId: 1,
        blocks: U1,
        ...deadEnd,
        zones: [{ id: 'exit', kind: 'exit', x: 0, y: -1.3, radius: 0.2 }],
        conditions: [
            { type: 'usesDirection', direction: 'backward' },
            inZone('exit'),
            { type: 'headingUnchanged', tolerance: 0.1 }
        ]
    }),
    define(7, {
        unitId: 1,
        blocks: U1,
        zones: [{ id: 'box', kind: 'box', x: 0, y: 0.2, radius: 0.15 }],
        conditions: [
            { type: 'visitedZone', zone: 'box' },
            { type: 'endsNearStart', tolerance: 0.15 }
        ]
    }),

    // Unit 2 - speed and timing
    define(8, {
        unitId: 2,
        blocks: U2,
        zones: [flag(0, 0, 0.15)],
        conditions: [uses(B.setSpeed), { type: 'usesSpeedOtherThan', value: 50 }, inZone('flag')]
    }),
    define(9, {
        unitId: 2,
        blocks: U2,
        zones: [flag(0, 0, 0.15)],
        conditions: [uses(B.setSpeed), inZone('flag'), { type: 'subTrials', kind: 'speedBand', keys: ['slow', 'fast'] }]
    }),
    define(10, {
        unitId: 2,
        blocks: U2,
        zones: [flag(0, 0, 0.15)],
        conditions: [uses(B.startMove), uses(B.wait), uses(B.stop), inZone('flag')]
    }),
    define(11, {
        unitId: 2,
        blocks: U2,
        obstacles: [box(0, 1.35, 0.15, 0.15)],
        zones: [flag(0, 0.45, 0.12, 'stop')],
        conditions: [uses(B.startMove), uses(B.wait), uses(B.stop), inZone('stop')]
    }),

    // Unit 3 - steering and turning
    define(12, {
        unitId: 3,
        blocks: U3,
        zones: [flag(0.416, -0.585)],
        conditions: [uses(B.steerFor), inZone('flag')]
    }),
    define(13, {
        unitId: 3,
        blocks: U3,
        zones: [flag(0.586, -0.974)],
        conditions: [uses(B.steerFor), inZone('flag')]
    }),
    define(14, {
        unitId: 3,
        blocks: U3,
        zones: [flag(-0.416, -0.585)],
        conditions: [uses(B.steerFor), inZone('flag')]
    }),
    define(15, {
        unitId: 3,
        blocks: U3,
        conditions: [uses(B.steerFor), heading(Math.PI, 0.12), { type: 'endsNearStart', tolerance: 0.15 }]
    }),
    define(16, {
        unitId: 3,
        blocks: U3,
        conditions: [
            uses(B.steerFor),
            { type: 'usesOnlyUnit', unit: 'rotations' },
            heading(QUARTER, 0.1),
            { type: 'endsNearStart', tolerance: 0.15 }
        ]
    }),
    define(17, {
        unitId: 3,
        blocks: U3,
        conditions: [
            uses(B.steerFor),
            { type: 'usesOnlyUnit', unit: 'degrees' },
            heading(QUARTER, 0.1),
            { type: 'endsNearStart', tolerance: 0.15 }
        ]
    }),
    define(18, {
        unitId: 3,
        blocks: U3,
        conditions: [uses(B.steerFor), heading(-QUARTER, 0.1), { type: 'endsNearStart', tolerance: 0.15 }]
    }),

    // Unit 4 - combined movement
    define(19, {
        unitId: 4,
        blocks: U4,
        zones: [flag(0.31, -0.974)],
        conditions: [uses(B.setSpeed), { type: 'usesSpeedOtherThan', value: 50 }, uses(B.steerFor), inZone('flag')]
    }),
    define(20, {
        unitId: 4,
        blocks: U4,
        zones: [flag(0.336, -1.064)],
        conditions: [uses(B.wheelsFor), inZone('flag')]
    }),
    define(21, {
        unitId: 4,
        blocks: U4,
        zones: [flag(-0.31, -0.974)],
        conditions: [uses(B.startSteer), uses(B.wait), uses(B.stop), inZone('flag')]
    }),
    define(22, {
        unitId: 4,
        blocks: U4,
        zones: [flag(0.704, -0.696)],
        conditions: [uses(B.move), uses(B.steerFor), inZone('flag'), heading(QUARTER, 0.2)]
    }),
    define(23, {
        unitId: 4,
        blocks: U4,
        obstacles: [box(0, 0, 0.25, 0.2)],
        zones: [flag(0.704, 0.711)],
        conditions: [uses(B.steerFor), inZone('flag')]
    }),
    define(24, {
        unitId: 4,
        blocks: U4,
        zones: SQUARE,
        conditions: [
            { type: 'visitedInOrder', zones: ['b', 'c', 'd'] },
            { type: 'endsNearStart', tolerance: 0.2 },
            heading(0, 0.15)
        ]
    }),

    // Unit 5 - single motors
    define(25, { unitId: 5, blocks: U5, conditions: [only('left'), heading(QUARTER, 0.1)] }),
    define(26, { unitId: 5, blocks: U5, conditions: [only('right'), heading(-QUARTER, 0.1)] }),
    define(27, {
        unitId: 5,
        blocks: U5,
        conditions: [only('left'), { type: 'usesOnlyUnit', unit: 'rotations' }, heading(Math.PI, 0.1)]
    }),
    define(28, {
        unitId: 5,
        blocks: U5,
        conditions: [only('left'), { type: 'usesOnlyUnit', unit: 'degrees' }, heading(Math.PI / 4, 0.08)]
    }),
    define(29, {
        unitId: 5,
        blocks: U5,
        conditions: [only('left'), { type: 'usesOnlyUnit', unit: 'seconds' }, heading((3 * Math.PI) / 4, 0.1)]
    }),
    define(30, {
        unitId: 5,
        blocks: U5,
        zones: [flag(0, 0, 0.15)],
        conditions: [uses(B.motorStart), uses(B.wait), uses(B.motorStop), inZone('flag')]
    }),
    define(31, {
        unitId: 5,
        blocks: U5,
        conditions: [only('left'), { type: 'usesDirection', direction: 'backward' }, heading(-QUARTER, 0.1)]
    }),
    define(32, {
        unitId: 5,
        blocks: U5,
        ...deadEnd,
        zones: [{ id: 'exit', kind: 'exit', x: 0, y: -1.3, radius: 0.2 }],
        conditions: [
            uses(B.motorStart),
            { type: 'usesDirection', direction: 'backward' },
            inZone('exit'),
            { type: 'headingUnchanged', tolerance: 0.1 }
        ]
    }),

    // Unit 6 - motor speed
    define(33, {
        unitId: 6,
        blocks: U6,
        conditions: [
            uses(B.motorSetSpeed),
            { type: 'usesSpeedOtherThan', value: 75 },
            only('left'),
            heading(QUARTER, 0.1)
        ]
    }),
    define(34, {
        unitId: 6,
        blocks: U6,
        conditions: [
            only('left'),
            { type: 'usesOnlyUnit', unit: 'seconds' },
            { type: 'usesSpeedOtherThan', value: 75 },
            heading(Math.PI, 0.1)
        ]
    }),
    define(35, {
        unitId: 6,
        blocks: U6,
        conditions: [uses(B.motorStart), uses(B.wait), uses(B.motorStop), only('left'), heading(QUARTER * 1.05, 0.12)]
    }),
    define(36, {
        unitId: 6,
        blocks: U6,
        conditions: [
            only('left'),
            { type: 'usesOnlyUnit', unit: 'seconds' },
            { type: 'usesSpeedAtMost', value: 50 },
            heading(Math.PI, 0.1)
        ]
    }),
    define(37, {
        unitId: 6,
        blocks: U6,
        conditions: [
            uses(B.motorSetSpeed),
            only('left'),
            heading(QUARTER, 0.1),
            { type: 'subTrials', kind: 'speedBand', keys: ['slow', 'fast'] }
        ]
    }),
    define(38, {
        unitId: 6,
        blocks: U6,
        conditions: [only('right'), { type: 'usesSpeedAtMost', value: 30 }, heading(-QUARTER, 0.1)]
    }),
    define(39, {
        unitId: 6,
        blocks: U6,
        zones: [flag(0, 0, 0.15)],
        conditions: [
            uses(B.motorSetSpeed),
            uses(B.motorStart),
            uses(B.wait),
            uses(B.motorStop),
            { type: 'usesSpeedOtherThan', value: 75 },
            inZone('flag')
        ]
    }),

    // Unit 7 - applications
    define(40, {
        unitId: 7,
        blocks: U7,
        zones: [flag(0.816, -1.288)],
        conditions: [uses(B.motorFor), inZone('flag'), heading(QUARTER, 0.25)]
    }),
    define(41, {
        unitId: 7,
        blocks: U7,
        zones: [flag(-0.816, -1.288)],
        conditions: [uses(B.motorFor), inZone('flag'), heading(-QUARTER, 0.25)]
    }),
    define(42, {
        unitId: 7,
        blocks: U7,
        obstacles: gatePosts(0.46, -0.584),
        zones: [
            { id: 'gate', kind: 'gate', x: 0.46, y: -0.584, radius: 0.12 },
            { id: 'exit', kind: 'exit', x: 0.816, y: -0.584, radius: 0.15 }
        ],
        conditions: [uses(B.motorFor), { type: 'visitedInOrder', zones: ['gate', 'exit'] }, inZone('exit')]
    }),
    define(43, {
        unitId: 7,
        blocks: U7,
        obstacles: gatePosts(-0.46, -0.584),
        zones: [
            { id: 'gate', kind: 'gate', x: -0.46, y: -0.584, radius: 0.12 },
            { id: 'exit', kind: 'exit', x: -0.816, y: -0.584, radius: 0.15 }
        ],
        conditions: [uses(B.motorFor), { type: 'visitedInOrder', zones: ['gate', 'exit'] }, inZone('exit')]
    }),
    define(44, {
        unitId: 7,
        blocks: U7,
        conditions: [only('left'), { type: 'usesOnlyUnit', unit: 'degrees' }, heading((3 * Math.PI) / 4, 0.05)]
    }),
    define(45, {
        unitId: 7,
        blocks: U7,
        conditions: [...ARM_SPEEDS, { type: 'armBetween', min: 340, max: 380 }]
    }),
    define(46, {
        unitId: 7,
        blocks: U7,
        startArm: 540,
        conditions: [...ARM_SPEEDS, { type: 'armBetween', min: 160, max: 200 }]
    }),
    define(47, {
        unitId: 7,
        blocks: U7,
        conditions: [
            ...ARM_SPEEDS,
            uses(B.motorSetSpeed),
            { type: 'usesSpeedAtMost', value: 40 },
            { type: 'armBetween', min: 400, max: 460 }
        ]
    }),
    define(48, {
        unitId: 7,
        blocks: U7,
        startArm: 360,
        zones: [{ id: 'box', kind: 'box', x: 0, y: 0.2, radius: 0.15 }],
        conditions: [
            uses(B.move),
            uses(B.motorFor),
            { type: 'visitedZone', zone: 'box' },
            { type: 'armBetween', min: 0, max: 40 },
            { type: 'endsNearStart', tolerance: 0.15 }
        ]
    })
];

export const getMission = (taskId: number): MissionDefinition | undefined =>
    missions.find((m) => m.taskId === taskId) ?? gameLevels.find((m) => m.taskId === taskId);

/** Link to the mission that follows `id` (next task, or next level of the same game), if any. */
export const nextMissionHref = (id: number): string | null => {
    if (id < 1000) return id < missions.length ? `#/task/${id + 1}` : null;
    return gameLevels.some((l) => l.taskId === id + 1) ? `#/play/${id + 1}` : null;
};

export const missionText: Record<number, MissionText> = { ...taskText, ...gameLevelText };
export { text } from './mission-text.ts';
export type { MissionText };
