import { reactive, ref, watch } from "vue";

import { renderPreview, type TextZone } from "@/shared/api/api";
import { coalescedRunner } from "@/shared/lib/coalescedRunner";
import { useInteraction } from "@/shared/lib/useInteraction";
import { useEditor } from "@/features/photo";
import { useFrame } from "@/features/frames";
import { useLook } from "@/features/looks";

const { image, error } = useEditor();
const { params } = useLook();
const { frame } = useFrame();
const { dragging } = useInteraction();

const view = reactive({
  src: "",
  width: 1,
  height: 1,
  /** Vrai quand l'image affichée est un brouillon : sa taille réelle n'est pas celle de `width` × `height`. */
  draft: false,
  zones: [] as TextZone[],
  captionX: 0.5,
  captionY: 0.9,
});
const rendering = ref(false);

const refresh = coalescedRunner(
  async () => {
    const current = image.value;
    if (!current) return;

    const draft = dragging.value;
    try {
      const result = await renderPreview(
        current.id,
        { ...params.value },
        { id: frame.id, params: { ...frame.params } },
        draft,
      );
      // La photo a pu changer pendant le rendu.
      if (image.value?.id !== current.id) return;

      view.src = result.image;
      view.draft = draft;
      view.width = result.width;
      view.height = result.height;
      view.zones = result.zones;
      [view.captionX, view.captionY] = result.captionCenter;
      error.value = "";
    } catch (e) {
      error.value = String(e);
    }
  },
  (busy) => (rendering.value = busy),
);

watch(image, (current) => {
  view.src = current?.preview ?? "";
  view.draft = false;
  view.zones = [];
});

// Rust met le rendu photo en cache : seuls le cadre et ses réglages demandent un nouveau
// tracé. La légende n'y figure pas exprès, le webview la dessine lui-même.
watch(
  () => [image.value?.id, params.value, frame.id, JSON.stringify(frame.params), dragging.value],
  () => void refresh(),
);

export function useRender() {
  return { view, rendering };
}
