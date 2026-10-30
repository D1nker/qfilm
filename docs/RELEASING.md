# Releasing qFilm

A release is a Git tag. Pushing `v0.2.0` makes GitHub build qFilm for macOS (Apple silicon and Intel), Windows and
Linux ([`.github/workflows/release.yml`](../.github/workflows/release.yml)) and attach the installers to a **draft**
release. Nothing is public until you publish it, and the website only offers published releases.

GitHub Actions is free for public repositories (Linux, Windows and macOS runners alike). A private repository has a
monthly allowance in which macOS minutes count ten times: fine for a try-out, not for regular releases.

## Cutting a release

1. **Make sure it is ready.** `npm run check:all && npm run test:all`.
2. **Bump the version** to the same number in the four places that carry it: `package.json`, `ui/package.json`,
   `desktop/tauri.conf.json` and `[workspace.package]` in `Cargo.toml`. Then `cargo check` (it updates
   `Cargo.lock`), `npm install --package-lock-only`, and `npm run version:check` to see they agree.
3. **Commit and tag.**
   ```bash
   git commit -am "chore: release v0.2.0"
   git tag v0.2.0
   git push origin main v0.2.0
   ```
4. **Watch the Actions tab.** The `Release` workflow first checks that the tag matches the manifests, then builds
   four installers in parallel (about 15 to 30 minutes the first time, faster once the Rust cache is warm).
5. **Check the draft** on the Releases page: you should see two `.dmg` (one per Mac architecture), a
   `-setup.exe` and an `.msi` for Windows, and an `.AppImage`, a `.deb` and an `.rpm` for Linux. Install at least one
   on a real machine. Write the release notes.
6. **Publish.** The download section of the website reads `releases/latest` on every visit: it switches from
   "early access" to real downloads by itself, with the visitor's system first.

A build that fails on one system does not stop the others (`fail-fast: false`): fix it and push a new tag, or
delete the draft and the tag and push them again.

## Trying the builds without a release

Actions, then `Release`, then **Run workflow**. It checks the versions and builds everything but publishes
nothing; the installers are kept as artifacts of that run (downloadable for 90 days). Use it after changing the
workflow, a dependency or the bundle settings.

## What users see: unsigned builds

The builds are not code-signed, and the website says so.

- **macOS** binaries are signed "ad hoc" (an Apple silicon Mac will not launch an unsigned one at all), which
  is not an Apple Developer signature. Gatekeeper asks for confirmation: since macOS 15 the user opens
  _System Settings, Privacy and Security_ and clicks **Open Anyway**; the old right-click, Open trick no longer works.
  Keep `APPLE_SIGNING_IDENTITY: "-"` in the workflow: without it only the executable carries the linker's own
  signature, the bundle is not sealed (checked with `codesign -dv` and `spctl`), and Gatekeeper calls the app
  _damaged_ instead of offering Open Anyway. A test pins that line.
- A **local DMG** can fail outside a desktop session (the script that lays out the disk image drives the Finder);
  the GitHub macOS runners have one. `npm run tauri -- build --bundles app` builds just the `.app`.
- **Windows** SmartScreen warns about an unrecognised app: _More info_, then _Run anyway_.
- **Linux** has no such gate: make the AppImage executable and run it.

## Signing, when you want it

- **macOS** needs an Apple Developer account (99 USD a year) for a certificate and notarisation. Add the secrets
  `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD` and
  `APPLE_TEAM_ID` to the repository, give them to the `tauri-action` step, and drop the `APPLE_SIGNING_IDENTITY: "-"`
  line. See the Tauri guide "macOS Code Signing".
- **Windows** needs a code-signing certificate, or a signing service (some offer free signing to open-source
  projects). See the Tauri guide "Windows Code Signing".

Once the builds are signed, rewrite the "First launch" notes of both website pages
(`website/index.html`, `website/fr/index.html`).

## Publishing the website

`.github/workflows/pages.yml` deploys `website/` to GitHub Pages on every push to `main` that touches it. Turn Pages
on once, after the repository is public: Settings, Pages, Source **GitHub Actions** (or `gh api -X POST
repos/D1nker/qfilm/pages -f build_type=workflow`). Public repositories get Pages for free.

## Things to know

- The asset names come from Tauri (`qFilm_0.1.0_aarch64.dmg`, `qFilm_0.1.0_x64-setup.exe`, ...). The website
  sorts them by extension (`website/releases.js`): if you change the bundle targets, check that the page still
  finds a file for each system.
- The workflow's actions are pinned to a major version, not to a commit. For a stricter supply chain, pin each to a
  full commit hash.
- Nothing in the workflow needs a secret other than the `GITHUB_TOKEN` GitHub provides, until you add signing.
