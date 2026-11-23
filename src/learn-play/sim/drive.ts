import type { RobotCalibration } from './calibration.ts';
import type { RobotPose } from './types.ts';

/** Differential-drive integration. Wheel speeds are angular (rad/s); positive drives forward. */
export const integrateDrive = (
    pose: RobotPose,
    leftOmega: number,
    rightOmega: number,
    dt: number,
    c: RobotCalibration
): RobotPose => {
    const v = (c.wheelRadiusMeters * (leftOmega + rightOmega)) / 2;
    // Clockwise (heading increases) when the left wheel is faster than the right.
    const w = (c.wheelRadiusMeters * (leftOmega - rightOmega)) / c.wheelTrackMeters;
    const mid = pose.headingRadians + (w * dt) / 2;
    return {
        x: pose.x + v * Math.sin(mid) * dt,
        y: pose.y + v * Math.cos(mid) * dt,
        headingRadians: pose.headingRadians + w * dt
    };
};
