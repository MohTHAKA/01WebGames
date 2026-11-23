import { CARGO, DEFAULT_CALIBRATION, FIXED_DT, LIMITS } from './calibration.ts';
import type { RobotCalibration } from './calibration.ts';
import { integrateDrive } from './drive.ts';
import type { Command, FailReason, MissionDefinition, MotorId, Rect, RobotPose, SimStatus } from './types.ts';

export interface SimOutcome {
    ok: boolean;
    reason?: FailReason;
    /** Set for sub-trial missions: the key this run satisfied. */
    trialKey?: string;
    /** False when a sub-trial succeeded but more trials remain. */
    missionComplete?: boolean;
}

/** Arm travel limit in motor degrees (the arm stalls at 0 and at this value). */
export const ARM_MAX_DEGREES = 720;

const circleHitsRect = (x: number, y: number, r: number, rect: Rect): boolean => {
    const dx = Math.abs(x - rect.cx) - rect.halfWidth;
    const dy = Math.abs(y - rect.cy) - rect.halfHeight;
    const ox = Math.max(dx, 0);
    const oy = Math.max(dy, 0);
    return ox * ox + oy * oy < r * r;
};

/** Distance (m) along a ray from (ox, oy) with direction (dx, dy) to a rectangle, or Infinity on a miss. */
const rayToRect = (ox: number, oy: number, dx: number, dy: number, rect: Rect): number => {
    let tMin = 0;
    let tMax = Infinity;
    const axes: [number, number, number, number][] = [
        [ox, dx, rect.cx - rect.halfWidth, rect.cx + rect.halfWidth],
        [oy, dy, rect.cy - rect.halfHeight, rect.cy + rect.halfHeight]
    ];
    for (const [o, d, lo, hi] of axes) {
        if (Math.abs(d) < 1e-9) {
            if (o < lo || o > hi) return Infinity;
        } else {
            const t1 = (lo - o) / d;
            const t2 = (hi - o) / d;
            tMin = Math.max(tMin, Math.min(t1, t2));
            tMax = Math.min(tMax, Math.max(t1, t2));
        }
    }
    return tMin <= tMax ? tMin : Infinity;
};

/**
 * Reading of the front distance sensor in centimeters: the free space between the robot's front edge
 * and the nearest obstacle or arena wall straight ahead (never below zero).
 */
export const distanceAheadCm = (
    mission: MissionDefinition,
    pose: RobotPose,
    c: RobotCalibration = DEFAULT_CALIBRATION
): number => {
    const dx = Math.sin(pose.headingRadians);
    const dy = Math.cos(pose.headingRadians);
    let nearest = Infinity;
    // Arena walls: the ray leaves the rectangle through the nearest boundary it is heading toward.
    if (dx > 1e-9) nearest = Math.min(nearest, (mission.halfWidth - pose.x) / dx);
    if (dx < -1e-9) nearest = Math.min(nearest, (-mission.halfWidth - pose.x) / dx);
    if (dy > 1e-9) nearest = Math.min(nearest, (mission.halfHeight - pose.y) / dy);
    if (dy < -1e-9) nearest = Math.min(nearest, (-mission.halfHeight - pose.y) / dy);
    for (const o of mission.obstacles) nearest = Math.min(nearest, rayToRect(pose.x, pose.y, dx, dy, o));
    return Math.max(0, (nearest - c.robotRadiusMeters) * 100);
};

/** Duration (s) of a timed command; Infinity when it can never finish (zero speed). */
export const timedDuration = (
    unit: 'rotations' | 'seconds' | 'degrees',
    amount: number,
    referenceSpeed: number,
    c: RobotCalibration
): number => {
    if (unit === 'seconds') return amount;
    const omega = (Math.abs(referenceSpeed) / 100) * c.maxWheelAngularSpeedRadPerSecond;
    if (omega <= 0) return Infinity;
    const angle = unit === 'rotations' ? amount * 2 * Math.PI : (amount * Math.PI) / 180;
    return angle / omega;
};

const commandDuration = (cmd: Command, c: RobotCalibration): number => {
    switch (cmd.type) {
        case 'drive':
            return timedDuration(cmd.unit, cmd.amount, Math.max(Math.abs(cmd.left), Math.abs(cmd.right)), c);
        case 'motorFor':
            return timedDuration(cmd.unit, cmd.amount, cmd.speed, c);
        case 'wait':
            return cmd.seconds;
        case 'grab':
        case 'release':
            return 0;
        case 'driveUntil':
            // Ends when the sensor triggers; the time limit only stops a robot that never gets there.
            return LIMITS.maxSeconds;
        case 'run':
            return 0;
    }
};

/** Deterministic, headless simulation. PlayCanvas only reads the exposed state. */
export class Simulation {
    readonly mission: MissionDefinition;
    readonly program: readonly Command[];
    readonly calibration: RobotCalibration;

    pose: RobotPose;
    status: SimStatus = 'idle';
    outcome: SimOutcome | null = null;
    /** Simulated time in seconds (not wall-clock). */
    time = 0;
    /** Index of the running timed command, or -1. */
    commandIndex = -1;
    /** Cumulative wheel angles (rad). */
    leftWheelAngle = 0;
    rightWheelAngle = 0;
    /** Arm angle in motor degrees. */
    armAngle: number;
    readonly visited = new Set<string>();
    /** Zone ids in first-visit order. */
    readonly visitedOrder: string[] = [];
    /** Current cargo positions by id (carried cargo follows the robot). */
    readonly cargoPos = new Map<string, { x: number; y: number }>();
    /** Id of the carried cargo, or null. */
    carrying: string | null = null;

    private readonly evaluate: (sim: Simulation) => SimOutcome;
    private remaining = 0;
    private speeds: Record<MotorId, number> = { left: 0, right: 0, arm: 0 };

    constructor(
        mission: MissionDefinition,
        program: readonly Command[],
        evaluate: (sim: Simulation) => SimOutcome,
        calibration: RobotCalibration = DEFAULT_CALIBRATION
    ) {
        this.mission = mission;
        this.program = program;
        this.evaluate = evaluate;
        this.calibration = calibration;
        this.pose = { ...mission.startPose };
        this.armAngle = mission.startArm;
        this.resetCargo();
    }

    private resetCargo(): void {
        this.cargoPos.clear();
        for (const c of this.mission.cargo ?? []) this.cargoPos.set(c.id, { x: c.x, y: c.y });
        this.carrying = null;
    }

    /** Where carried cargo sits: straight ahead of the robot's centre. */
    private carryPoint(): { x: number; y: number } {
        const d = CARGO.carryOffsetMeters;
        return {
            x: this.pose.x + Math.sin(this.pose.headingRadians) * d,
            y: this.pose.y + Math.cos(this.pose.headingRadians) * d
        };
    }

    private syncCarried(): void {
        if (this.carrying) this.cargoPos.set(this.carrying, this.carryPoint());
    }

    reset(): void {
        this.resetCargo();
        this.pose = { ...this.mission.startPose };
        this.armAngle = this.mission.startArm;
        this.status = 'idle';
        this.outcome = null;
        this.time = 0;
        this.commandIndex = -1;
        this.leftWheelAngle = 0;
        this.rightWheelAngle = 0;
        this.remaining = 0;
        this.speeds = { left: 0, right: 0, arm: 0 };
        this.visited.clear();
        this.visitedOrder.length = 0;
    }

    /**
     * Starts (or restarts) the program. Pass `from` to keep the robot where it is
     * (Play); omit it to begin at the mission start pose (Reset then Play).
     */
    start(from?: RobotPose): void {
        this.reset();
        if (from) this.pose = { ...from };
        if (this.program.length === 0) {
            this.finish({ ok: false, reason: 'emptyProgram' });
            return;
        }
        this.status = 'running';
        this.startAt(0);
    }

    /** Applies instant commands and begins the next timed one, or ends the program. */
    private startAt(first: number): void {
        for (let i = first; i < this.program.length; i++) {
            const cmd = this.program[i];
            if (cmd.type === 'run') {
                if (cmd.left !== undefined) this.speeds.left = cmd.left;
                if (cmd.right !== undefined) this.speeds.right = cmd.right;
                if (cmd.arm !== undefined) this.speeds.arm = cmd.arm;
                continue;
            }
            if (cmd.type === 'grab' || cmd.type === 'release') {
                const failure = cmd.type === 'grab' ? this.grab() : this.release();
                if (failure) {
                    this.finish({ ok: false, reason: failure });
                    return;
                }
                continue;
            }
            this.commandIndex = i;
            if (cmd.type === 'drive' || cmd.type === 'driveUntil') {
                this.speeds.left = cmd.left;
                this.speeds.right = cmd.right;
            } else if (cmd.type === 'motorFor') {
                this.speeds[cmd.motor] = cmd.speed;
            }
            this.remaining = commandDuration(cmd, this.calibration);
            if (!Number.isFinite(this.remaining)) this.finish({ ok: false, reason: 'invalidProgram' });
            else if (cmd.type === 'driveUntil' && this.sensorTriggered(cmd.distanceCm)) this.endTimedCommand();
            return;
        }
        // Program ended: motors stop, then success is judged.
        this.speeds = { left: 0, right: 0, arm: 0 };
        this.finish(this.evaluate(this));
    }

    /** Picks up the nearest cargo in reach. Returns a failure reason, or null on success. */
    private grab(): FailReason | null {
        if (this.armAngle > CARGO.armLoweredMaxDegrees) return 'armUp';
        let best: string | null = null;
        let bestDist: number = CARGO.reachMeters;
        for (const [id, p] of this.cargoPos) {
            if (id === this.carrying) continue;
            const d = Math.hypot(p.x - this.pose.x, p.y - this.pose.y);
            if (d <= bestDist) {
                best = id;
                bestDist = d;
            }
        }
        if (!best) return 'nothingToGrab';
        // Only one crate at a time: the one already held drops where it is.
        this.carrying = best;
        this.syncCarried();
        return null;
    }

    private release(): FailReason | null {
        if (!this.carrying) return 'nothingCarried';
        this.syncCarried();
        this.carrying = null;
        return null;
    }

    private finish(outcome: SimOutcome): void {
        this.outcome = outcome;
        this.status = outcome.ok ? 'success' : 'failed';
        this.commandIndex = -1;
    }

    private endTimedCommand(): void {
        const cmd = this.program[this.commandIndex];
        if (cmd.type === 'drive' || cmd.type === 'driveUntil') {
            this.speeds.left = 0;
            this.speeds.right = 0;
        } else if (cmd.type === 'motorFor') {
            this.speeds[cmd.motor] = 0;
        }
        this.startAt(this.commandIndex + 1);
    }

    /** Advance one fixed step. */
    step(): void {
        if (this.status !== 'running') return;
        const h = Math.min(FIXED_DT, this.remaining);
        const max = this.calibration.maxWheelAngularSpeedRadPerSecond;
        const wl = (this.speeds.left / 100) * max;
        const wr = (this.speeds.right / 100) * max;
        this.pose = integrateDrive(this.pose, wl, wr, h, this.calibration);
        this.syncCarried();
        this.leftWheelAngle += wl * h;
        this.rightWheelAngle += wr * h;
        const armDelta = (((this.speeds.arm / 100) * max * h) / Math.PI) * 180;
        this.armAngle = Math.min(ARM_MAX_DEGREES, Math.max(0, this.armAngle + armDelta));
        this.time += h;
        this.remaining -= h;

        if (this.checkCollision()) return;
        this.trackZones();

        if (this.time > LIMITS.maxSimSeconds) {
            this.finish({ ok: false, reason: 'budgetExceeded' });
            return;
        }
        const cmd = this.program[this.commandIndex];
        if (this.remaining <= 1e-9 || (cmd.type === 'driveUntil' && this.sensorTriggered(cmd.distanceCm))) {
            this.endTimedCommand();
        }
    }

    /** Current front distance sensor reading in cm. */
    sensorCm(): number {
        return distanceAheadCm(this.mission, this.pose, this.calibration);
    }

    private sensorTriggered(thresholdCm: number): boolean {
        return this.sensorCm() <= thresholdCm;
    }

    private checkCollision(): boolean {
        const r = this.calibration.robotRadiusMeters;
        const { x, y } = this.pose;
        if (Math.abs(x) + r > this.mission.halfWidth || Math.abs(y) + r > this.mission.halfHeight) {
            this.finish({ ok: false, reason: 'outOfBounds' });
            return true;
        }
        if (this.mission.obstacles.some((o) => circleHitsRect(x, y, r, o))) {
            this.finish({ ok: false, reason: 'collision' });
            return true;
        }
        return false;
    }

    private trackZones(): void {
        for (const z of this.mission.zones) {
            if (Math.hypot(this.pose.x - z.x, this.pose.y - z.y) <= z.radius && !this.visited.has(z.id)) {
                this.visited.add(z.id);
                this.visitedOrder.push(z.id);
            }
        }
    }

    /** Run headlessly until the program ends or fails. Returns the steps taken. */
    runToEnd(maxSteps = Math.ceil(LIMITS.maxSimSeconds / FIXED_DT) + 1000): number {
        let n = 0;
        while (this.status === 'running' && n < maxSteps) {
            this.step();
            n++;
        }
        return n;
    }

    /** Step until the next timed command begins (or the program ends). */
    stepCommand(): void {
        const start = this.commandIndex;
        let guard = 0;
        while (this.status === 'running' && this.commandIndex === start && guard < 1_000_000) {
            this.step();
            guard++;
        }
    }
}
