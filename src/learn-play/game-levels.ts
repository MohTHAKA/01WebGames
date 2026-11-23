import type { MissionText } from './mission-text.ts';
import { BLOCKS as B } from './sim/program.ts';
import type { Condition, MissionDefinition, Rect, Zone } from './sim/types.ts';

/**
 * Levels of the playable Coding Games. They reuse the mission engine (Blockly + simulation +
 * PlayCanvas arena), so each level is a MissionDefinition with an id in its own range
 * (Code Quest 1001+, Logic Maze 1101+). All of this is original game design, not curriculum text.
 */
export interface GameLevelInfo {
    id: number;
    gameId: string;
    titleEn: string;
    titleAr: string;
}

const START = { x: 0, y: -1.4, headingRadians: 0 };
const BLOCKS = [B.start, B.move, B.steerFor];

const flag = (id: string, x: number, y: number, radius = 0.2): Zone => ({ id, kind: 'flag', x, y, radius });
/** Finish marker: same shape as a flag so the arena draws the flag sprite. */
const goal = (x: number, y: number): Zone => ({ id: 'goal', kind: 'flag', x, y, radius: 0.2 });
const wall = (cx: number, cy: number, halfWidth: number, halfHeight: number): Rect => ({
    cx,
    cy,
    halfWidth,
    halfHeight
});
const inGoal: Condition = { type: 'endsInZone', zone: 'goal' };
const inOrder = (...zones: string[]): Condition => ({ type: 'visitedInOrder', zones });

/** Sensor Rush adds the distance-sensor block and requires it in every level. */
const SENSOR_BLOCKS = [...BLOCKS, B.moveUntil];
const usesSensor: Condition = { type: 'usesBlock', block: B.moveUntil };

/** Robot Arena adds speed and arm control to the basic movement blocks. */
const ARENA_BLOCKS = [...BLOCKS, B.setSpeed, B.motorFor, B.motorSetSpeed];
const usesSetSpeed: Condition = { type: 'usesBlock', block: B.setSpeed };

/** Robo Logistics adds grab/release and the arm motor. The arm starts raised, so it must be lowered to grab. */
const LOGISTICS_BLOCKS = [...BLOCKS, B.motorFor, B.grab, B.release];
/** A delivery target: the pink exit pad. */
const dropZone = (id: string, x: number, y: number): Zone => ({ id, kind: 'exit', x, y, radius: 0.25 });
const delivered = (cargo: string, zone: string): Condition => ({ type: 'cargoIn', cargo, zone });
const logistics = (
    id: number,
    cargo: { id: string; x: number; y: number }[],
    zones: Zone[],
    conditions: Condition[],
    obstacles: Rect[] = []
): MissionDefinition => level(id, zones, conditions, obstacles, LOGISTICS_BLOCKS, { cargo, startArm: 360 });

/** Pattern Builder adds the repeat block and requires it in every level. */
const PATTERN_BLOCKS = [...BLOCKS, B.repeat];
const usesRepeat: Condition = { type: 'usesBlock', block: B.repeat };
const backAtStart: Condition[] = [
    { type: 'endsNearStart', tolerance: 0.2 },
    { type: 'headingNear', radians: 0, tolerance: 0.15 }
];

const level = (
    id: number,
    zones: Zone[],
    conditions: Condition[],
    obstacles: Rect[] = [],
    allowedBlockTypes: string[] = BLOCKS,
    extra: Partial<MissionDefinition> = {}
): MissionDefinition => ({
    taskId: id,
    unitId: 0,
    mapId: `game-${id}`,
    allowedBlockTypes,
    startPose: START,
    startArm: 0,
    halfWidth: 1.2,
    halfHeight: 1.9,
    obstacles,
    zones,
    successConditions: conditions,
    ...extra
});

export const gameLevels: readonly MissionDefinition[] = [
    // Code Quest - directional puzzles
    level(1001, [goal(0, 0)], [inGoal]),
    level(1002, [goal(0.88, -0.344)], [inGoal]),
    level(
        1003,
        [flag('s1', 0, -0.696, 0.15), flag('s2', 0.704, -0.696, 0.15), goal(0.704, 0.008)],
        [inOrder('s1', 's2'), inGoal]
    ),
    level(1004, [goal(-0.704, 0.712)], [inGoal], [wall(0, -0.2, 0.3, 0.3)]),
    level(
        1005,
        [flag('s1', 0.44, -0.96, 0.15), flag('s2', 0.44, -0.52, 0.15), goal(0.88, -0.52)],
        [inOrder('s1', 's2'), inGoal]
    ),
    level(
        1006,
        [flag('b', 0, -0.696), flag('c', 0.704, -0.696), flag('d', 0.704, -1.4)],
        [
            inOrder('b', 'c', 'd'),
            { type: 'endsNearStart', tolerance: 0.2 },
            { type: 'headingNear', radians: 0, tolerance: 0.15 }
        ]
    ),

    // Logic Maze - find the way through the walls
    level(1101, [goal(0.8, 0.36)], [inGoal], [wall(-0.4, -0.35, 0.8, 0.05)]),
    level(1102, [goal(-0.704, 0.853)], [inGoal], [wall(-0.45, -0.6, 0.75, 0.05), wall(0.45, 0.2, 0.75, 0.05)]),
    level(1103, [goal(0.6, 0.5)], [inGoal], [wall(0.2, 0.1, 0.05, 1.1)]),
    level(
        1104,
        [goal(0.704, 1.416)],
        [inGoal],
        [wall(-0.4, -0.7, 0.8, 0.05), wall(0.4, 0, 0.8, 0.05), wall(-0.4, 0.7, 0.8, 0.05)]
    ),

    // Sensor Rush - stop exactly where the distance sensor says. The goal sits at the stopping spot
    // of the intended reading, so guessing a number of rotations is not the way to solve it.
    level(1201, [goal(0, 1.48)], [inGoal, usesSensor], [], SENSOR_BLOCKS),
    level(1202, [goal(0, -0.12)], [inGoal, usesSensor], [wall(0, 0.6, 0.35, 0.35)], SENSOR_BLOCKS),
    level(1203, [goal(0.78, 1.48)], [inGoal, usesSensor], [], SENSOR_BLOCKS),
    level(1204, [goal(0.78, 1.48)], [inGoal, usesSensor], [wall(-0.35, 0.4, 0.85, 0.05)], SENSOR_BLOCKS),

    // Pattern Builder - find the part that repeats and put it in a repeat block.
    level(
        1301,
        [flag('b', 0, -0.696), flag('c', 0.704, -0.696), flag('d', 0.704, -1.4)],
        [inOrder('b', 'c', 'd'), ...backAtStart, usesRepeat],
        [],
        PATTERN_BLOCKS
    ),
    level(
        1302,
        [flag('s1', 0.352, -1.048), flag('s2', 0.704, -0.696), goal(1.056, -0.344)],
        [inOrder('s1', 's2'), inGoal, { type: 'headingNear', radians: 0, tolerance: 0.15 }, usesRepeat],
        [],
        PATTERN_BLOCKS
    ),
    level(
        1303,
        [flag('b', 0, -0.344), flag('c', 1.056, -0.344), flag('d', 1.056, -1.4)],
        [inOrder('b', 'c', 'd'), ...backAtStart, usesRepeat],
        [wall(0.528, -0.872, 0.25, 0.25)],
        PATTERN_BLOCKS
    ),
    level(1304, [flag('far', 0.85, -1.048, 0.15)], [inOrder('far'), ...backAtStart, usesRepeat], [], PATTERN_BLOCKS),

    // Robo Logistics - lower the arm, grab the crate, carry it to the pink pad and let go.
    logistics(1501, [{ id: 'c1', x: 0, y: -0.35 }], [dropZone('t1', 0, 1.2)], [delivered('c1', 't1')]),
    logistics(1502, [{ id: 'c1', x: 0, y: -0.35 }], [dropZone('t1', 0.88, 0.7)], [delivered('c1', 't1')]),
    logistics(
        1503,
        [{ id: 'a', x: 0, y: -1.0 }],
        [dropZone('t1', 0.8, 1.0)],
        [delivered('a', 't1')],
        [wall(-0.4, -0.35, 0.8, 0.05)]
    ),
    logistics(
        1504,
        [
            { id: 'a', x: -0.6, y: -0.4 },
            { id: 'b', x: 0.6, y: -0.4 }
        ],
        [dropZone('ta', -0.6, 1.0), dropZone('tb', 0.6, 1.0)],
        [delivered('a', 'ta'), delivered('b', 'tb')]
    ),

    // Robot Arena - skill challenges: beat the clock, squeeze through gaps, work the arm.
    level(1401, [goal(0, 1.4)], [inGoal, usesSetSpeed, { type: 'withinSeconds', seconds: 5 }], [], ARENA_BLOCKS),
    level(
        1402,
        [goal(0.3, 1.2)],
        [inGoal],
        [wall(-0.535, -0.2, 0.665, 0.05), wall(0.835, -0.2, 0.365, 0.05)],
        ARENA_BLOCKS
    ),
    level(
        1403,
        [{ id: 'b', kind: 'box', x: 0, y: 0.008, radius: 0.2 }],
        [
            { type: 'visitedZone', zone: 'b' },
            { type: 'armBetween', min: 520, max: 560 },
            { type: 'endsNearStart', tolerance: 0.2 },
            { type: 'withinSeconds', seconds: 10 }
        ],
        [],
        ARENA_BLOCKS
    ),
    level(
        1404,
        [goal(0.704, 1.416)],
        [inGoal, usesSetSpeed, { type: 'withinSeconds', seconds: 13 }],
        [wall(-0.4, -0.7, 0.8, 0.05), wall(0.4, 0, 0.8, 0.05), wall(-0.4, 0.7, 0.8, 0.05)],
        ARENA_BLOCKS
    )
];

export const gameLevelInfo: readonly GameLevelInfo[] = [
    { id: 1001, gameId: 'code-quest', titleEn: 'First flag', titleAr: 'العلم الأول' },
    { id: 1002, gameId: 'code-quest', titleEn: 'Turn the corner', titleAr: 'انعطف عند الزاوية' },
    { id: 1003, gameId: 'code-quest', titleEn: 'Two flags', titleAr: 'علمان' },
    { id: 1004, gameId: 'code-quest', titleEn: 'Around the crate', titleAr: 'حول الصندوق' },
    { id: 1005, gameId: 'code-quest', titleEn: 'Staircase', titleAr: 'الدرج' },
    { id: 1006, gameId: 'code-quest', titleEn: 'Flag lap', titleAr: 'دورة الأعلام' },
    { id: 1101, gameId: 'logic-maze', titleEn: 'Gap in the wall', titleAr: 'الفتحة في الجدار' },
    { id: 1102, gameId: 'logic-maze', titleEn: 'S-bend', titleAr: 'المنعطف S' },
    { id: 1103, gameId: 'logic-maze', titleEn: 'Around the pillar', titleAr: 'حول العمود' },
    { id: 1104, gameId: 'logic-maze', titleEn: 'Zigzag', titleAr: 'متعرّج' },
    { id: 1201, gameId: 'sensor-rush', titleEn: 'Stop at the wall', titleAr: 'توقف عند الجدار' },
    { id: 1202, gameId: 'sensor-rush', titleEn: 'Brake before the crate', titleAr: 'افرمل قبل الصندوق' },
    { id: 1203, gameId: 'sensor-rush', titleEn: 'Park in the corner', titleAr: 'اركن في الزاوية' },
    { id: 1204, gameId: 'sensor-rush', titleEn: 'Sensor slalom', titleAr: 'متعرّج بالحساس' },
    { id: 1301, gameId: 'pattern-builder', titleEn: 'Square lap', titleAr: 'دورة مربعة' },
    { id: 1302, gameId: 'pattern-builder', titleEn: 'Climb the steps', titleAr: 'اصعد الدرجات' },
    { id: 1303, gameId: 'pattern-builder', titleEn: 'Lap around the pillar', titleAr: 'دورة حول العمود' },
    { id: 1304, gameId: 'pattern-builder', titleEn: 'The octagon', titleAr: 'المثمّن' },
    { id: 1501, gameId: 'robo-logistics', titleEn: 'First delivery', titleAr: 'أول توصيل' },
    { id: 1502, gameId: 'robo-logistics', titleEn: 'Around the corner', titleAr: 'عند الزاوية' },
    { id: 1503, gameId: 'robo-logistics', titleEn: 'Past the wall', titleAr: 'عبر الجدار' },
    { id: 1504, gameId: 'robo-logistics', titleEn: 'Double delivery', titleAr: 'توصيل مزدوج' },
    { id: 1401, gameId: 'robot-arena', titleEn: 'Speed dash', titleAr: 'اندفاع السرعة' },
    { id: 1402, gameId: 'robot-arena', titleEn: 'Tight squeeze', titleAr: 'الممر الضيق' },
    { id: 1403, gameId: 'robot-arena', titleEn: 'Arm run', titleAr: 'مهمة الذراع' },
    { id: 1404, gameId: 'robot-arena', titleEn: 'Grand prix', titleAr: 'الجائزة الكبرى' }
];

type Pair = [en: string, ar: string];
const t = (instruction: Pair, hint1: Pair, hint2: Pair): MissionText => ({
    instructions: { en: instruction[0], ar: instruction[1] },
    hints: { en: [hint1[0], hint2[0]], ar: [hint1[1], hint2[1]] }
});

const SPIN = 'Steer 100 for 0.5 rotations spins the robot 90 degrees in place (negative turns left).';
const SPIN_AR = 'التوجيه 100 لمدة 0.5 دورة يدير الروبوت 90 درجة في مكانه (السالب لليسار).';

export const gameLevelText: Record<number, MissionText> = {
    1001: t(
        ['Drive straight to the pink-and-cyan flag.', 'قُد بخط مستقيم إلى العلم.'],
        ['One rotation moves the robot about 0.35 m.', 'الدورة الواحدة تحرك الروبوت نحو 0.35 م.'],
        ['The flag is 4 rotations ahead.', 'العلم أمامك بمقدار 4 دورات.']
    ),
    1002: t(
        ['Drive up, turn right and reach the goal.', 'قُد للأعلى ثم انعطف يمينًا ووصل إلى الهدف.'],
        [SPIN, SPIN_AR],
        ['Move 3 rotations, turn right, then move 2.5 rotations.', 'تحرك 3 دورات ثم انعطف يمينًا ثم تحرك 2.5 دورة.']
    ),
    1003: t(
        ['Pass both flags in order, then stop at the goal.', 'مرّ بالعلمين بالترتيب ثم توقف عند الهدف.'],
        [SPIN, SPIN_AR],
        ['Move 2, turn right, move 2, turn left, move 2.', 'تحرك 2 ثم انعطف يمينًا ثم تحرك 2 ثم انعطف يسارًا ثم تحرك 2.']
    ),
    1004: t(
        [
            'The crate blocks the way. Go around its left side to the goal.',
            'الصندوق يسد الطريق. دُر حول جانبه الأيسر إلى الهدف.'
        ],
        [SPIN, SPIN_AR],
        ['Move 2, turn left, move 2, turn right, move 4.', 'تحرك 2 ثم انعطف يسارًا ثم تحرك 2 ثم انعطف يمينًا ثم تحرك 4.']
    ),
    1005: t(
        [
            'Climb the staircase: pass both flags in order, then reach the goal.',
            'اصعد الدرج: مرّ بالعلمين بالترتيب ثم صل إلى الهدف.'
        ],
        ['Every step is the same: move 1.25 rotations, then turn.', 'كل درجة متشابهة: تحرك 1.25 دورة ثم انعطف.'],
        ['Right, left, right: three turns in all.', 'يمين ثم يسار ثم يمين: ثلاث انعطافات.']
    ),
    1006: t(
        [
            'Fly a lap: pass the three flags in order and come back to the start facing forward.',
            'أنجز دورة: مرّ بالأعلام الثلاثة بالترتيب وعد إلى البداية مواجهًا للأمام.'
        ],
        ['A lap has four equal sides and four right turns.', 'الدورة لها أربعة أضلاع متساوية وأربع انعطافات يمينًا.'],
        ['Repeat 4 times: move 2 rotations, then turn right.', 'كرر 4 مرات: تحرك دورتين ثم انعطف يمينًا.']
    ),
    1101: t(
        ['Find the gap in the wall and reach the goal beyond it.', 'ابحث عن الفتحة في الجدار ووصل إلى الهدف خلفه.'],
        ['The gap is on the right side of the wall.', 'الفتحة على الجانب الأيمن من الجدار.'],
        [
            'Move 2, turn right, move 2.27, turn left, move 3.',
            'تحرك 2 ثم انعطف يمينًا ثم تحرك 2.27 ثم انعطف يسارًا ثم تحرك 3.'
        ]
    ),
    1102: t(
        ['Wind through the S-shaped maze to the goal.', 'اعبر المتاهة على شكل S إلى الهدف.'],
        ['The first wall blocks the left, so start by going right.', 'الجدار الأول يسد اليسار، فابدأ بالذهاب يمينًا.'],
        [
            'Turn right, move 2, turn left, move 3.4, turn left, move 4, turn right, move 3.',
            'انعطف يمينًا ثم تحرك 2 ثم يسارًا ثم تحرك 3.4 ثم يسارًا ثم تحرك 4 ثم يمينًا ثم تحرك 3.'
        ]
    ),
    1103: t(
        [
            'Go all the way around the pillar to reach the goal on the other side.',
            'دُر حول العمود بالكامل لتصل إلى الهدف في الجانب الآخر.'
        ],
        ['The pillar is long, so first go past its top end.', 'العمود طويل، لذا تجاوز طرفه العلوي أولًا.'],
        [
            'Move 8, turn right, move 1.7, turn right, move 2.6.',
            'تحرك 8 ثم انعطف يمينًا ثم تحرك 1.7 ثم انعطف يمينًا ثم تحرك 2.6.'
        ]
    ),
    1104: t(
        ['Follow the zigzag corridors up to the goal.', 'اتبع الممرات المتعرجة صعودًا إلى الهدف.'],
        ['Each wall has a gap on alternating sides.', 'لكل جدار فتحة على جانب متبادل.'],
        [
            'Turn right, move 2, turn left, move 3, turn left, move 4, turn right, move 2, turn right, move 4, turn left, move 3.',
            'يمينًا، تحرك 2، يسارًا، تحرك 3، يسارًا، تحرك 4، يمينًا، تحرك 2، يمينًا، تحرك 4، يسارًا، تحرك 3.'
        ]
    ),
    1201: t(
        [
            'Use the distance sensor: drive up and stop 30 cm before the wall, on the flag.',
            'استخدم حساس المسافة: قُد للأعلى وتوقف قبل الجدار بـ30 سم عند العلم.'
        ],
        [
            'Use the "drive forward until the distance ahead is at most" block from Sensing.',
            'استخدم كتلة "تحرك للأمام حتى تصبح المسافة أمامك" من الاستشعار.'
        ],
        ['Set the distance to 30 cm.', 'اضبط المسافة على 30 سم.']
    ),
    1202: t(
        ['Brake 25 cm before the crate and stop on the flag.', 'افرمل على بعد 25 سم من الصندوق وتوقف عند العلم.'],
        [
            'The sensor looks straight ahead and measures the free space to the crate.',
            'الحساس ينظر للأمام مباشرة ويقيس المسافة الحرة إلى الصندوق.'
        ],
        ['Set the distance to 25 cm.', 'اضبط المسافة على 25 سم.']
    ),
    1203: t(
        [
            'Park in the top-right corner: stop 30 cm from the top wall, turn right, then stop 30 cm from the right wall.',
            'اركن في الزاوية العلوية اليمنى: توقف على بعد 30 سم من الجدار العلوي ثم انعطف يمينًا وتوقف على بعد 30 سم من الجدار الأيمن.'
        ],
        [SPIN, SPIN_AR],
        ['Two sensor blocks with a turn between them.', 'كتلتا حساس بينهما انعطاف.']
    ),
    1204: t(
        [
            'The wall has a gap on the right. Stop 20 cm before it, slide right to 30 cm from the side wall, then turn up to the top wall.',
            'في الجدار فتحة على اليمين. توقف على بعد 20 سم منه ثم اتجه يمينًا حتى 30 سم من الجدار الجانبي ثم اصعد إلى الجدار العلوي.'
        ],
        [SPIN, SPIN_AR],
        [
            'Sensor 20, turn right, sensor 30, turn left, sensor 30.',
            'حساس 20 ثم انعطف يمينًا ثم حساس 30 ثم انعطف يسارًا ثم حساس 30.'
        ]
    ),
    1301: t(
        [
            'Fly a square lap with a repeat block: pass the three flags in order and return to the start facing forward.',
            'أنجز دورة مربعة بكتلة التكرار: مرّ بالأعلام الثلاثة بالترتيب وعد إلى البداية مواجهًا للأمام.'
        ],
        [
            'A square is the same step four times: move, then turn right.',
            'المربع هو الخطوة نفسها أربع مرات: تحرك ثم انعطف يمينًا.'
        ],
        [
            'Repeat 4 times: move 2 rotations, steer 100 for 0.5 rotations.',
            'كرر 4 مرات: تحرك دورتين ثم وجّه 100 لمدة 0.5 دورة.'
        ]
    ),
    1302: t(
        [
            'Climb the steps: pass both flags in order and reach the goal, facing forward, using a repeat block.',
            'اصعد الدرجات: مرّ بالعلمين بالترتيب ثم صل إلى الهدف مواجهًا للأمام باستخدام كتلة التكرار.'
        ],
        [
            'One step is: up, turn right, across, turn left.',
            'الدرجة الواحدة: للأعلى ثم انعطاف يمينًا ثم جانبًا ثم انعطاف يسارًا.'
        ],
        [
            'Repeat 3 times: move 1, turn right, move 1, turn left.',
            'كرر 3 مرات: تحرك 1 ثم انعطف يمينًا ثم تحرك 1 ثم انعطف يسارًا.'
        ]
    ),
    1303: t(
        [
            'Patrol around the pillar with a repeat block and come back to the start facing forward.',
            'قم بدورية حول العمود بكتلة التكرار وعد إلى البداية مواجهًا للأمام.'
        ],
        ['The lap is a square with 3-rotation sides.', 'الدورة مربع طول ضلعه 3 دورات.'],
        ['Repeat 4 times: move 3 rotations, turn right.', 'كرر 4 مرات: تحرك 3 دورات ثم انعطف يمينًا.']
    ),
    1304: t(
        [
            'Draw an octagon: pass the far flag, come back to the start and face forward. Use a repeat block.',
            'ارسم مثمّنًا: مرّ بالعلم البعيد ثم عد إلى البداية مواجهًا للأمام. استخدم كتلة التكرار.'
        ],
        [
            'An octagon has 8 equal sides and 8 turns of 45 degrees. Steer 100 for 0.25 rotations turns 45 degrees.',
            'للمثمّن 8 أضلاع متساوية و8 انعطافات كل منها 45 درجة. التوجيه 100 لمدة 0.25 دورة يدير 45 درجة.'
        ],
        [
            'Repeat 8 times: move 1 rotation, steer 100 for 0.25 rotations.',
            'كرر 8 مرات: تحرك دورة واحدة ثم وجّه 100 لمدة 0.25 دورة.'
        ]
    ),
    1501: t(
        [
            'Deliver the crate to the pink pad: lower the arm, drive to the crate, grab it, carry it to the pad and release it.',
            'سلّم الصندوق إلى المنصة الوردية: اخفض الذراع وقُد إلى الصندوق وأمسكه وانقله إلى المنصة ثم اتركه.'
        ],
        [
            'The arm starts raised. Lower it first with the arm motor (360 degrees is 1 rotation).',
            'تبدأ الذراع مرفوعة. اخفضها أولًا بمحرك الذراع (360 درجة تساوي دورة واحدة).'
        ],
        ['Lower the arm, move 2.5, grab, move 4.3, release.', 'اخفض الذراع ثم تحرك 2.5 ثم أمسك ثم تحرك 4.3 ثم اترك.']
    ),
    1502: t(
        [
            'The pad is up and to the right. Carry the crate there and put it down.',
            'المنصة في الأعلى جهة اليمين. انقل الصندوق إليها وضعه.'
        ],
        [
            'The crate rides 20 cm in front of the robot, so turn with it still held.',
            'يسير الصندوق على بعد 20 سم أمام الروبوت، فانعطف وهو ما زال ممسوكًا.'
        ],
        [
            'After the grab: turn right, move 2.5, turn left, move 2.9, release.',
            'بعد الإمساك: انعطف يمينًا ثم تحرك 2.5 ثم يسارًا ثم تحرك 2.9 ثم اترك.'
        ]
    ),
    1503: t(
        [
            'A wall splits the arena. Carry the crate through the gap on the right to the pad.',
            'جدار يقسم الساحة. انقل الصندوق عبر الفتحة على اليمين إلى المنصة.'
        ],
        [
            'Grab the crate first, then go around the end of the wall. The crate does not collide, only the robot does.',
            'أمسك الصندوق أولًا ثم دُر حول طرف الجدار. الصندوق لا يصطدم، الروبوت فقط هو الذي يصطدم.'
        ],
        [
            'Lower the arm, move 0.7, grab, turn right, move 2.3, turn left, move 5.5, release.',
            'اخفض الذراع ثم تحرك 0.7 ثم أمسك ثم انعطف يمينًا ثم تحرك 2.3 ثم يسارًا ثم تحرك 5.5 ثم اترك.'
        ]
    ),
    1504: t(
        [
            'Two crates, two pads: put each crate on the pad in its own column.',
            'صندوقان ومنصتان: ضع كل صندوق على المنصة الموجودة في عموده.'
        ],
        [
            'Deliver the left crate first, then come back down and deliver the right one.',
            'سلّم الصندوق الأيسر أولًا ثم عد للأسفل وسلّم الأيمن.'
        ],
        [
            'Moving backward is a good way to return to the start line without turning around.',
            'القيادة للخلف طريقة جيدة للعودة إلى خط البداية دون الاستدارة.'
        ]
    ),
    1401: t(
        [
            'Beat the clock: reach the flag in 5 seconds or less. Raise the speed with the set-speed block.',
            'تفوّق على الوقت: صل إلى العلم خلال 5 ثوانٍ أو أقل. ارفع السرعة بكتلة ضبط السرعة.'
        ],
        [
            'At 50% speed the robot makes 1 wheel rotation per second; at 100% it makes 2.',
            'بسرعة 50% يدور العجل دورة في الثانية، وبسرعة 100% يدور دورتين.'
        ],
        ['Set speed to 100, then move about 7.95 rotations.', 'اضبط السرعة على 100 ثم تحرك نحو 7.95 دورة.']
    ),
    1402: t(
        [
            'Squeeze through the narrow gap in the wall and reach the flag. There is only a few centimeters to spare.',
            'مرّ عبر الفتحة الضيقة في الجدار ثم صل إلى العلم. الهامش بضعة سنتيمترات فقط.'
        ],
        [
            'The gap is 0.3 m to the right of the start. A spin on the spot keeps the robot in place.',
            'الفتحة على بعد 0.3 م يمين البداية. الدوران في المكان يبقي الروبوت في موضعه.'
        ],
        ['Turn right, move 0.85, turn left, move 7.4.', 'انعطف يمينًا ثم تحرك 0.85 ثم انعطف يسارًا ثم تحرك 7.4.']
    ),
    1403: t(
        [
            'Drive to the crate, raise the arm to about 540 degrees and bring the robot back to the start, all within 10 seconds.',
            'قُد إلى الصندوق ثم ارفع الذراع إلى نحو 540 درجة وأعد الروبوت إلى البداية، كل ذلك خلال 10 ثوانٍ.'
        ],
        [
            'Use the motor block on the arm: 1.5 rotations is 540 degrees.',
            'استخدم كتلة المحرك على الذراع: 1.5 دورة تساوي 540 درجة.'
        ],
        [
            'Move 4, arm forward 1.5 rotations, move back 4. Raise the speed if you are short on time.',
            'تحرك 4 ثم الذراع للأمام 1.5 دورة ثم ارجع 4. ارفع السرعة إن ضاق الوقت.'
        ]
    ),
    1404: t(
        [
            'Grand prix: follow the zigzag corridors to the goal in 13 seconds or less.',
            'الجائزة الكبرى: اتبع الممرات المتعرجة إلى الهدف خلال 13 ثانية أو أقل.'
        ],
        [
            'The route is the same as the Logic Maze zigzag, but you must be fast.',
            'المسار هو نفسه متعرّج متاهة المنطق، لكن عليك أن تكون سريعًا.'
        ],
        [
            'Set speed to 100 first. Turns are measured in wheel rotations, so they stay the same.',
            'اضبط السرعة على 100 أولًا. الانعطاف يُقاس بدورات العجلة فلا يتغير.'
        ]
    )
};
