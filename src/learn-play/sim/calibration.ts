/**
 * Single place for physical constants. ALL are design assumptions: the source PDF only defines drive
 * speed -100..100 with a 50% default, and does not define wheel size or motor RPM.
 */
export interface RobotCalibration {
    wheelRadiusMeters: number;
    wheelTrackMeters: number;
    robotRadiusMeters: number;
    /** Wheel angular speed at 100% speed. */
    maxWheelAngularSpeedRadPerSecond: number;
}

export const DEFAULT_CALIBRATION: RobotCalibration = {
    wheelRadiusMeters: 0.056,
    // 4 x wheel radius: spinning in place, half a wheel rotation turns the robot exactly 90 degrees
    wheelTrackMeters: 0.224,
    robotRadiusMeters: 0.12,
    // 2 wheel rotations per second at 100%
    maxWheelAngularSpeedRadPerSecond: 2 * Math.PI * 2
};

/** Source-defined default drive speed (percent) of the movement blocks. */
export const DEFAULT_DRIVE_SPEED = 50;

/** Source-defined default speed (percent) of individual motors. */
export const DEFAULT_MOTOR_SPEED = 75;

/** Fixed simulation step, independent of display frame rate. */
export const FIXED_DT = 1 / 60;

/** Distance sensor range (cm). The sensor sits on the robot's front edge and looks straight ahead. */
export const SENSOR_MIN_CM = 5;
export const SENSOR_MAX_CM = 200;

/** Cargo handling: how close the cargo must be to grab it, how far ahead it is carried, and the arm limit. */
export const CARGO = {
    reachMeters: 0.3,
    carryOffsetMeters: 0.2,
    /** The arm counts as lowered at or below this angle (motor degrees). */
    armLoweredMaxDegrees: 40
} as const;

/** Safety limits. */
export const LIMITS = {
    maxCommands: 100,
    maxSimSeconds: 120,
    maxRotations: 50,
    maxSeconds: 60,
    maxRepeat: 20,
    maxDegrees: 18000
} as const;

/** Meters traveled by one wheel rotation. */
export const metersPerRotation = (c: RobotCalibration): number => 2 * Math.PI * c.wheelRadiusMeters;
