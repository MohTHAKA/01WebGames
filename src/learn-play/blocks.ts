import * as Blockly from 'blockly';

import type { Lang } from './curriculum.ts';
import { mt } from './mission-i18n.ts';
import type { MissionStringKey } from './mission-i18n.ts';
import { LIMITS, SENSOR_MAX_CM, SENSOR_MIN_CM } from './sim/calibration.ts';
import { BLOCKS, START_BLOCK } from './sim/program.ts';
import type { WorkspaceState } from './sim/program.ts';

type Field = Blockly.Field;

/** Custom robot blocks, inspired functionally by block-based robot programming; no third-party artwork. */
const registerBlocks = (lang: Lang): void => {
    const L = (key: MissionStringKey): string => mt(lang, key);

    const num = (value: number, min: number, max: number, step = 1): Field =>
        new Blockly.FieldNumber(value, min, max, step);
    const direction = (): Field =>
        new Blockly.FieldDropdown([
            [L('dir_forward'), 'forward'],
            [L('dir_backward'), 'backward']
        ]);
    const unit = (): Field =>
        new Blockly.FieldDropdown([
            [L('unit_rotations'), 'rotations'],
            [L('unit_seconds'), 'seconds'],
            [L('unit_degrees'), 'degrees']
        ]);
    const motor = (withAll = false): Field =>
        new Blockly.FieldDropdown([
            [L('motor_left'), 'left'],
            [L('motor_right'), 'right'],
            [L('motor_arm'), 'arm'],
            ...(withAll ? ([[L('motor_all'), 'all']] as [string, string][]) : [])
        ]);
    const amount = (): Field => num(1, 0, LIMITS.maxDegrees, 0.1);
    const percent = (def: number): Field => num(def, 0, 100);
    const signed = (def: number): Field => num(def, -100, 100);

    /** Registers a statement block whose inputs are a list of text labels and named fields. */
    const define = (
        type: string,
        colour: number,
        parts: readonly (string | [name: string, field: () => Field])[]
    ): void => {
        Blockly.Blocks[type] = {
            init(this: Blockly.Block) {
                const input = this.appendDummyInput();
                for (const part of parts) {
                    if (typeof part === 'string') input.appendField(part);
                    else input.appendField(part[1](), part[0]);
                }
                this.setPreviousStatement(true);
                this.setNextStatement(true);
                this.setColour(colour);
            }
        };
    };

    Blockly.Blocks[BLOCKS.start] = {
        init(this: Blockly.Block) {
            this.appendDummyInput().appendField(L('blk_start'));
            this.setNextStatement(true);
            this.setColour(45);
        }
    };

    define(BLOCKS.move, 260, [
        L('blk_move'),
        ['DIRECTION', direction],
        L('blk_by'),
        ['AMOUNT', amount],
        ['UNIT', unit]
    ]);
    Blockly.Blocks[BLOCKS.repeat] = {
        init(this: Blockly.Block) {
            this.appendDummyInput()
                .appendField(L('blk_repeat'))
                .appendField(num(4, 1, LIMITS.maxRepeat, 1), 'TIMES')
                .appendField(L('blk_times'));
            this.appendStatementInput('DO');
            this.setPreviousStatement(true);
            this.setNextStatement(true);
            this.setColour(120);
        }
    };
    define(BLOCKS.moveUntil, 200, [
        L('blk_move_until'),
        ['DISTANCE', () => num(20, SENSOR_MIN_CM, SENSOR_MAX_CM, 1)],
        L('blk_cm')
    ]);
    define(BLOCKS.setSpeed, 260, [L('blk_set_speed'), ['SPEED', () => percent(50)], '%']);
    define(BLOCKS.startMove, 260, [L('blk_start_move'), ['DIRECTION', direction]]);
    define(BLOCKS.stop, 260, [L('blk_stop')]);
    define(BLOCKS.steerFor, 260, [
        L('blk_steer_for'),
        ['STEERING', () => signed(10)],
        L('blk_for'),
        ['AMOUNT', amount],
        ['UNIT', unit]
    ]);
    define(BLOCKS.startSteer, 260, [L('blk_start_steer'), ['STEERING', () => signed(10)]]);
    define(BLOCKS.wheels, 260, [
        L('blk_wheels'),
        L('blk_left'),
        ['LEFT', () => signed(50)],
        L('blk_right'),
        ['RIGHT', () => signed(50)]
    ]);
    define(BLOCKS.wheelsFor, 260, [
        L('blk_wheels_for'),
        L('blk_left'),
        ['LEFT', () => signed(50)],
        L('blk_right'),
        ['RIGHT', () => signed(50)],
        L('blk_for'),
        ['AMOUNT', amount],
        ['UNIT', unit]
    ]);
    define(BLOCKS.wait, 120, [L('blk_wait'), ['SECONDS', () => num(1, 0, LIMITS.maxSeconds, 0.1)], L('blk_seconds')]);
    define(BLOCKS.motorFor, 20, [
        L('blk_motor'),
        ['MOTOR', () => motor()],
        ['DIRECTION', direction],
        L('blk_by'),
        ['AMOUNT', amount],
        ['UNIT', unit]
    ]);
    define(BLOCKS.motorSetSpeed, 20, [
        L('blk_motor_set_speed'),
        ['MOTOR', () => motor()],
        L('blk_to'),
        ['SPEED', () => percent(75)],
        '%'
    ]);
    define(BLOCKS.motorStart, 20, [L('blk_motor_start'), ['MOTOR', () => motor()], ['DIRECTION', direction]]);
    define(BLOCKS.grab, 20, [L('blk_grab')]);
    define(BLOCKS.release, 20, [L('blk_release')]);
    define(BLOCKS.motorStop, 20, [L('blk_motor_stop'), ['MOTOR', () => motor(true)]]);
};

/** Toolbox entries in display order; each block lists the help string shown on the mission page. */
interface ToolboxBlock {
    type: string;
    fields?: Record<string, string | number>;
    help: MissionStringKey;
    label: MissionStringKey;
}

const CATEGORIES: readonly { name: MissionStringKey; colour: string; blocks: ToolboxBlock[] }[] = [
    {
        name: 'cat_events',
        colour: '45',
        blocks: [{ type: BLOCKS.start, help: 'help_start', label: 'blk_start' }]
    },
    {
        name: 'cat_movement',
        colour: '260',
        blocks: [
            {
                type: BLOCKS.move,
                fields: { DIRECTION: 'forward', AMOUNT: 1, UNIT: 'rotations' },
                help: 'help_move',
                label: 'blk_move'
            },
            { type: BLOCKS.setSpeed, fields: { SPEED: 50 }, help: 'help_set_speed', label: 'blk_set_speed' },
            {
                type: BLOCKS.startMove,
                fields: { DIRECTION: 'forward' },
                help: 'help_start_move',
                label: 'blk_start_move'
            },
            {
                type: BLOCKS.steerFor,
                fields: { STEERING: 10, AMOUNT: 1, UNIT: 'rotations' },
                help: 'help_steer_for',
                label: 'blk_steer_for'
            },
            {
                type: BLOCKS.startSteer,
                fields: { STEERING: 10 },
                help: 'help_start_steer',
                label: 'blk_start_steer'
            },
            {
                type: BLOCKS.wheelsFor,
                fields: { LEFT: 50, RIGHT: 50, AMOUNT: 1, UNIT: 'rotations' },
                help: 'help_wheels_for',
                label: 'blk_wheels_for'
            },
            {
                type: BLOCKS.wheels,
                fields: { LEFT: 50, RIGHT: 50 },
                help: 'help_wheels',
                label: 'blk_wheels'
            },
            { type: BLOCKS.stop, help: 'help_stop', label: 'blk_stop' }
        ]
    },
    {
        name: 'cat_motors',
        colour: '20',
        blocks: [
            {
                type: BLOCKS.motorFor,
                fields: { MOTOR: 'left', DIRECTION: 'forward', AMOUNT: 1, UNIT: 'rotations' },
                help: 'help_motor_for',
                label: 'blk_motor'
            },
            {
                type: BLOCKS.motorSetSpeed,
                fields: { MOTOR: 'left', SPEED: 75 },
                help: 'help_motor_set_speed',
                label: 'blk_motor_set_speed'
            },
            {
                type: BLOCKS.motorStart,
                fields: { MOTOR: 'left', DIRECTION: 'forward' },
                help: 'help_motor_start',
                label: 'blk_motor_start'
            },
            {
                type: BLOCKS.motorStop,
                fields: { MOTOR: 'left' },
                help: 'help_motor_stop',
                label: 'blk_motor_stop'
            },
            { type: BLOCKS.grab, help: 'help_grab', label: 'blk_grab' },
            { type: BLOCKS.release, help: 'help_release', label: 'blk_release' }
        ]
    },
    {
        name: 'cat_sensing',
        colour: '200',
        blocks: [
            {
                type: BLOCKS.moveUntil,
                fields: { DISTANCE: 20 },
                help: 'help_move_until',
                label: 'blk_move_until'
            }
        ]
    },
    {
        name: 'cat_control',
        colour: '120',
        blocks: [
            { type: BLOCKS.repeat, fields: { TIMES: 4 }, help: 'help_repeat', label: 'blk_repeat' },
            { type: BLOCKS.wait, fields: { SECONDS: 1 }, help: 'help_wait', label: 'blk_wait' }
        ]
    }
];

/** Help entries (label + description) for the blocks a mission allows. */
export const helpEntries = (allowed: readonly string[]): ToolboxBlock[] =>
    CATEGORIES.flatMap((c) => c.blocks).filter((b) => allowed.includes(b.type));

const toolbox = (lang: Lang, allowed: readonly string[]): Blockly.utils.toolbox.ToolboxDefinition => {
    const contents: Blockly.utils.toolbox.ToolboxItemInfo[] = [];
    for (const cat of CATEGORIES) {
        const blocks = cat.blocks.filter((b) => allowed.includes(b.type));
        if (blocks.length === 0) continue;
        contents.push({
            kind: 'category',
            name: mt(lang, cat.name),
            colour: cat.colour,
            contents: blocks.map((b) => ({ kind: 'block', type: b.type, ...(b.fields ? { fields: b.fields } : {}) }))
        });
    }
    return { kind: 'categoryToolbox', contents };
};
export const initialState = (): WorkspaceState => ({
    blocks: { blocks: [{ type: START_BLOCK, x: 24, y: 24, deletable: false } as never] }
});

export const createWorkspace = async (
    host: HTMLElement,
    lang: Lang,
    allowed: readonly string[],
    saved: unknown
): Promise<Blockly.WorkspaceSvg> => {
    const msgs = lang === 'ar' ? await import('blockly/msg/ar') : await import('blockly/msg/en');
    Blockly.setLocale(msgs as unknown as Record<string, string>);
    registerBlocks(lang);

    const workspace = Blockly.inject(host, {
        toolbox: toolbox(lang, allowed),
        rtl: lang === 'ar',
        trashcan: true,
        zoom: { controls: true, wheel: false, startScale: 0.9, minScale: 0.5, maxScale: 1.5 },
        move: { scrollbars: true, drag: true, wheel: true },
        grid: { spacing: 24, length: 24, colour: '#b4bac2', snap: true },
        sounds: false
    });

    const state = (saved ?? initialState()) as object;
    try {
        Blockly.serialization.workspaces.load(state, workspace);
    } catch {
        Blockly.serialization.workspaces.load(initialState(), workspace);
    }
    if (!workspace.getTopBlocks(false).some((b) => b.type === START_BLOCK)) {
        Blockly.serialization.workspaces.load(initialState(), workspace);
    }
    return workspace;
};

export const saveState = (workspace: Blockly.Workspace): WorkspaceState =>
    Blockly.serialization.workspaces.save(workspace) as WorkspaceState;
