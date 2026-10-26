import { ref } from "vue";

const shortcutsOpen = ref(false);

export function useHelp() {
  return { shortcutsOpen };
}
