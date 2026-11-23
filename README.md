# ZERO1 Learn & Play

Browser Learn & Play section for [01skills.com](https://01skills.com/): Blockly programming, a deterministic robot simulation, and a PlayCanvas 2.5D arena. English (LTR) and Arabic (RTL).

Built with Vite, TypeScript, [PlayCanvas Engine](https://developer.playcanvas.com/user-manual/engine/), and [Blockly](https://developers.google.com/blockly).

## Live preview (GitHub Pages)

Every push to `main` builds and deploys automatically via [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml):

**https://mohthaka.github.io/01WebGames/**

Example level: [https://mohthaka.github.io/01WebGames/#/play/1501](https://mohthaka.github.io/01WebGames/#/play/1501)

One-time setup in the repo: **Settings → Pages → Source → GitHub Actions**. After the first successful workflow run, the URL above is public.

## For 01skills.com

This app is meant to be hosted as a static section, typically at:

`https://01skills.com/learn-play/`

See **[docs/learn-play/hosting.md](docs/learn-play/hosting.md)** for build steps, nginx notes, GitHub Pages, header links, iframe fallback, and what the site owner still needs to provide (logo, curriculum text).

```bash
npm ci
npm run build
# publish the contents of dist/ to the Learn & Play path
```

## Local development

Requires Node.js 22.23.2 or later.

```bash
npm install
npm run dev
```

Opens <http://localhost:5173>. Hash routes: `#/`, `#/unit/1`, `#/task/1`, `#/game/code-quest`, `#/play/1001`.

**Same Wi‑Fi (phone or another PC):** after `npm run dev`, Vite prints a **Network** URL (for example `http://192.168.1.x:5173`). Open that on the other device (add `#/play/1501` if you need a level). Both machines must be on the same LAN; allow Node/Vite through Windows Firewall if prompted. For a production build on the LAN, use `npm run build` then `npm run start` (preview on port **4173**).

### Scripts

| Script         | Description                      |
| -------------- | -------------------------------- |
| `dev`          | Dev server with hot reload       |
| `build`        | Production build into `dist/`    |
| `start`        | Preview the production build     |
| `test`         | Vitest (simulation + curriculum) |
| `typecheck`    | TypeScript                       |
| `lint` / `fmt` | ESLint / Prettier                |

### Inspector (dev only)

Press <kbd>\`</kbd> for the PlayCanvas Inspector, <kbd>F9</kbd> to pause, <kbd>F10</kbd> to step. Omitted from production builds.

## Product docs

- [Hosting / site integration](docs/learn-play/hosting.md)
- [Developer guide](docs/learn-play/developer-guide.md)
- [Implementation status](docs/learn-play/implementation-status.md)
- [Mission specifications](docs/learn-play/mission-specifications.md)

## Coding agents

`AGENTS.md` describes commands, layout, and checks for agents. `CLAUDE.md` imports it.
