import { reactive, ref, watch } from "vue";

import { renderPreview, type TextZone } from "@/shared/api/api";
import { coalescedRunner } from "@/shared/lib/coalescedRunner";
import { useInteraction } from "@/shared/lib/useInteraction";
import { useEditor } from "@/features/photo";
import { useFrame } from "@/features/frames";
import { useGeometry } from "@/features/geometry";
import { useLook } from "@/features/looks";

const { image, error } = useEditor();
const { shown } = useLook();
const { frame } = useFrame();
const { previewGeometry, cropping } = useGeometry();
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

/// En dessous de ce temps (aller-retour complet : rendu, envoi, décodage), un rendu complet suit la
/// main assez vite pour qu'un brouillon, qui floute l'image, soit inutile.
export const DRAFT_THRESHOLD_MS = 100;

/// Durée lissée des derniers rendus complets : c'est elle qui décide si un geste passe en brouillon.
let fullRenderMs = 0;

const refresh = coalescedRunner(
  async () => {
    const current = image.value;
    if (!current) return;

    const draft = dragging.value && fullRenderMs > DRAFT_THRESHOLD_MS;
    const started = performance.now();
    try {
      const result = await renderPreview(
        current.id,
        { ...shown.value },
        { ...previewGeometry.value, crop: { ...previewGeometry.value.crop } },
        // Le cadre se règle sur la photo nue : pas de bordure autour pendant le recadrage.
        cropping.value ? { id: "none", params: {} } : { id: frame.id, params: { ...frame.params } },
        draft,
      );
      if (!draft) {
        const elapsed = performance.now() - started;
        fullRenderMs = fullRenderMs === 0 ? elapsed : (fullRenderMs + elapsed) / 2;
      }
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
  () => [
    image.value?.id,
    shown.value,
    JSON.stringify(previewGeometry.value),
    cropping.value,
    frame.id,
    JSON.stringify(frame.params),
    dragging.value,
  ],
  () => void refresh(),
);

export function useRender() {
  return { view, rendering };
}
