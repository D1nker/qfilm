import { computed, onBeforeUnmount, onMounted, ref } from "vue";

import { AUTO_WIDTH, clampWidth } from "@/features/inspector/panelWidth";

const STORAGE_KEY = "qfilm-panel-width";

function read(): number | null {
  try {
    const stored = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(stored) && stored > 0 ? stored : null;
  } catch {
    return null;
  }
}

function write(width: number | null) {
  try {
    if (width === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, String(width));
  } catch {
    // Stockage indisponible : le choix reste valable pour la session.
  }
}

/// `null` : automatique. Sinon, ce que l'utilisateur a choisi, en pixels.
const chosen = ref<number | null>(read());
const resizing = ref(false);
const viewport = ref(window.innerWidth);

/// La valeur CSS de la largeur, que la fenêtre peut borner après coup (elle a pu rétrécir).
const cssWidth = computed(() =>
  chosen.value === null ? AUTO_WIDTH : `${clampWidth(chosen.value, viewport.value)}px`,
);

function setWidth(width: number | null, { remember = true } = {}) {
  chosen.value = width === null ? null : clampWidth(width, viewport.value);
  if (remember) write(chosen.value);
}

export function usePanelWidth() {
  const onResize = () => (viewport.value = window.innerWidth);

  onMounted(() => window.addEventListener("resize", onResize));
  onBeforeUnmount(() => window.removeEventListener("resize", onResize));

  return { chosen, cssWidth, resizing, viewport, setWidth };
}
