import { computed, ref } from "vue";

import type { Preset } from "@/shared/api/api";
import { useEditor } from "@/features/photo";

const FAVORITES_KEY = "qfilm-favorite-looks";
const RECENT_KEY = "qfilm-recent-looks";

/// Assez pour retrouver ce qu'on vient d'essayer, pas assez pour en refaire une seconde liste de looks.
export const MAX_RECENT = 8;

function read(key: string): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(stored)
      ? stored.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
}

function write(key: string, ids: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // Stockage indisponible : la liste reste valable pour la session.
  }
}

/// Des identifiants de looks, gardés d'une session à l'autre. Un identifiant qui ne correspond plus à
/// aucun look (un preset retiré) est ignoré à l'affichage, pas effacé : il peut revenir.
const favorites = ref(read(FAVORITES_KEY));
const recent = ref(read(RECENT_KEY));

const { groupedPresets } = useEditor();

const byId = computed(
  () =>
    new Map(
      groupedPresets.value.flatMap((group) => group.items).map((preset) => [preset.id, preset]),
    ),
);

const resolve = (ids: string[]) =>
  ids.flatMap((id) => {
    const preset = byId.value.get(id);
    return preset ? [preset] : [];
  });

const favoritePresets = computed(() => resolve(favorites.value));
const recentPresets = computed(() => resolve(recent.value));

const isFavorite = (id: string) => favorites.value.includes(id);

function toggleFavorite(id: string) {
  favorites.value = isFavorite(id)
    ? favorites.value.filter((entry) => entry !== id)
    : [...favorites.value, id];
  write(FAVORITES_KEY, favorites.value);
}

/// Le look qu'on vient d'appliquer passe en tête des récents.
function noteUsed(preset: Preset) {
  recent.value = [preset.id, ...recent.value.filter((id) => id !== preset.id)].slice(0, MAX_RECENT);
  write(RECENT_KEY, recent.value);
}

export function useFavorites() {
  return { favoritePresets, recentPresets, isFavorite, toggleFavorite, noteUsed };
}
