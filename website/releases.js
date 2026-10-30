/// Range les fichiers d'une version GitHub par système. Les noms viennent de Tauri
/// (`qFilm_0.1.0_aarch64.dmg`, `qFilm_0.1.0_x64-setup.exe`, `qFilm_0.1.0_amd64.AppImage`…).

/// Du plus recommandé au moins recommandé : l'installeur avant le paquet nu. Les motifs finissent le nom
/// du fichier : les signatures (`.dmg.sig`) et le manifeste de l'updater (`latest.json`) n'y répondent pas.
const KINDS = {
  // Pas de `.app.tar.gz` : ce sont les paquets de l'updater de Tauri, pas un téléchargement à la main.
  mac: [/\.dmg$/i],
  windows: [/-setup\.exe$/i, /\.msi$/i, /\.exe$/i],
  linux: [/\.appimage$/i, /\.deb$/i, /\.rpm$/i],
};

/// Un Mac a deux puces et le navigateur ne sait pas les distinguer (Safari se dit toujours Intel) : on nomme
/// la puce de chaque installeur, sinon le gros bouton enverrait un Mac Intel vers un fichier qui ne s'ouvre pas.
/// Rien pour Windows ni Linux : un seul installeur de chaque.
function chipOf(os, name) {
  if (os !== "mac") return "";
  if (/aarch64|arm64/i.test(name)) return "Apple silicon";
  if (/x64|x86_64/i.test(name)) return "Intel Mac";
  return "";
}

export function assetsByOs(assets = []) {
  const found = { mac: [], windows: [], linux: [] };

  for (const asset of assets) {
    for (const [os, kinds] of Object.entries(KINDS)) {
      const rank = kinds.findIndex((kind) => kind.test(asset.name));
      if (rank !== -1) {
        found[os].push({
          name: asset.name,
          url: asset.browser_download_url,
          size: asset.size,
          chip: chipOf(os, asset.name),
          rank,
        });
        break;
      }
    }
  }

  // À rang égal, Apple silicon d'abord : c'est le Mac qu'on achète depuis 2020.
  for (const list of Object.values(found)) {
    list.sort(
      (a, b) => a.rank - b.rank || (b.chip === "Apple silicon") - (a.chip === "Apple silicon"),
    );
  }
  return found;
}
