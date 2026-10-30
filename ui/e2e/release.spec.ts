import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

/// La publication : une étiquette Git construit les installeurs (`.github/workflows/release.yml`). Rien de
/// tout cela ne se voit avant d'étiqueter, d'où des tests sur ce qui coûterait cher à découvrir ce jour-là.

const repo = (path: string) => fileURLToPath(new URL(`../../${path}`, import.meta.url));
const read = (path: string) => readFileSync(repo(path), "utf8");

/// Lance le script de cohérence de version, dans un dossier donné (par défaut, le dépôt).
function checkVersion(tag?: string, root = repo("")) {
  try {
    const out = execFileSync(
      "node",
      [join(root, "scripts/check-version.mjs"), ...(tag ? [tag] : [])],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    return { ok: true, output: out };
  } catch (error) {
    const failure = error as { stderr?: string };
    return { ok: false, output: failure.stderr ?? "" };
  }
}

test.describe("the version check", () => {
  const version = (JSON.parse(read("package.json")) as { version: string }).version;

  test("passes on the repository as it is, with its own tag", () => {
    expect(checkVersion().ok).toBe(true);
    expect(checkVersion(`v${version}`).ok).toBe(true);
  });

  test("refuses a tag that is not the version, or not a version at all", () => {
    for (const tag of ["v9.9.9", `${version}`, "main", "v1.2", "release-1"]) {
      const result = checkVersion(tag);
      expect(result.ok, tag).toBe(false);
      expect(result.output.length, tag).toBeGreaterThan(0);
    }
  });

  test("refuses manifests that disagree, and says which one", () => {
    // Une copie du dépôt réduite à ce que le script lit : on y change un fichier à la fois.
    const files = ["package.json", "ui/package.json", "desktop/tauri.conf.json", "Cargo.toml"];
    const edits: Record<string, (text: string) => string> = {
      "package.json": (text) => text.replace(`"version": "${version}"`, '"version": "9.9.9"'),
      "ui/package.json": (text) => text.replace(`"version": "${version}"`, '"version": "9.9.9"'),
      "desktop/tauri.conf.json": (text) =>
        text.replace(`"version": "${version}"`, '"version": "9.9.9"'),
      "Cargo.toml": (text) => text.replace(`version = "${version}"`, 'version = "9.9.9"'),
    };

    for (const broken of files) {
      const dir = mkdtempSync(join(tmpdir(), "qfilm-version-"));
      try {
        mkdirSync(join(dir, "scripts"));
        cpSync(repo("scripts/check-version.mjs"), join(dir, "scripts/check-version.mjs"));
        for (const file of files) {
          mkdirSync(join(dir, file, ".."), { recursive: true });
          const text = read(file);
          const next = file === broken ? (edits[file]?.(text) ?? text) : text;
          expect(next === text, `${broken} : la modification n'a rien changé`).toBe(
            file !== broken,
          );
          writeFileSync(join(dir, file), next);
        }

        const result = checkVersion(undefined, dir);

        expect(result.ok, broken).toBe(false);
        expect(result.output, broken).toContain(
          broken.replace("Cargo.toml", "Cargo.toml ([workspace.package])"),
        );
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });
});

test.describe("the release workflow", () => {
  const workflow = read(".github/workflows/release.yml");

  test("starts on a version tag, or by hand, and on nothing else", () => {
    expect(workflow).toMatch(/on:\s*\n\s+push:\s*\n\s+tags:\s*\["v\*"\]\s*\n\s+workflow_dispatch:/);
    // `pull_request_target` donnerait des droits d'écriture au code d'un tiers.
    expect(workflow).not.toContain("pull_request");
  });

  test("only ever drafts a release: nothing is public until it is published by hand", () => {
    expect(workflow).toContain("releaseDraft: true");
    expect(workflow).not.toContain("releaseDraft: false");
  });

  test("checks the version before building anything", () => {
    expect(workflow).toContain("node scripts/check-version.mjs");
    expect(workflow).toMatch(/build:\s*\n\s+name: [^\n]+\n\s+needs: version/);
  });

  test("builds both Macs, Windows and Linux, and one failing does not cancel the rest", () => {
    for (const target of ["aarch64-apple-darwin", "x86_64-apple-darwin"]) {
      expect(workflow).toContain(`target: ${target}`);
    }
    expect(workflow).toContain("os: ubuntu-22.04");
    expect(workflow).toContain("os: windows-latest");
    expect(workflow).toContain("fail-fast: false");
  });

  test("signs the Mac bundle ad hoc: without it Apple silicon reports the app as damaged", () => {
    expect(workflow).toMatch(/APPLE_SIGNING_IDENTITY:\s*"-"/);
  });

  test("does not paste an untrusted tag name into a command", () => {
    // Le nom d'une étiquette est une entrée de l'utilisateur : par `env`, jamais dans `run:`.
    for (const line of workflow.split("\n").filter((entry) => /^\s+run:/.test(entry))) {
      expect(line, line).not.toContain("github.ref_name");
      expect(line, line).not.toContain("github.head_ref");
    }
  });

  test("gives write access to the build job only, and reads everywhere else", () => {
    expect(workflow).toMatch(/^permissions:\s*\n\s+contents: read/m);
    expect(workflow.match(/contents: write/g)).toHaveLength(1);
    expect(workflow).toMatch(/build:[\s\S]*permissions:\s*\n\s+contents: write/);
  });

  test("pins every action to a version, never to a moving branch", () => {
    const uses = [...workflow.matchAll(/uses:\s*([^\s#]+)/g)].map((match) => match[1] ?? "");
    expect(uses.length).toBeGreaterThanOrEqual(6);
    for (const action of uses) {
      expect(action, action).toMatch(/@(v\d+|stable)$/);
    }
  });

  test("needs no secret but the token GitHub provides", () => {
    const secrets = [...workflow.matchAll(/secrets\.([A-Z_]+)/g)].map((match) => match[1]);
    expect(new Set(secrets)).toEqual(new Set(["GITHUB_TOKEN"]));
  });
});

test.describe("the release guide", () => {
  test("names the commands and files that exist", () => {
    const guide = read("docs/RELEASING.md");
    const scripts = (JSON.parse(read("package.json")) as { scripts: Record<string, string> })
      .scripts;

    expect(scripts["version:check"]).toContain("scripts/check-version.mjs");
    expect(guide).toContain("npm run version:check");
    expect(guide).toContain(".github/workflows/release.yml");
    expect(read("README.md")).toContain("docs/RELEASING.md");
  });
});

test.describe("the website workflow", () => {
  const workflow = read(".github/workflows/pages.yml");

  test("publishes on pushes to main that touch the site, or by hand", () => {
    expect(workflow).toMatch(/push:\s*\n\s+branches: \[main\]\s*\n\s+paths:/);
    expect(workflow).toContain('- "website/**"');
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toContain("pull_request");
  });

  test("only the deploy job may publish, and it reads the repository and nothing more", () => {
    expect(workflow).toMatch(/^permissions:\s*\n\s+contents: read/m);
    expect(workflow).toMatch(
      /deploy:[\s\S]*permissions:\s*\n\s+pages: write\s*#[^\n]*\n\s+id-token: write/,
    );
    expect(workflow.match(/pages: write/g)).toHaveLength(1);
    expect(workflow).not.toContain("contents: write");
  });

  test("keeps the repository-only files out of the published site", () => {
    expect(workflow).toContain("--exclude README.md");
    expect(workflow).toContain("--exclude images.json");
    expect(workflow).toMatch(/path: _site/);
  });

  test("pins its actions and needs no secret", () => {
    const uses = [...workflow.matchAll(/uses:\s*([^\s#]+)/g)].map((match) => match[1] ?? "");
    expect(uses.length).toBeGreaterThanOrEqual(4);
    for (const action of uses) expect(action, action).toMatch(/@v\d+$/);
    expect(workflow).not.toContain("secrets.");
  });

  test("serves only files that exist: every page and asset the site links is in the folder", () => {
    for (const file of [
      "index.html",
      "fr/index.html",
      "404.html",
      "robots.txt",
      "sitemap.xml",
      "icon.svg",
    ]) {
      expect(() => read(`website/${file}`), file).not.toThrow();
    }
  });
});

test.describe("the repository's public face", () => {
  test("has a security policy that tells where to report", () => {
    const policy = read("SECURITY.md");

    expect(policy).toContain("Report a vulnerability");
    expect(policy).toContain("privately");
  });
});
