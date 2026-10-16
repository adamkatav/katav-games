import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Served from https://adamkatav.github.io/katav-games/, and the beta channel
// (built from claude-dev with BETA=1) from .../katav-games/beta/.
const beta = process.env.BETA === '1';
const base = process.env.BASE_PATH ?? (beta ? '/katav-games/beta/' : '/katav-games/');

const { version: released } = JSON.parse(readFileSync('./package.json', 'utf8')) as { version: string };
// A beta names the commit it was built from, so two test rounds on the same
// release number can still be told apart on screen.
const sha = (process.env.GITHUB_SHA ?? '').slice(0, 7);
const version = beta ? `${released}-beta${sha ? `.${sha}` : ''}` : released;

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(version), __APP_BETA__: JSON.stringify(beta) },
  build: {
    target: 'es2022',
    assetsInlineLimit: 4096, // small art inlines; the rest is hashed and precached
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      // A reload under a player mid-game is exactly the surprise this audience
      // should not get, so a new version is picked up on the next launch.
      workbox: {
        skipWaiting: false,
        clientsClaim: false,
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // The stable site's worker controls every path under it, beta included;
        // without this it answers /beta/ with the stable game.
        navigateFallbackDenylist: [/\/beta\//],
      },
      manifest: {
        id: base,
        name: beta ? 'משחקי קלפים (בטא)' : 'משחקי קלפים',
        short_name: beta ? 'קלפים בטא' : 'קלפים',
        lang: 'he',
        dir: 'rtl',
        start_url: base,
        scope: base,
        display: 'fullscreen',
        orientation: 'any',
        background_color: '#0f5236',
        theme_color: '#15603f',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
