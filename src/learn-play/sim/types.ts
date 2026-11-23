/** World units are meters. x grows right, y grows up the screen. heading 0 faces +y and grows clockwise. */
export interface RobotPose {
    x: number;
    y: number;
    headingRadians: number;
}

export type MoveUnit = 'rotations' | 'seconds' | 'degrees';
export type MoveDirection = 'forward' | 'backward';
export type MotorId = 'left' | 'right' | 'arm';

/** Timed drive: both wheels run at the given signed speeds (-100..100) for `amount` of `unit`. */
export interface DriveCommand {
    type: 'drive';
    blockId: string;
    left: number;
    right: number;
    amount: number;
    unit: MoveUnit;
}

/** Timed single-motor run. */
export interface MotorForCommand {
    type: 'motorFor';
    blockId: string;
    motor: MotorId;
    speed: number;
    amount: number;
    unit: MoveUnit;
}

/** Continuous change: motors left undefined keep their current speed. Zero stops a motor. */
export interface RunCommand {
    type: 'run';
    blockId: string;
    left?: number;
    right?: number;
    arm?: number;
}

export interface WaitCommand {
    type: 'wait';
    blockId: string;
    seconds: number;
}

/** Drives forward at the given speeds until the distance sensor reads `distanceCm` or less. */
export interface DriveUntilCommand {
    type: 'driveUntil';
    blockId: string;
    left: number;
    right: number;
    distanceCm: number;
}

/** Instant: closes the gripper on the nearest cargo within reach (the arm must be lowered). */
export interface GrabCommand {
    type: 'grab';
    blockId: string;
}

/** Instant: puts the carried cargo down in front of the robot. */
export interface ReleaseCommand {
    type: 'release';
    blockId: string;
}

export type Command =
    DriveCommand | MotorForCommand | RunCommand | WaitCommand | DriveUntilCommand | GrabCommand | ReleaseCommand;

/** A crate the robot can pick up and carry. */
export interface Cargo {
    id: string;
    x: number;
    y: number;
}

export interface Rect {
    cx: number;
    cy: number;
    halfWidth: number;
    halfHeight: number;
}

export interface Zone {
    id: string;
    kind: 'flag' | 'box' | 'exit' | 'gate';
    x: number;
    y: number;
    radius: number;
}

export type TrialKind = 'unit' | 'speedBand';

export type Condition =
    | { type: 'moved' }
    | { type: 'usesOnlyUnit'; unit: MoveUnit }
    | { type: 'usesDirection'; direction: MoveDirection }
    | { type: 'usesBlock'; block: string }
    | { type: 'usesSpeedOtherThan'; value: number }
    | { type: 'usesSpeedAtMost'; value: number }
    | { type: 'usesOnlyMotor'; motor: MotorId }
    | { type: 'endsInZone'; zone: string }
    | { type: 'visitedZone'; zone: string }
    | { type: 'visitedInOrder'; zones: string[] }
    | { type: 'endsNearStart'; tolerance: number }
    | { type: 'headingUnchanged'; tolerance: number }
    /** Heading modulo a full turn. */
    | { type: 'headingNear'; radians: number; tolerance: number }
    | { type: 'armBetween'; min: number; max: number }
    /** The run must end within this many simulated seconds. */
    | { type: 'withinSeconds'; seconds: number }
    /** The cargo must end up inside the zone (its centre within the zone radius). */
    | { type: 'cargoIn'; cargo: string; zone: string }
    /** Each key must be satisfied by one run; the key comes from the unit or the speed band. */
    | { type: 'subTrials'; kind: TrialKind; keys: string[] };

export interface MissionDefinition {
    taskId: number;
    unitId: number;
    mapId: string;
    allowedBlockTypes: string[];
    startPose: RobotPose;
    /** Arm angle in motor degrees at the start (0 = fully lowered). */
    startArm: number;
    halfWidth: number;
    halfHeight: number;
    obstacles: Rect[];
    zones: Zone[];
    /** Crates that can be grabbed; absent in missions without cargo. */
    cargo?: Cargo[];
    successConditions: Condition[];
}

export type FailReason =
    | 'emptyProgram'
    | 'collision'
    | 'outOfBounds'
    | 'noMovement'
    | 'wrongUnit'
    | 'wrongDirection'
    | 'missedTarget'
    | 'notVisited'
    | 'notInOrder'
    | 'notReturned'
    | 'headingChanged'
    | 'headingOff'
    | 'armOff'
    | 'tooSlow'
    | 'armUp'
    | 'nothingToGrab'
    | 'nothingCarried'
    | 'cargoMissed'
    | 'missingBlock'
    | 'wrongSpeed'
    | 'wrongMotor'
    | 'mixedTrial'
    | 'trialAlreadyDone'
    | 'budgetExceeded'
    | 'invalidProgram';

export type SimStatus = 'idle' | 'running' | 'success' | 'failed';
