import { computed, ref, watch } from "vue";

import { useEditor } from "@/composables/useEditor";

export type InspectorTab = "looks" | "adjust" | "frame";

const { image } = useEditor();
const hasImage = computed(() => image.value !== null);

const tab = ref<InspectorTab>("looks");
const open = ref(hasImage.value);

watch(hasImage, (present) => {
  open.value = present;
});

function toggle() {
  open.value = !open.value;
}

export function useInspector() {
  return { tab, open, toggle };
}
