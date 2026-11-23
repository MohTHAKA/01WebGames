# Hosting Learn & Play on 01skills.com

This app is a static SPA (Vite + PlayCanvas + Blockly). It is ready to ship as the **Learn & Play** section of [01skills.com](https://01skills.com/).

## Recommended setup

Serve the production `dist/` folder at a subpath on the main site, for example:

`https://01skills.com/learn-play/`

Hash routes keep navigation inside the app (`#/`, `#/unit/1`, `#/task/3`, `#/game/code-quest`, `#/play/1001`). The main site does not need rewrite rules for those paths.

### Build

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Upload the contents of `dist/` (not the folder name itself) to the web root of the Learn & Play path.

Node.js **22.23.2+** is required to build. Runtime needs only a static file host (no Node server).

### Why `base: './'` works

[vite.config.ts](../../vite.config.ts) uses relative asset URLs, so the same build runs from:

- `https://01skills.com/learn-play/`
- a CDN subfolder
- a preview bucket

Do **not** open `index.html` as a `file://` URL; WebGL and ES modules need HTTP(S).

## GitHub Pages (auto-deploy)

This repo deploys `dist/` to GitHub Pages on every push to `main` (and on manual **workflow_dispatch**).

| Item | Value |
| ---- | ----- |
| Workflow | [`.github/workflows/deploy-pages.yml`](../../.github/workflows/deploy-pages.yml) |
| Public URL | `https://mohthaka.github.io/01WebGames/` |
| Build | `npm ci` → typecheck → test → `npm run build` |

**One-time:** GitHub → repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.

Relative `base: './'` and hash routes work under the `/01WebGames/` project path. `public/.nojekyll` is copied into `dist/` so Pages does not run Jekyll on the build.

For production on 01skills.com, keep publishing `dist/` to `/learn-play/` as below; Pages is the shareable preview that tracks `main`.

## Link from the main site

Add a nav item that matches the other 01skills sections:

| Label (EN)   | Label (AR) | Suggested href                     |
| ------------ | ---------- | ---------------------------------- |
| Learn & Play | تعلّم والعب | `https://01skills.com/learn-play/` |

This app’s header already links back to the main site:

| Item         | Href                               |
| ------------ | ---------------------------------- |
| Logo / Home  | `https://01skills.com/`            |
| Events       | `https://01skills.com/events/`     |
| Challenges   | `https://01skills.com/challenges/` |
| Learn & Play | `#/` (this SPA)                    |
| Support      | `https://01skills.com/support/`    |

## iframe (only if a subpath is not possible)

```html
<iframe
    src="https://01skills.com/learn-play/"
    title="Learn & Play"
    style="width:100%;min-height:100vh;border:0"
    allow="fullscreen"
></iframe>
```

Prefer a real subpath: iframe nesting hurts deep links, language preference, and mobile height.

## Runtime requirements

- **HTTPS** in production (AudioContext and some browser policies expect it).
- **WebGL** for the arena. Without it, the mission page shows a fallback message; the catalog still works.
- **JavaScript** enabled.
- Cookies are not required. Progress uses `localStorage` keys:
    - `zero1.learnplay.progress.v1` — task completion and Blockly workspaces
    - `zero1.learnplay.muted` — sound mute
    - `zero1.lang` — `en` / `ar`

Clearing site data for `01skills.com` resets Learn & Play progress unless a shared progress API is added later.

## Caching

Fingerprinted assets under `dist/assets/` can be cached long-term. Keep a short cache (or revalidate) for `index.html` so users pick up new releases.

Example nginx snippet:

```nginx
location /learn-play/ {
  alias /var/www/learn-play/;
  try_files $uri $uri/ /learn-play/index.html;
}

location /learn-play/assets/ {
  alias /var/www/learn-play/assets/;
  expires 30d;
  add_header Cache-Control "public, immutable";
}
```

(`try_files` is only a safety net; hash routing does not need it for in-app links.)

## What the site owner still supplies

| Item                           | Status in this repo                                                                                                         |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Final ZERO1 / 01skills logo    | `public/zero1-logo.png` (from 01skills.com brand mark) — swap the file to update header and favicon |
| Curriculum text for tasks 8–48 | Editorial drafts in UI; replace from the official PDF when available                                                        |
| Favicon / app icon             | Optional; add `public/favicon.svg` (or `.ico`) and a `<link>` in `index.html`                                               |
| Account-linked progress        | Not implemented; progress is device-local only                                                                              |
| Analytics / auth wrappers      | Out of scope; add on the host site if needed                                                                                |

## Smoke check after deploy

1. Open `/learn-play/` — home shows 7 units and 6 Coding Games.
2. Toggle EN / AR — layout flips LTR/RTL.
3. Open a Unit 1 task, run a short program — robot moves, sound (after click) works.
4. Open Coding Games → Code Quest → level 1.
5. Header: Home / Events / Challenges / Support leave the SPA for 01skills.com; Learn & Play stays.
6. Hard-refresh after a new deploy and confirm the new build (check a changed string or asset).

## Size (approximate)

- Homepage JS ~50 kB gzipped.
- First mission load pulls PlayCanvas + Blockly (~0.5 MB gzipped). Lazy-loaded only when a mission opens.

## Contact for this package

Repo: this project (`01WebGames`). Product docs: [developer-guide.md](./developer-guide.md), [implementation-status.md](./implementation-status.md).
