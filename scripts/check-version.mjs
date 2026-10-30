// Vérifie que le numéro de version est le même partout, et, avec une étiquette (v0.2.0), qu'elle le dit aussi.
//
//   node scripts/check-version.mjs          -> les fichiers sont-ils d'accord entre eux ?
//   node scripts/check-version.mjs v0.2.0   -> et l'étiquette Git aussi ?
//
// Lancé par la publication (`.github/workflows/release.yml`) avant de construire quoi que ce soit : une
// étiquette qui ne correspond pas à l'application produirait des installeurs au mauvais nom.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const json = (path) => JSON.parse(readFileSync(root(path), "utf8"));

/// `version = "x"` de la section `[workspace.package]` : c'est elle que les deux crates héritent.
function workspaceVersion() {
  const cargo = readFileSync(root("Cargo.toml"), "utf8");
  const section = /\[workspace\.package\]([\s\S]*?)(?:\n\[|$)/.exec(cargo)?.[1] ?? "";
  return /^version\s*=\s*"([^"]+)"/m.exec(section)?.[1];
}

const versions = {
  "package.json": json("package.json").version,
  "ui/package.json": json("ui/package.json").version,
  "desktop/tauri.conf.json": json("desktop/tauri.conf.json").version,
  "Cargo.toml ([workspace.package])": workspaceVersion(),
};

const problems = [];
const distinct = new Set(Object.values(versions));
if (distinct.size !== 1 || distinct.has(undefined)) {
  problems.push(
    "Les fichiers ne disent pas la même version :\n" +
      Object.entries(versions)
        .map(([file, version]) => `  ${file.padEnd(36)} ${version ?? "(introuvable)"}`)
        .join("\n"),
  );
}

const tag = process.argv[2];
if (tag) {
  const [version] = distinct;
  if (!/^v\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(tag)) {
    problems.push(`« ${tag} » n'est pas une étiquette de version (attendu : v1.2.3).`);
  } else if (distinct.size === 1 && tag !== `v${version}`) {
    problems.push(`L'étiquette ${tag} ne correspond pas à la version des fichiers (v${version}).`);
  }
}

if (problems.length > 0) {
  console.error(problems.join("\n\n"));
  process.exit(1);
}
console.log(`Version ${[...distinct][0]}${tag ? `, étiquette ${tag}` : ""} : tout est d'accord.`);
