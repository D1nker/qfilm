# qFilm website

A static landing page in English (`index.html`) and French (`fr/index.html`). No framework and no build
step: plain HTML, one stylesheet, one small script. Preview it with `npm run website` (port 4000).

## What is where

|                               |                                                                                                                        |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `index.html`, `fr/index.html` | The two pages. Same sections, same order, same images: `ui/e2e/website.spec.ts` fails when one falls behind.           |
| `style.css`                   | Dark first (a darkroom), light when the visitor's system asks for it. Design tokens at the top.                        |
| `main.js`, `releases.js`      | Detects the visitor's system, drives the before/after slider and flips the download section when GitHub has a release. |
| `fonts/`                      | Inter, self-hosted (SIL OFL, license included). The page asks the network for nothing but the release API.             |
| `img/`                        | Made by the tools below, never by hand.                                                                                |
| `images.json`                 | Which photo, look and frame make each image of the site.                                                               |

## The images are real renders

Every picture of the site is produced by qFilm's own engine, so none is a mock-up.

1. Put your photos in `~/qFilm-site-photos` (or set `SITE_PHOTOS`) and name them in `images.json`.
2. `npm run website:images` renders each entry: the look, the frame, the sizes. Metadata is never carried over
   (no EXIF, no GPS, no camera name), and a width larger than the photo is skipped.
3. `npm run website:screenshots` takes the app screenshots (crop, curves, colour mixer, masks) in both languages,
   and the social-sharing cards, from the real UI with the rendered photo shown in it.
4. After changing the photos, update each image's `alt` text if the scene changed: the descriptions say what
   the effect is, and should say what the picture shows.

`images.json` entries accept the same names as the app: `preset` (a look id from
`crates/core/presets/builtin.json`), `params` (extra settings), `geometry` (a crop), `frame` (an id and its
parameters from `crates/core/frames/*/frame.json`), `caption`, `widths`, and `before` (also write the plain photo
in the same frame, for a before/after).

## Downloads

Releases come from `.github/workflows/release.yml` (see `docs/RELEASING.md`). Until the first one is published,
the download section says so. The page asks GitHub for
`/repos/D1nker/qfilm/releases/latest`; as soon as it returns files, the section switches by itself to one button
per system, the visitor's system first. Files are sorted by name (`releases.js`): `.dmg`, `-setup.exe`/`.msi`,
`.AppImage`/`.deb`/`.rpm`. A system without a file in the release keeps its "coming soon".

## Publishing

The repository points at `https://d1nker.github.io/qfilm`. GitHub Pages serves a private repository only on a
paid plan, so the site goes live when the repository is public. Pages can only serve the repository root or
`docs/`, so `.github/workflows/pages.yml` deploys the `website/` folder itself (minus this README and
`images.json`) on every push to `main` that touches it. Turn it on once: Settings, Pages, Source **GitHub Actions**
(or `gh api -X POST repos/D1nker/qfilm/pages -f build_type=workflow`). All links are relative, so the `/qfilm/`
base path works; `404.html` is the only file that uses absolute `/qfilm/` paths.

## Editing the copy

Edit both pages together. A new section, card or question must exist in both languages, or the parity test fails.
