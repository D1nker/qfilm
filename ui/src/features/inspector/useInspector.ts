import { computed, reactive, ref, watch } from "vue";

import { useEditor } from "@/features/photo";

export type InspectorTab = "looks" | "adjust" | "frame";

const { image } = useEditor();
const hasImage = computed(() => image.value !== null);

const tab = ref<InspectorTab>("looks");

/// Le groupe affiché dans chaque onglet à rampe d'icônes ; le raccourci de recadrage, par exemple, sait
/// ainsi où aller.
const group = reactive({ adjust: "tone", frame: "frame" });
const open = ref(hasImage.value);

watch(hasImage, (present) => {
  open.value = present;
});

function toggle() {
  open.value = !open.value;
}

export function useInspector() {
  return { tab, group, open, toggle };
}
