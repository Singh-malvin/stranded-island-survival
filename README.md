# Stranded — Island Survival

A single-player 3D survival adventure built with React, TypeScript, Tailwind CSS, Web Audio, and Three.js.

It runs **100% client-side in your browser** (saves live in `localStorage`, audio is synthesized locally via Web Audio API), so once published to GitHub Pages it stays playable online 24/7 with no local server or terminal open.

## Controls

- **Move / Sprint / Jump**: `W A S D` / `Shift` / `Space`
- **Interact / Gather / Drink / Unlock**: `E` or Left Click
- **Hotbar & Consume Food**: `1`–`6` and `F`
- **Base Building / Inventory & Crafting**: `B` / `Tab` (`R` rotates placement ghost)
- **Journal & Fog-of-War Map**: `J` / `M`
- **Pause**: `Esc` / `P`
- **Playtest Debug Bar**: append `?debug=1` to the URL (`TP:*`, `+Supplies`, `+Stage6`, `+4h Time`, `Weather`, FPS counter)

## Run Locally

```bash
npm install --legacy-peer-deps
npm run lint
node ./node_modules/tsx/dist/cli.mjs --test src/survival/survival.test.ts
npm run dev
```

## Hosting on GitHub Pages

Pushing to `main` automatically runs type-checking, unit tests, `npm run build`, and deploys `dist/` via `.github/workflows/deploy-pages.yml`. In your GitHub repository, set **Settings → Pages → Source** to **GitHub Actions**.
