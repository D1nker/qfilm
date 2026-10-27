import { ref } from "vue";

const DURATION = 3000;

/// Un message passager (« Export terminé »), qui s'efface seul.
const notice = ref("");
let timer: number | undefined;

function show(message: string) {
  clearTimeout(timer);
  notice.value = message;
  timer = window.setTimeout(() => (notice.value = ""), DURATION);
}

export function useNotice() {
  return { notice, show };
}
