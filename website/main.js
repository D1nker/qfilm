const REPOSITORY = "D1nker/qfilm";

function detectOs() {
  const platform = (navigator.userAgentData?.platform ?? navigator.platform ?? "").toLowerCase();
  const agent = navigator.userAgent.toLowerCase();
  if (platform.includes("mac") || agent.includes("mac os")) return "mac";
  if (platform.includes("win") || agent.includes("windows")) return "windows";
  if (platform.includes("linux") || agent.includes("linux")) return "linux";
  return null;
}

const current = detectOs();
for (const link of document.querySelectorAll("[data-os]")) {
  if (link.dataset.os === current) link.classList.add("recommended");
}

async function showLatestRelease() {
  const status = document.getElementById("status");
  try {
    const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/releases/latest`);
    if (!response.ok) return;
    const release = await response.json();
    status.textContent = `Latest version: ${release.tag_name}`;
    for (const link of document.querySelectorAll("[data-os]")) link.href = release.html_url;
  } catch {
    // Hors ligne ou limite de l'API : le message par défaut reste affiché.
  }
}

void showLatestRelease();
