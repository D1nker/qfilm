import { computed, reactive } from "vue";

const STORAGE_KEY = "qfilm-panels";

function read(): Record<string, boolean> {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    if (typeof stored !== "object" || stored === null) return {};

    return Object.fromEntries(
      Object.entries(stored).filter(
        (entry): entry is [string, boolean] => typeof entry[1] === "boolean",
      ),
    );
  } catch {
    return {};
  }
}

const state = reactive<Record<string, boolean>>(read());

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Stockage indisponible : le choix reste valable pour la session.
  }
}

/// Déplie ces sections d'un coup, quoi qu'on ait choisi avant.
export function openPanels(ids: string[]) {
  for (const id of ids) state[id] = true;
  persist();
}

/// Ouvert ou fermé, pour une section du panneau : ce choix est gardé d'une session à l'autre.
/// `fallback` vaut tant que l'utilisateur n'a rien choisi.
export function usePanelOpen(id: string, fallback: boolean) {
  return computed({
    get: () => state[id] ?? fallback,
    set: (open: boolean) => {
      state[id] = open;
      persist();
    },
  });
}
