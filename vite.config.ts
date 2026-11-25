import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
    // `vite build --mode unity` makes the build the lessons host of the webgameIF Unity app: every unit and
    // game is playable and finished lessons are reported to the Unity menu (see src/learn-play/config.ts).
    define: mode === 'unity' ? { 'import.meta.env.VITE_UNITY_HOST': JSON.stringify('1') } : {},
    // Relative URLs, so the build runs wherever it's served from: a domain root, a subpath such as
    // GitHub Pages or itch.io, or a Snapchat Web Lens
    base: './',
    server: {
        // Listen on all interfaces so phones / other PCs on the same Wi‑Fi can use npm run dev
        host: true,
        port: 5173
    },
    preview: {
        host: true,
        port: 4173
    },
    build: {
        // A PlayCanvas build is 1-2.5 MB minified (300-600 kB gzipped), nearly all of it engine code the
        // first frame needs, so warn only for chunks well past that rather than at Vite's 500 kB default
        chunkSizeWarningLimit: 3000
    },
    plugins: [
        {
            // Dev only: install the PlayCanvas Inspector before the app starts (press ` to toggle)
            name: 'playcanvas-inspector',
            apply: 'serve',
            config: () => ({ optimizeDeps: { include: ['@playcanvas/inspector'] } }),
            transformIndexHtml: () => [
                { tag: 'script', attrs: { type: 'module', src: '/src/inspector.ts' }, injectTo: 'head-prepend' }
            ]
        }
    ]
}));
