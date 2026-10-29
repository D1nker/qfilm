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
step, preview with `npm run website`), `docs/` and `branding/` are what they say. Frontend paths below are relative to `ui/`.

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
  `inspector/useInspector`, `app/useTheme` (dark default, light), `shared/i18n` (`useLocale`), `app/useShortcuts`, `app/useHelp`
  (shortcuts dialog), `shared/lib/useNotice` (passing messages).
- Rendering is driven by one watcher in `useRender`: change state, never call the renderer by hand.
  Rust caches the photo render, so border-only changes are cheap.
  While a continuous control is dragged (`shared/lib/useInteraction`, set by `UiSlider` on pointer drags only,
  never on keyboard steps) **and full renders have proved slow** (running average over `DRAFT_THRESHOLD_MS`,
  100 ms, measured by `useRender` itself), it asks Rust for a draft (`render_preview(…, draft: true)`, a 960 px
  proxy, much cheaper) and renders in full on release. When full renders keep up there is no draft: a draft
  blurs the photo until the release's full render arrives, so it must only exist when it buys smoothness.
  E2E specs that want a draft call `App.slowRenders()` first (the mock delays full renders only). A draft announces the full render's
  size and text zones (`Rendered::size_at`/`zones_at`) and the viewport keeps that logical size, so nothing
  moves on screen. A new continuous control must use `UiSlider` or call `beginDrag()` itself.
- Styles for content Reka teleports to `<body>` (select popup, tooltip) must be unscoped with a
  namespaced class (`.ui-select-content`): scoped CSS does not reach it.
- Styling goes through design tokens in `ui/src/styles/tokens.css` (light + dark, neutral grays,
  violet accent). No hard-coded colors, no Tailwind. Inter is the font.
- Headless widgets come from Reka UI, wrapped in `src/shared/ui/` as `Ui*` components
  (UiButton, UiSlider, UiSelect, UiMenu, UiDialog, UiTooltip…). Reuse them; add a new one there rather than
  styling raw elements in feature components. Icons come from `lucide-vue-next`.
- Layout: the header holds app-level things only (the qFilm wordmark is the app menu: frames folder and shortcuts; open; export);
  theme and language live behind a preferences button (`PreferencesButton`, a `UiPopover` of `UiSegmented`
  controls) in the canvas's bottom-left corner, on the line of the floating toolbar, so they stay reachable
  before any photo is open;
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
- The UI is bilingual (French, English) with `vue-i18n`, wrapped in `src/shared/i18n`. Never write a
  user-visible string in a component or in logic: add the key to `fr.ts` (the source of truth, it types the
  keys) and to `en.ts` (typed against it, so a missing key does not compile), then use `t("section.key")`
  (strict: only catalogue keys are accepted). Tables of options are functions that call `t` (`sizeOptions()`),
  never constants, so they follow a language change. The language is the system one (French, otherwise
  English), overridable in the qFilm menu and then remembered. Placeholders (`{name}`) must match in both
  languages (tested). Texts that come from data (look names, categories and descriptions, frame manifests)
  are `LocalizedText` in Rust: a plain string or a `{ "fr": …, "en": … }` map; the UI shows them with
  `localized()` and groups on `textKey()` (never on the displayed text). Built-in looks and frames must have
  both `fr` and `en` (tested); imported frames may have any. Still French only: Rust error messages. Tests run in French (Vitest `setup.ts`, Playwright `locale`).
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
- Render pipeline (`crates/core/src/render.rs`), all in linear light: exposure and white balance → noise
  reduction → colour mixer (HSL) → halation → clarity → tone and colour → tone curves → colour grading → sharpening → vignette → grain → highlight shoulder.
  A new setting defaults to the old behaviour (a missing field deserialises to its default), so presets and
  golden images do not move. Every radius is proportional to the image size (or to a 1 800 px reference), so
  the 1 800 px preview matches the full-size export. Edge and sharpness maths use the sRGB-encoded luminance,
  uncapped at 1 (a sun brighter than white must stay untouched). `box_blur` repeats the border pixels: keep it
  that way, a blur that assumes black outside makes halos along the image edges.
- Settings are flat numeric fields of `RenderParams` (the colour mixer's 24 values too: `redHue`,
  `redSaturation`… ), so presets, layering, undo and reset need no special case. Each one needs a control:
  `controls.ts` (or `hsl.ts` for the mixer, `grading.ts` for the grading wheel) lists them and a test fails when a field has none or two. Adding a
  setting means: the Rust field with its default, `neutral.ts`, `ui/e2e/support/tauri-mock.js`, `test/fixtures.ts`,
  the slider, both translations, `npm run rust:bindings`.
- Tone curves are the one setting that is not a flat number: `RenderParams.curves` (`ToneCurves` in
  `crates/core/src/curve.rs`) holds four point lists (`rgb`, `red`, `green`, `blue`), each `[x, y]` in [0, 1] on
  the encoded (on-screen) values; an empty list is the neutral curve, so presets and golden images do not move.
  Rust sanitises every list (sorted, clamped, ends pinned at x = 0 and 1, at most 16 points, `None` when it
  is the diagonal, which skips the stage) and draws a monotone cubic through them (Fritsch-Butland, no
  overshoot) into one table per channel, indexed by the square root of the linear value (cheap, no `powf`
  per pixel). `ui/src/features/looks/curves.ts` has the pure helpers (move, add, remove, nudge) and
  `evalCurve`, a mirror of the Rust spline pinned by shared reference values in both test suites: change
  one, change the other. Layering (`useLook`): a preset's curve fades to the diagonal with its intensity,
  but once a channel is edited (`setCurve`, `curveEdits`) the edited list replaces it (empty = diagonal),
  and edits travel in undo snapshots. `NumericParamKey` (in `neutral.ts`) is "every setting but the
  curves": use it, not `keyof RenderParams`, for anything that does arithmetic on a setting. The editor is
  `CurveEditor` (a click adds a point, a drag moves it, a double-click or Delete removes it, arrows nudge,
  Shift for bigger steps; the ends only slide vertically) inside the collapsed "Courbe des tons" section.
  The pointer is captured on pointerdown, so a double-click lands on the graph, not on the point: hit-test
  by position.
- Geometry (`crates/core/src/geometry.rs`, UI in `features/geometry/`) is not a look: a preset never touches it
  and the intensity does not scale it. `Geometry` = flips, quarter turns, straighten angle (±45°, positive =
  clockwise) and a crop rect in fractions of the turned canvas, applied in that order, **before** the render
  pipeline (vignette, grain and radii then follow the crop), then the frame. `render_preview` and
  `export_image` take it after `params`. The crop is resampled from the original pixels (`geometry::prepare`
  reduces the full image just enough, so a tight crop stays sharp) and the cropped preview is cached in
  `LoadedImage.prepared`; the render cache key is `(RenderParams, Geometry)`. While the crop tool is open the
  UI sends a whole-canvas crop (`previewGeometry`) and the frame `none`: the preview is the rotated photo from
  the 1800 px proxy (instant) with a `CropOverlay` on top; closing it sends the real crop. Touching any
  geometry control (`rotate`, `flip`, `setAngle`, `setAspect`) opens the tool, `R` toggles it (and goes to the
  Frame tab), Enter/Escape/double-click close it, leaving the Frame tab closes it. `crop.ts` holds the pure
  maths (`fits`, `resize`, `move`, `fitInside`, `largestRect`): the crop must always stay inside the rotated
  photo, so no empty corner ever reaches the export; a drag goes as far as `fits` allows (bisection along
  the drag, the valid set being convex). A screen mirror after an odd quarter turn is the _other_ flip of
  the source (`useGeometry.flip`, pinned by a Rust test). Export order: geometry, resize, look.
  Preset and frame thumbnails still show the uncropped photo.
- Colour grading is one wheel with a puck per zone (`ColorWheel`, geometry in `wheel.ts`: hue is the angle from
  the top, saturation the distance from the centre, with a dead zone at the centre where the hue is kept), a
  zone picker and precise sliders for the active zone. Dragging goes through `beginDrag()` so it previews as a
  draft; the pucks are focusable buttons moved with the arrow keys (Shift for bigger steps).
- The Retouche panel lists its sections under three plain headings (`PARTS` in `AdjustPanel`): Tons (Light, Tone
  curve), Couleurs (Color, Color mixer, Color grading), Finition (Detail, Effects). A new section goes under the
  heading that matches its intent; the headings are not collapsible.
- Long panels (Retouche, Cadre) are split into pages by a group rail (`shared/ui/UiRailPanel`): a thin column of
  icons on the panel's left edge, one per page; a click shows that page alone (its content is the slot named
  after its id, the others are `v-show`n away), restarts at the top and **unfolds the page's sections**
  (`openPanels`, even if they had been folded: pages are small, we want to see the content). Every section
  is open by default. The selected page of each tab lives in `useInspector().group` (the host, `InspectorPanel`,
  passes it down with `v-model:group` because `looks` may not import `inspector`), so the crop shortcut can
  say `group.frame = "crop"`. The rail costs 36 px, so the panel is 356 px wide (`App.vue`). The Preset tab has
  none (few categories). Labels and icons come from functions of `t`, and the buttons are named "Aller à X" so
  they never collide with the section headers of the same name. E2E: `App.group(name)` shows a page, and
  `App.openSection(name)` goes to the page of a section first.
- Resets: the Preset tab's (on its first category header) calls `resetLook`, back to Neutral with adjustments
  and curves, which is what choosing the Neutral preset does; it is disabled while `useLook().isPristine`.
  A Retouche page has its own Reset on its heading (that page's sliders and, for Tons, the curves), the Cadre
  tab's is on "Forme". The Preset tab's intensity slider comes after its categories.
- Panel sections are `UiCollapsible`: with an `id` their open/closed state is remembered
  (`shared/lib/panelState`), a `modified` dot flags a section whose setting has moved, and the Retouche panel
  opens only Light and Color by default, with a reset button on each section that has changes. The e2e fixture
  opens every section (`openPanels`, `App.openSection`), so a spec that wants the real defaults sets
  `test.use({ openPanels: false })`.
- The value shown on a `UiSlider` is clickable: it opens a field to type the number (Enter on the focused thumb
  too), Enter or leaving applies it, Escape cancels. When the displayed unit is not the stored one (an
  intensity stored 0–1 shown in %, a mixer hue stored ±1 shown in degrees) pass `edit-scale`.
- A setting whose value is a colour gets a gradient track (`features/looks/tracks.ts`, passed to `UiSlider` as
  `track`): temperature, tint, hues; a saturation track follows the hue it belongs to. Tracks use illustration
  hues, not interface colours, and replace the accent fill.
- Photo fidelity (`decode.rs`, `color.rs`, `encode.rs`): a photo is turned upright from its EXIF orientation
  at decode time; any RGB ICC profile is converted to sRGB, the working space (wide-gamut colours are
  clipped, a known limit); the EXIF travels with the image (`Metadata`, orientation reset to upright so
  nothing is turned twice) and export embeds an sRGB profile, plus the EXIF for JPEG and PNG when
  `keepMetadata` is on (TIFF carries the profile only). Tests build real files (`fixtures.rs`: a JPEG with a
  hand-made EXIF block, a PNG or TIFF with a Display P3 profile) and compute the expected colour from
  published matrices. `image` does not re-read the profile of a tiny TIFF: use realistic sizes in tests.
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
