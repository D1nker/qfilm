# qFilm

Film look and frame studio. Tauri 2 shell, Vue 3 + TypeScript UI, Rust imaging core.

## Commands

- `npm run app` — run the desktop app (Tauri + Vite hot reload)
- `npm run check` — Prettier, ESLint, vue-tsc (frontend)
- `npm run check:rust` — rustfmt + clippy `-D warnings`
- `npm run check:all` — everything; run before considering a task done
- `npm run format` / `npm run lint:fix` / `npm run rust:fmt` — auto-fix

npm and cargo are run locally in this project (no Docker).

## Repository layout

Monorepo. `ui/` is the Vue app (npm workspace `@qfilm/ui`: Vite, Vitest, Playwright, ESLint and tsconfigs live
there; the root scripts delegate to it), `desktop/` is the Tauri shell, `crates/core/` is the engine, `assets/`
holds files shared by both sides, `website/` is the static download page (plain HTML/CSS/JS, no build
step, preview with `python3 -m http.server -d website`), `docs/` and `branding/` are what they say. Frontend paths below are relative to `ui/`.

## Frontend conventions

- Imports use the `@/` alias (= `ui/src/`). Never `../` (ESLint enforces it); avoid `./` too.
- `<script setup lang="ts">`, block order template → script → style, scoped CSS per component.
- Code is organised by feature, under `src/`: `features/<name>/` (components, composables, helpers and
  tests of one concern), `shared/` (`ui/` kit, `api/` bridge, `lib/` helpers), `app/` (shell: App, header,
  shortcuts, theme, and the inspector panel that composes the features), `styles/`, `test/` (helpers).
  Boundaries are enforced by ESLint (`FEATURE_DEPENDENCIES` in `eslint.config.js`, an acyclic graph from
  `photo` up to `viewer`): a feature imports another only through its `index.ts` (public API, `@/features/<name>`),
  only if the table allows it, and never from `app`; `shared` imports no feature. A feature that needs to
  react to another is wired by the host (see `LooksPanel` emitting `select`, handled in `InspectorPanel`).
  A new file that another feature needs must be exported from its `index.ts`.
- State lives in composables inside their feature, module-level singletons, no Pinia. One concern
  each: `photo/useEditor` (open photo, presets, thumbnails), `looks/useLook` (preset × amount + manual
  adjustments), `frames/useFrame` (chosen frame, its params, caption, imported frames), `useFrameThumbnails`,
  `viewer/useRender` (the single watcher that calls Rust), `viewer/useViewportNavigation` (zoom/pan),
  `history/useHistory` (undo/redo of look + frame, steps collapse after a 300 ms pause), `export/useExport`,
  `inspector/useInspector`, `app/useTheme` (dark default, light), `app/useShortcuts`, `app/useHelp`
  (shortcuts dialog), `shared/lib/useNotice` (passing messages).
- Rendering is driven by one watcher in `useRender`: change state, never call the renderer by hand.
  Rust caches the photo render, so border-only changes are cheap.
- Styles for content Reka teleports to `<body>` (select popup, tooltip) must be unscoped with a
  namespaced class (`.ui-select-content`): scoped CSS does not reach it.
- Styling goes through design tokens in `ui/src/styles/tokens.css` (light + dark, neutral grays,
  violet accent). No hard-coded colors, no Tailwind. Inter is the font.
- Headless widgets come from Reka UI, wrapped in `src/shared/ui/` as `Ui*` components
  (UiButton, UiSlider, UiSelect, UiMenu, UiDialog, UiTooltip…). Reuse them; add a new one there rather than
  styling raw elements in feature components. Icons come from `lucide-vue-next`.
- Layout: the header holds app-level things only (the qFilm wordmark is the app menu, open, export);
  editing and view controls (undo/redo, compare, zoom) live in the floating `CanvasToolbar`,
  centered on the canvas; the panel fold/unfold is a handle on the canvas edge (`PanelHandle`); the panel
  starts folded and unfolds when the first photo opens (`useInspector`). The strip under the photo
  (`--toolbar-clearance` in `ImageViewport`) mirrors `TOOLBAR_CLEARANCE` in `useViewportNavigation`: change both together. Toasts go at the top.
  On macOS the window uses an overlay title bar: `trafficLightPosition.y` in `tauri.conf.json` centers the
  lights in the 52px header and `header.overlay` in `AppHeader` reserves their width; change them together.
- Components stay small and presentational; logic goes in composables, static data in the feature's own helper files (`controls.ts`, `fonts.ts`…).
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

- Cargo workspace at the root: `crates/core` (`qfilm-core`, the imaging engine, no Tauri dependency, so the
  compiler enforces it) and `desktop` (thin Tauri shell: commands, app state, plugins). Assets shared with the
  UI live in `assets/` (fonts: embedded by Rust, served to the UI through the `@fonts` Vite alias).
- Edition 2024, MSRV 1.88 (let-chains). `rustfmt.toml` and `[workspace.lints]` in the root `Cargo.toml`: clippy pedantic is on, `unsafe` is forbidden.
- Cast lints are allowed only inside `qfilm-core` (pixel math); elsewhere fix the cast.
- Keep `#[allow(...)]` rare, scoped to the item, with a one-line reason.
- Frames are data, not code: a folder with `frame.json` (options) + `frame.svg` (Jinja-style template
  rendered by resvg, composited in linear light). The Frame panel is generated from the manifest.
  Built-in frames live in `crates/core/frames/`; the authoring guide is `docs/FRAMES.md` (keep it in
  sync with `crates/core/src/frame/`). Frame state: `useFrame` (`frame` + `caption` + `memory` for
  `persist` params), pure helpers in `src/features/frames/frameParams.ts` (mirror Rust's coercion).
- Presets live in `crates/core/presets/builtin.json` (embedded at build time, validated by tests).
  Only non-default params are written. To add a look, edit that file.
- Frames engine: `crates/core/src/frame/` (manifest validation → template → raster/compose → registry/store).
  Imported frames are untrusted input: size caps, strict validation, dry-run render, no disk
  extraction, no file access from SVG. Keep those guarantees (and their tests) when touching it.
- `qfilm-core` is UI-agnostic: no Tauri types in it. Tauri glue stays in `desktop/src/commands.rs`.
- Errors: `thiserror` enums, serialized to the frontend as strings.
- The Rust/UI contract is generated: `ui/src/shared/api/bindings.ts` comes from the commands and wire types
  (`tauri-specta`, versions pinned exactly: it is still a release candidate). Never edit it by hand. A command
  is `#[tauri::command]` + `#[specta::specta]` and is registered in `desktop/src/bindings.rs`; a type that
  crosses the bridge derives `specta::Type`. After changing either, run `npm run rust:bindings`; a test fails
  while the file is stale. `ui/src/shared/api/api.ts` is the only consumer: it re-exports the generated commands and
  friendly type names, and holds the native dialogs. Command errors reject with a string (`Throw` mode).
- `desktop/src/commands/` has one module per domain (`image`, `render`, `export`, `frames`); shared state is
  in `state.rs`.
- Tests: Vitest unit tests sit next to their module (`*.test.ts`); composables hold module-level
  state, so load them with `fresh()` from `ui/src/test/fresh.ts` and mock Rust with `apiMock()`. The
  Playwright suite in `ui/e2e/` runs the real UI against `ui/e2e/support/tauri-mock.js` (real frame
  manifests, fake Rust); use the `openApp` fixture and `expect.poll`, not fixed sleeps. Check that a
  new test fails when the behavior it guards is broken.
- Golden-image tests (`crates/core/src/golden.rs`, references in `crates/core/golden/`) guard every frame
  shape/edge and the look pipeline. After an _intended_ rendering change run
  `UPDATE_GOLDEN=1 cargo test golden` and **look at the PNGs** before committing them. Failures
  write the actual output to `target/golden-failures/`. The test scene has a 0–2 gray
  ramp and odd dimensions on purpose; mutation-checked (8/8 injected bugs caught).

## Product direction

- Pitch: a **film look + frame studio** (looks, grain/halation, film frames, captions), not a
  Lightroom clone. Frames and captions are the signature feature. Personal side project for now,
  to be made public later.
- Name: **qFilm** (repo `qfilm`). No real brand appears anywhere: looks, film stocks and edge
  texts are generic (e.g. "Portrait 400", "Ambre"). Keep it that way when adding looks or frames.
  The bundle `identifier` (`io.github.d1nker.qfilm`) follows the GitHub-hosted convention: keep it,
  changing it later moves the app's data folder and breaks signing/updater continuity.
- Icons: source in `branding/icon.svg` (+ `icon.png`). Regenerate with
  `npm run tauri icon branding/icon.png`, then delete `desktop/icons/android` and `ios` (desktop only).
