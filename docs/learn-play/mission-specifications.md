# Mission specifications

Label key: **[SOURCE]** comes from the implementation prompt's Unit 1 brief. **[ASSUMPTION]** is an engineering/design decision not in any curriculum PDF. **[DRAFT]** is editorial text/design for tasks 8-48 that must be reviewed against the original curriculum.

## World and calibration

- Units are meters. Arena 2.4 x 3.8 m, start at (0, -1.4) facing +y unless noted. **[ASSUMPTION]**
- Wheel radius 0.056 m (1 rotation = 0.352 m), wheel track 0.224 m, robot collision radius 0.12 m, 2 wheel rotations/s at 100% speed. **[ASSUMPTION]**
- Default drive speed 50%, default motor speed 75%. **[ASSUMPTION]**
- 360 degrees of motor rotation = 1 wheel rotation. Spinning in place, 0.5 rotation = 90 degrees of robot heading; one wheel turning alone for 1 rotation = 90 degrees. **[ASSUMPTION]**
- Steering -100..100: 0 straight, +/-50 stops one wheel, +/-100 spins in place; positive steers right. **[ASSUMPTION]**
- The arm angle is in motor degrees (0 = lowered), clamped to 0..720. **[ASSUMPTION]**
- Fixed step 1/60 s, simulated time independent of frame rate. Playback speed 1x/2x/4x only changes steps per frame. Safety limits: 100 blocks, 120 simulated seconds, 50 rotations / 60 s / 18000 degrees per block.
- Any contact with an obstacle or the arena edge fails the run. Success is checked only after the program ends (running motors are stopped at the end).

## Unit 1 - the move block

| Task | Title [SOURCE]     | Success condition [ASSUMPTION unless noted]                                                | Tolerance                      |
| ---- | ------------------ | ------------------------------------------------------------------------------------------ | ------------------------------ |
| 1    | اكتشف حركة الروبوت | Free exploration. Any safe program with at least one move block.                           | none                           |
| 2    | الوصول إلى العلم   | Only **rotations**; end inside the flag zone at (0, 0). Objective [SOURCE].                | radius 0.15 m                  |
| 3    | عبور النفق         | Only **seconds**; no wall contact; end in the exit zone at (0, 1.4).                       | radius 0.20 m                  |
| 4    | الوصول بدقة        | Only **degrees**; stop in the zone at (0, 0.45) in front of the box without touching it.   | radius 0.12 m                  |
| 5    | أي وحدة أفضل؟      | Reach the flag three times, once per unit, one unit per run. Progress persists.            | radius 0.15 m                  |
| 6    | العودة للخلف       | Start (0, 0.7) in a dead end. **Backward**, end in exit zone (0, -1.3), heading unchanged. | radius 0.20 m, heading 0.1 rad |
| 7    | اذهب وعد           | Visit the box pad at (0, 0.2) **and** end within 0.15 m of the start.                      | pad 0.15 m, return 0.15 m      |

## Units 2-7 [DRAFT]

Every row below is an editorial design. "Reference" is the program in `src/learn-play/solutions.ts` that the tests prove completes the mission.

| Task  | Draft title                 | Goal and key conditions                                                                           | Reference                                                  |
| ----- | --------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 8     | Change the speed            | Use "set speed" with a value other than 50 and reach the flag (0, 0)                              | speed 80, forward 4 rot                                    |
| 9     | Compare speeds              | Two runs to the flag: one with speed <= 30, one with >= 70                                        | speed 25 / speed 80, forward 4 rot                         |
| 10    | Keep driving                | start moving, wait, stop; end on the flag                                                         | start, wait 4, stop                                        |
| 11    | Stop before the box         | start/wait/stop; end in the zone before the box at (0, 0.9)                                       | start, wait 5.2, stop                                      |
| 12-14 | Steer right/sharper/left    | Steer block; end on the flag at (0.416, -0.585) / (0.586, -0.974) / (-0.416, -0.585)              | steer 10 x3 rot / 20 x3 rot / -10 x3 rot                   |
| 15-18 | Spin / quarter turns        | Heading within 0.1-0.12 rad of the goal and back at the start; 16 rotations only, 17 degrees only | steer 100 for 1 rot / 0.5 rot / 180 deg / -100 for 0.5 rot |
| 19    | Speed and steering          | Speed != 50 and steer block; flag (0.31, -0.974)                                                  | speed 80, steer 20 x2 rot                                  |
| 20    | Two wheel speeds            | "wheels for" block; flag (0.336, -1.064)                                                          | left 60, right 30, 2 rot                                   |
| 21    | Keep steering               | start steering, wait, stop; flag (-0.31, -0.974)                                                  | start steer -20, wait 2, stop                              |
| 22    | Drive, turn, drive          | Reach (0.704, -0.696) facing right                                                                | fwd 2, spin right, fwd 2                                   |
| 23    | Around the obstacle         | Box at the centre; reach flag (0.704, 0.711)                                                      | fwd 2, right, fwd 2, left, fwd 4                           |
| 24    | Drive a square              | Visit B, C, D in order and end within 0.2 m of the start facing 0                                 | 4 x (fwd 2 rot, spin right)                                |
| 25-26 | Left/right motor            | Only that motor; heading +90 / -90 degrees                                                        | motor 1 rot                                                |
| 27-29 | Motor rotations/degrees/sec | Left motor only, one unit only; headings 180 / 45 / 135 degrees                                   | 2 rot / 180 deg / 1 s                                      |
| 30    | Both motors together        | start both motors, wait, stop; flag (0, 0)                                                        | start L, start R, wait 2.6, stop all                       |
| 31    | Reverse a motor             | Left motor backward; heading -90 degrees                                                          | left backward 1 rot                                        |
| 32    | Reverse out with motors     | Dead end; back out with motor start; heading unchanged                                            | start both backward, wait 3.8, stop all                    |
| 33-36 | Motor speed                 | Set a different speed; headings 90 / 180 / ~95 / 180 degrees                                      | speed 40 / 100 for 1 s / start-wait 0.7-stop / 50 for 2 s  |
| 37    | Speed or power?             | Two runs of a quarter turn: slow (<= 30) and fast (>= 70)                                         | speed 30 / speed 80, 1 rot                                 |
| 38    | Slow and precise            | Right motor <= 30; heading -90 degrees                                                            | speed 25, 1 rot                                            |
| 39    | Fast and continuous         | Set speed, start both, wait, stop; flag (0, 0)                                                    | speed 100 both, wait 2                                     |
| 40-41 | Pivot right/left            | One motor pivot then forward; flag (+/-0.816, -1.288)                                             | motor 1 rot, fwd 2                                         |
| 42-43 | Right/left gate             | Visit the gate zone then the exit; the posts are obstacles                                        | fwd 2, pivot, fwd 2                                        |
| 44    | Precise motor control       | Left motor, degrees only; heading 135 degrees (tolerance 0.05 rad)                                | 540 degrees                                                |
| 45    | Raise the arm               | Arm angle 340-380                                                                                 | arm forward 1 rot                                          |
| 46    | Lower the arm               | Arm starts at 540; end 160-200                                                                    | arm backward 360 deg                                       |
| 47    | Arm speed control           | Arm speed <= 40; end 400-460 after 2 s                                                            | speed 30, 2 s                                              |
| 48    | Final challenge             | Visit the box pad (0, 0.2), arm starts at 360 and ends <= 40, back at the start                   | fwd 4.5, arm down 360, back 4.5                            |

Instructions and hints for every task are implementation copy in `src/learn-play/mission-text.ts`; they are not the PDF's text.

## Not yet source-verified

The PDF's exact required blocks, hints, concepts and numeric values for tasks 1-48 were not available, and the task titles and goals for tasks 8-48 are drafts. Replace the assumptions above (titles in `data/curriculum.json`, set `draft` to false or remove it; text in `mission-text.ts`; geometry in `missions.ts`) when the PDF is added.
