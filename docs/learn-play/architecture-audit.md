# Architecture audit

## Findings (repository)

- Repo held only the PlayCanvas Engine + TypeScript + Vite blank starter (rotating cube). No git repo, no router, no i18n, no auth/progress API, no existing Learn/Play code.
- The reference bundle named in the prompt (`data/curriculum.json`, `robot-curriculum-original.pdf`, brand guide, logo, robot art, website screenshot) was not found in the repo, Downloads, Desktop, Documents or `D:\repo`.

## Decisions

- Stack: vanilla TypeScript + Vite (no React yet; the page is small and DOM is built with `textContent`, so no unsanitized HTML). React can be adopted when the mission UI (Phase 2) needs it.
- Route: hash routes inside the single page: `#/`, `#/unit/<1-7>`, `#/task/<1-48>`. Survives refresh and Back/Forward. Real site route for Learn & Play is unknown; `/learn-and-play` is the proposed mount point.
- Navigation: only Home links out (`https://01skills.com/`). Events, Challenges and Support are inert items because their real routes are unknown.
- Progress: `ProgressStore` interface with a local-only implementation. No API exists, none invented.
- PlayCanvas and Blockly are not loaded in Phase 1; they will be lazy-loaded by the mission page.
- Curriculum data lives in `src/learn-play/data/curriculum.json` (inside `src` so Vite/TS can import it).
- Logo: `public/zero1-logo-placeholder.svg` is a clearly labeled placeholder. Replace with `assets/zero1-logo.png`.

## Known gaps

- Titles for tasks 8-48 and all objectives/hints/concepts/required blocks from the PDF are missing. Unit objectives are editorial copy.
