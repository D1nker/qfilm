# qFilm

A film look and frame studio for your photos: film looks, grain and halation, film-style borders and captions.

Early stage, personal project. Open a photo, pick a look, wrap it in a frame, export.

**Stack:** Tauri 2 · Vue 3 + TypeScript · Rust imaging core · Reka UI

## What it does

- **Looks:** film-inspired presets with an intensity slider, plus manual adjustments (exposure, contrast, highlights and shadows, colour, a colour mixer with eight hue bands that doubles as a black-and-white channel mixer, clarity, a tone curve (RGB and per channel), colour grading, sharpening, noise reduction, grain with its size and roughness, halation, vignette with its midpoint and feather).
- **Frames:** 35 mm and medium-format film strips, instant prints, letterbox, solid and padded borders. A frame is data (`frame.json` + `frame.svg`), so you can design your own in Figma and import it as a `.zip`, a folder or by drag and drop. See [docs/FRAMES.md](docs/FRAMES.md).
- **Captions:** text on or around the photo, edited and moved directly on the preview.
- **Crop and geometry:** crop on the photo with handles and a thirds grid, fixed aspect ratios (1:1, 3:2, 16:9…), straighten, rotate by 90°, flip. The crop is taken from the original pixels, never from the preview.
- **Editing comfort:** undo/redo, compare with the original (hold `C`), cursor-anchored zoom and pan, light and dark themes, French and English interface.
- **Export:** JPEG, PNG or 16-bit TIFF, at the original size or resized, with an embedded sRGB profile and, if you want, the original EXIF.
- **Faithful opening:** photos are turned upright from their EXIF orientation, and wide-gamut files (Display P3, Adobe RGB…) are converted to sRGB instead of being misread.

## Getting started

```bash
npm install
npm run app          # desktop app with hot reload
npm run app:build    # production bundle
```

Requires Node and a Rust toolchain, 1.88 or newer (see the [Tauri prerequisites](https://tauri.app/start/prerequisites/)).

## Tests

```bash
npm test             # unit tests (Vitest): frame params, look layering, history, state
npm run test:rust    # engine, golden images, presets
npm run e2e          # UI in a browser against a mocked Tauri bridge (Playwright)
npm run test:all     # all of the above
```

The first `npm run e2e` needs `npx playwright install chromium`.

## Quality checks

```bash
npm run check:all    # Prettier + ESLint + vue-tsc + rustfmt + clippy
npm run format       # auto-format the frontend
npm run lint:fix     # auto-fix ESLint issues
npm run rust:fmt     # auto-format the Rust code
npm run rust:bindings # regenerate ui/src/shared/api/bindings.ts after changing a command or a wire type
```

## Project layout

```
ui/                  Vue app (npm workspace): Vite, Vitest, Playwright, ESLint
├─ src/
│  ├─ features/      one folder per concern, each with a public index.ts:
│  │                 photo, looks, frames, export, history, inspector, viewer
│  ├─ shared/        ui/ (Reka UI kit), api/ (generated bindings), lib/
│  ├─ app/           shell: App, header, shortcuts, theme, inspector panel
│  └─ styles/        design tokens (light + dark) and base styles
└─ e2e/              Playwright tests against a mocked Tauri bridge
desktop/             thin Tauri shell: commands/ (by domain), state, bindings, config, icons
crates/core/         qfilm-core: the imaging engine (no Tauri dependency)
├─ src/              decode, render pipeline, presets, frames, caption, encode
├─ frames/           built-in frames (SVG + manifest)
├─ presets/          looks, in builtin.json (add one by editing this file)
└─ golden/           reference images for the rendering tests
assets/fonts/        fonts shared by the engine (embedded) and the UI
website/             static download page (no build step)
docs/                frame authoring guide, release guide (docs/RELEASING.md)
branding/            app icon sources
```

Conventions live in [CLAUDE.md](CLAUDE.md).

## License

[MIT](LICENSE). The bundled fonts keep their own licenses, in `assets/fonts/`.
