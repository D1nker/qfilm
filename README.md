# Qfilm

A lightweight Lightroom-style photo editor.

**Stack:** Tauri 2 · Vue 3 + TypeScript · Rust imaging core · Reka UI

## Getting started

```bash
npm install
npm run app          # desktop app with hot reload
npm run app:build    # production bundle
```

Requires Node and a Rust toolchain (see the [Tauri prerequisites](https://tauri.app/start/prerequisites/)).

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
cargo test --manifest-path src-tauri/Cargo.toml
```

## Project layout

```
src/
├─ components/       app components
│  ├─ ui/            in-house UI kit built on Reka UI
│  ├─ inspector/     right panel: Looks / Réglages / Cadre tabs
│  └─ export/        export dialog (format, quality, size)
├─ composables/      state and logic (module-level singletons)
├─ lib/              typed Tauri API, static data, helpers
└─ styles/           design tokens (light + dark) and base styles
src-tauri/src/
├─ commands.rs       Tauri commands (the only glue with the frontend)
presets/builtin.json looks (add one by editing this file)
src-tauri/frames/  built-in frames (SVG + manifest) — see docs/FRAMES.md
└─ imaging/          decode, render pipeline, presets, borders, encode
```

Conventions live in [CLAUDE.md](CLAUDE.md).
