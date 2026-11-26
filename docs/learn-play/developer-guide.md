# Developer guide

## Commands

- `npm run dev` start the dev server (opens the page; Inspector with the backquote key).
- `npm test` run unit tests (Vitest, headless: curriculum, routing, simulation, compiler).
- `npm run typecheck`, `npm run lint`, `npm run fmt`, `npm run build`.

## Layout (`src/learn-play/`)

- `curriculum.ts` + `data/curriculum.json`: units/tasks (see `_note` in the JSON about missing source text).
- `app.ts`: hash router, header (links Home/Events/Challenges/Support to 01skills.com), home/unit/task/game views, language toggle. Lazy-loads the mission page.
- Hosting on 01skills.com: see [hosting.md](./hosting.md).
- `mission-view.ts`: mission UI. Owns the Blockly workspace, the PlayCanvas scene and controls, and returns a disposer.
- `blocks.ts`: Blockly blocks, toolbox, locale, save/load.
- `sim/`: pure TypeScript simulation. `calibration.ts` (constants), `drive.ts` (differential drive), `simulation.ts`, `program.ts` (Blockly JSON to validated commands, no eval), `evaluate.ts` (success rules).
- `scene.ts`: PlayCanvas 2.5D renderer. It only reads the pose.
- `missions.ts`: mission definitions and instruction/hint text. `mission-i18n.ts` / `i18n.ts`: strings (EN/AR).
- `progress.ts`: `ProgressStore` interface and the local-storage implementation.

## Add the next task

1. Add its title to `data/curriculum.json` (original Arabic text from the PDF).
2. Add a `MissionDefinition` in `missions.ts` (map, zones, obstacles, success conditions) and its `missionText` entry.
3. If it needs a new block or command: extend `Command`, `planMove` or a new planner in `sim/`, `program.ts`, `blocks.ts`, and the strings.
4. Add success and failure tests in `sim/simulation.test.ts`.
5. Document tolerances in `mission-specifications.md`.

## Assets

Sound and effects are driven from `mission-view.ts`: each frame it compares the simulation's state with the previous frame (carried cargo, visited zones, arm angle, distance driven, final status) and calls `sfx.play(...)` (`sfx.ts`) and `scene.burst(...)` / `flashRobot()` / `shake()` (`scene.ts`). The simulation never knows about them. To add a sound, add a name to `SfxName` and a function to `sounds` in `sfx.ts`, then trigger it from `fxFrame` or `fxFinish`. The speaker button mutes everything and is remembered in `localStorage` (`zero1.learnplay.muted`); the audio context only starts after a click.

**Original assets:** every sound is generated at runtime from oscillators, noise and gain envelopes, with plain scale notes and our own timing. Every effect is a flat shape drawn in code. There are no recordings, samples, sprite sheets, particle presets or audio libraries, so the SFX and VFX carry no third-party license. (The robot sheet, `crate.png`, `flag.png` and the logo placeholder are separate; their rights are the product team's to confirm.)

The arena is a fixed 2.5D view: an orthographic camera tilted 55° over a ground plane carrying the grid (drawn to a canvas texture in `scene.ts`), with walls and crates as short boxes. The robot is 16 camera-facing billboards, `public/robot16-00.png` to `robot16-15.png`, cut from a 4x4 sheet (22.5 degrees apart, each frame cropped to the same 241x274 window so the robot keeps one size and ground point). Frames 3 and 4 show the front and 11 and 12 the back, so frame NN is centred on heading `180 + (NN - 3.5) * 22.5` (heading 0 drives away from the camera and shows the back). `scene.ts` cross-fades to the frame nearest the heading; billboards never yaw.

## Adding or changing a mission (Units 2-7)

1. Add or edit the mission in `src/learn-play/missions.ts` (allowed blocks, zones, obstacles, `startArm`, success conditions).
2. Add its text in `src/learn-play/mission-text.ts` (EN + AR instructions and two hints) and its title in `src/learn-play/data/curriculum.json`. Remove `"draft": true` once the title is the original curriculum text.
3. Add a reference solution to `src/learn-play/solutions.ts`. `npm test` runs every solution against its mission, so a mission that cannot be completed fails the suite.
4. New block types need entries in `sim/program.ts` (compile), `blocks.ts` (definition, toolbox, help) and `mission-i18n.ts` (EN + AR labels and help).
5. `tools/fill_draft_titles.mjs` was a one-off that wrote the draft titles; it is not part of the build.

## Coding Games

- Game levels are `MissionDefinition`s in `src/learn-play/game-levels.ts` (ids 1001+ Code Quest, 1101+ Logic Maze, 1201+ Sensor Rush, 1301+ Pattern Builder, 1401+ Robot Arena, 1501+ Robo Logistics), so they reuse the Blockly editor, simulation and PlayCanvas arena. Texts live next to them (`gameLevelText`), reference solutions in `gameSolutions` (`solutions.ts`), and `npm test` runs every solution.
- To add a game: set `playable: true` in `games.ts`, add levels and `gameLevelInfo` entries with a new id range, and add solutions. Mechanics that need new simulation features must be added to `sim/` first. Cargo (Robo Logistics) is `MissionDefinition.cargo` plus the `grab`/`release` commands and the `cargoIn` condition; carried crates ride 20 cm ahead of the robot and cargo missions always restart from the start pose.
- Game levels are original design; they carry no curriculum text.
