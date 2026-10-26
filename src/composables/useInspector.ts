import { ref } from "vue";

export type InspectorTab = "looks" | "adjust" | "frame";

const tab = ref<InspectorTab>("looks");
const open = ref(true);

function toggle() {
  open.value = !open.value;
}

export function useInspector() {
  return { tab, open, toggle };
}
