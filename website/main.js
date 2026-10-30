import { assetsByOs } from "./releases.js";

const SYSTEMS = { mac: "macOS", windows: "Windows", linux: "Linux" };

function detectOs() {
  const platform = (navigator.userAgentData?.platform ?? navigator.platform ?? "").toLowerCase();
  const agent = navigator.userAgent.toLowerCase();
  // Un téléphone ou une tablette ne télécharge pas un logiciel de bureau.
  if (/iphone|ipad|android/.test(agent)) return null;
  if (platform.includes("mac") || agent.includes("mac os")) return "mac";
  if (platform.includes("win") || agent.includes("windows")) return "windows";
  if (platform.includes("linux") || agent.includes("linux")) return "linux";
  return null;
}

const current = detectOs();
for (const card of document.querySelectorAll(".os[data-os]")) {
  if (card.dataset.os === current) card.classList.add("recommended");
}

/// Avant / après : le curseur déplace la ligne de partage. Sans JavaScript l'image reste à moitié.
for (const compare of document.querySelectorAll("[data-compare]")) {
  const input = compare.querySelector("input");
  const update = () => compare.style.setProperty("--pos", `${input.value}%`);
  input.addEventListener("input", update);
  update();
}

const section = document.getElementById("download");
const REPOSITORY = section?.dataset.repo;

function showRelease(release) {
  const found = assetsByOs(release.assets);
  if (!Object.values(found).some((list) => list.length > 0)) return;

  section.dataset.state = "ready";
  section.querySelector("[data-status]").textContent = section.dataset.statusReady.replace(
    "{tag}",
    release.tag_name,
  );

  for (const card of section.querySelectorAll(".os[data-os]")) {
    const [first, ...others] = found[card.dataset.os];
    const button = card.querySelector("[data-get]");
    const list = card.querySelector("[data-others]");

    if (!first) {
      // Pas de fichier pour ce système dans cette version : la fiche reste, sans bouton.
      card.classList.add("no-file");
      continue;
    }

    button.href = first.url;

    // Le bouton reste un simple « Télécharger » ; la puce du Mac se lit juste dessous. Le nom de la puce est
    // le même dans les deux langues : rien à traduire.
    if (first.chip && others.some((asset) => asset.chip)) {
      const chip = document.createElement("p");
      chip.className = "chip when-ready";
      chip.textContent = first.chip;
      button.after(chip);
    }

    if (others.length > 0) {
      list.hidden = false;
      list.replaceChildren(
        ...others.map((asset) => {
          const link = document.createElement("a");
          link.href = asset.url;
          link.textContent = asset.chip ? `${asset.chip} · ${asset.name}` : asset.name;
          return link;
        }),
      );
    }
  }

  // Le bouton du haut de page va droit au fichier du système du visiteur, sauf sur un Mac : le navigateur ne
  // distingue pas les puces (Safari se dit toujours Intel), donc on le laisse choisir dans la section.
  const [primary] = found[current] ?? [];
  const cta = document.querySelector("[data-cta]");
  if (cta && primary) {
    const chooses = found[current].some((asset) => asset.chip !== primary.chip);
    if (!chooses) cta.href = primary.url;
    cta.querySelector("span").textContent = section.dataset.ctaReady.replace(
      "{os}",
      SYSTEMS[current],
    );
    document.querySelector("[data-note]")?.setAttribute("hidden", "");
  }
}

async function loadLatestRelease() {
  if (!REPOSITORY) return;
  try {
    const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
    });
    // Pas de version publiée (ou dépôt privé) : l'état « bientôt » reste affiché.
    if (!response.ok) return;
    showRelease(await response.json());
  } catch {
    // Hors ligne ou limite de l'API : même chose.
  }
}

void loadLatestRelease();
