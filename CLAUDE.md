# qFilm

Lightweight Lightroom-style photo editor. Tauri 2 shell, Vue 3 + TypeScript UI, Rust imaging core.

## Commands

- `npm run app` — run the desktop app (Tauri + Vite hot reload)
- `npm run check` — Prettier, ESLint, vue-tsc (frontend)
- `npm run check:rust` — rustfmt + clippy `-D warnings`
- `npm run check:all` — everything; run before considering a task done
- `npm run format` / `npm run lint:fix` / `npm run rust:fmt` — auto-fix

npm and cargo are run locally in this project (no Docker).

## Frontend conventions

- Imports use the `@/` alias (= `src/`). Never `../` (ESLint enforces it); avoid `./` too.
- `<script setup lang="ts">`, block order template → script → style, scoped CSS per component.
- State lives in composables (`src/composables`), module-level singletons, no Pinia. One concern
  each: `useEditor` (open photo, presets, thumbnails), `useLook` (preset × amount + manual
  adjustments), `useFrame` (chosen frame, its params, caption, imported frames), `useFrameThumbnails`, `useRender` (the single watcher that calls Rust),
  `useHistory` (undo/redo of look + frame, steps collapse after a 300 ms pause), `useExport`,
  `useInspector`, `useTheme` (dark default, light), `useViewportNavigation` (zoom/pan),
  `useShortcuts`, `useHelp` (shortcuts dialog), `useNotice` (passing messages).
- Rendering is driven by one watcher in `useRender`: change state, never call the renderer by hand.
  Rust caches the photo render, so border-only changes are cheap.
- Styles for content Reka teleports to `<body>` (select popup, tooltip) must be unscoped with a
  namespaced class (`.ui-select-content`): scoped CSS does not reach it.
- Styling goes through design tokens in `src/styles/tokens.css` (light + dark, neutral grays,
  violet accent). No hard-coded colors, no Tailwind. Inter is the font.
- Headless widgets come from Reka UI, wrapped in `src/components/ui/` as `Ui*` components
  (UiButton, UiSlider, UiSelect, UiMenu, UiDialog, UiTooltip…). Reuse them; add a new one there rather than
  styling raw elements in feature components. Icons come from `lucide-vue-next`.
- Layout: the header holds app-level things only (the qFilm wordmark is the app menu, open, export);
  editing and view controls (undo/redo, compare, zoom) live in the floating `CanvasToolbar`,
  centered on the canvas; the panel fold/unfold is a handle on the canvas edge (`PanelHandle`); the panel starts folded and unfolds when the first photo opens (`useInspector`). The strip under the photo (`--toolbar-clearance` in `ImageViewport`) mirrors
  `TOOLBAR_CLEARANCE` in `useViewportNavigation`: change both together. Toasts go at the top.
  On macOS the window uses an overlay title bar: `trafficLightPosition.y` in `tauri.conf.json` centers the
  lights in the 52px header and `header.overlay` in `AppHeader` reserves their width; change them together.
- Components stay small and presentational; logic goes in composables, static data in `src/lib`.
- Shortcuts: `C` hold = original, `F` = hide/show panel, ⌘Z / ⇧⌘Z, ⌘ +/−/0 zoom, Space+drag pan.
  Never take `Tab` (keyboard navigation) and pick keys that work on AZERTY (no `\`, no dead
  keys). Space must not re-trigger a button that was merely clicked: see `lastInput` in
  `useViewportNavigation` (`:focus-visible` cannot tell the two apart in Chromium).
- The photo area must never grow with the image: keep `minmax(0, 1fr)` / `min-height: 0` on grid
  items and let the viewport scroll instead.
- UI strings are French for now; i18n comes later, so keep strings out of logic.
- `import type` for types (`consistent-type-imports`), `interface` over `type` for object shapes,
  no `any`, no floating promises (use `void` explicitly).

## Rust conventions

- Edition 2024, MSRV 1.85. `src-tauri/rustfmt.toml` and `[lints]` in `Cargo.toml`: clippy pedantic is on, `unsafe` is forbidden.
- Cast lints are allowed only inside `src/imaging` (pixel math); elsewhere fix the cast.
- Keep `#[allow(...)]` rare, scoped to the item, with a one-line reason.
- Frames are data, not code: a folder with `frame.json` (options) + `frame.svg` (Jinja-style template
  rendered by resvg, composited in linear light). The Frame panel is generated from the manifest.
  Built-in frames live in `src-tauri/frames/`; the authoring guide is `docs/FRAMES.md` (keep it in
  sync with `src/imaging/frame/`). Frame state: `useFrame` (`frame` + `caption` + `memory` for
  `persist` params), pure helpers in `src/lib/frameParams.ts` (mirror Rust's coercion).
- Presets live in `src-tauri/presets/builtin.json` (embedded at build time, validated by tests).
  Only non-default params are written. To add a look, edit that file.
- Frames engine: `imaging/frame/` (manifest validation → template → raster/compose → registry/store).
  Imported frames are untrusted input: size caps, strict validation, dry-run render, no disk
  extraction, no file access from SVG. Keep those guarantees (and their tests) when touching it.
- `imaging/` is UI-agnostic: no Tauri types in it. Tauri glue stays in `commands.rs`.
- Errors: `thiserror` enums, serialized to the frontend as strings.
- Tests: Vitest unit tests sit next to their module (`*.test.ts`); composables hold module-level
  state, so load them with `fresh()` from `src/test/fresh.ts` and mock Rust with `apiMock()`. The
  Playwright suite in `e2e/` runs the real UI against `e2e/support/tauri-mock.js` (real frame
  manifests, fake Rust); use the `openApp` fixture and `expect.poll`, not fixed sleeps. Check that a
  new test fails when the behavior it guards is broken.
- Golden-image tests (`src/imaging/golden.rs`, references in `src-tauri/golden/`) guard every frame
  shape/edge and the look pipeline. After an _intended_ rendering change run
  `UPDATE_GOLDEN=1 cargo test golden` and **look at the PNGs** before committing them. Failures
  write the actual output to `src-tauri/target/golden-failures/`. The test scene has a 0–2 gray
  ramp and odd dimensions on purpose; mutation-checked (8/8 injected bugs caught).

## Product direction

- Pitch: a **film look + frame studio** (looks, grain/halation, film frames, captions), not a
  Lightroom clone. Frames and captions are the signature feature. Personal side project for now,
  to be made public later.
- Name: **qFilm** (repo `qfilm`). No real brand appears anywhere: looks, film stocks and edge
  texts are generic (e.g. "Portrait 400", "Ambre"). Keep it that way when adding looks or frames.
  The bundle `identifier` (`io.github.d1nker.qfilm`) is a placeholder until a domain is chosen.
- Icons: source in `branding/icon.svg` (+ `icon.png`). Regenerate with
  `npm run tauri icon branding/icon.png`, then delete `src-tauri/icons/android` and `ios` (desktop only).
