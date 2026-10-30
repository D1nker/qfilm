import { ref } from "vue";

/// Le panneau des préférences (thème, langue), ouvert du bouton ou du clavier (⌘,).
const preferencesOpen = ref(false);

export function usePreferences() {
  return { preferencesOpen };
}
