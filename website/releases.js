/// Range les fichiers d'une version GitHub par système. Les noms viennent de Tauri
/// (`qFilm_0.1.0_aarch64.dmg`, `qFilm_0.1.0_x64-setup.exe`, `qFilm_0.1.0_amd64.AppImage`…).

/// Du plus recommandé au moins recommandé : l'installeur avant le paquet nu. Les motifs finissent le nom
/// du fichier : les signatures (`.dmg.sig`) et le manifeste de l'updater (`latest.json`) n'y répondent pas.
const KINDS = {
  mac: [/\.dmg$/i, /\.app\.tar\.gz$/i],
  windows: [/-setup\.exe$/i, /\.msi$/i, /\.exe$/i],
  linux: [/\.appimage$/i, /\.deb$/i, /\.rpm$/i],
};

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
          rank,
        });
        break;
      }
    }
  }

  for (const list of Object.values(found)) list.sort((a, b) => a.rank - b.rank);
  return found;
}

export function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  const megabytes = bytes / 1024 / 1024;
  return `${megabytes >= 10 ? Math.round(megabytes) : megabytes.toFixed(1)} MB`;
}
