# Implementation status

**Phase:** 5 started. All 7 units (48 tasks) are playable, and all six Coding Games are playable: **Code Quest** (6 levels), **Logic Maze** (4), **Sensor Rush** (4, distance-sensor block), **Pattern Builder** (4, repeat block) and **Robot Arena** (4, timed skill challenges). and **Robo Logistics** (4, grab/release cargo with the arm).

| Item                                                                            | Status                                                         |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Two-column page, 7 unit cards, 48 task records, unit/task routes                | Implemented                                                    |
| EN LTR / AR RTL toggle (page, mission UI, Blockly labels and help)              | Implemented                                                    |
| Progress and Blockly workspace saved locally (replaceable `ProgressStore`)      | Implemented, with per-task done marks and per-unit `x/n done`  |
| Deterministic simulation, command compiler, success evaluator                   | Implemented, 33 tests                                          |
| PlayCanvas 2.5D arena (lazy-loaded, disposed on navigation)                     | Implemented                                                    |
| Blockly editor with mission-gated blocks (Events, Movement, Motors, Control)    | Implemented (14 block types)                                   |
| Run / Pause / Step / Stop / Reset / Hint / playback speed, heading/arm readouts | Implemented                                                    |
| Tasks 1-48 playable with a reference solution each                              | Implemented; every solution is verified by tests               |
| Task titles 8-48, instructions, hints, maps, tolerances                         | **Editorial drafts** (flagged "Draft title" in the UI)         |
| Original curriculum text for tasks 8-48                                         | **Missing source text**                                        |
| ZERO1 logo                                                                      | `public/zero1-logo.png`                                        |
| Help modal                                                                      | Simplified to a collapsible panel listing the mission's blocks |
| Coding Games (6 games, playable)                                                | Implemented                                                    |
| Existing-API progress store                                                     | None exists; local only                                        |
| Hosting handoff for 01skills.com                                                | See [hosting.md](./hosting.md)                                 |

## Calibration change since Phase 3

The wheel track is now 0.224 m (4x the wheel radius). Spinning in place, half a wheel rotation turns the robot exactly 90 degrees, and one wheel turning alone for one rotation turns it 90 degrees. Unit 1 behaviour is unchanged (straight driving does not depend on the track).

## Checks run

- `npm run typecheck`, `npm run lint`, `npm run build` pass; `npm test` covers curriculum integrity, routing, compiler validation, failure feedback, determinism, every task 1–48 solution, and Coding Games solutions.
- Bundle: homepage JS stays small; the mission chunk (PlayCanvas + Blockly) is lazy-loaded (~0.5 MB gzip).
- Site integration notes: [hosting.md](./hosting.md).

## Not tested

Real touch devices, tablet/phone widths, other browsers, WebGL-unsupported fallback, a visible-tab frame-rate measurement (the automation tab was hidden and throttled), an axe/contrast audit, and playing missions 8-41 and 43-48 by hand in the browser (they are covered by headless tests only).
