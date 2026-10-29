import { computed, ref } from "vue";
import { getCurrentWebview } from "@tauri-apps/api/webview";

import {
  closeImage,
  listPresets,
  openImage,
  pickImage,
  presetThumbnails,
  type ImageMeta,
  type Preset,
} from "@/shared/api/api";
import { textKey } from "@/shared/i18n";
import { groupBy } from "@/shared/lib/groupBy";

const presets = ref<Preset[]>([]);
const thumbnails = ref<Record<string, string>>({});
const image = ref<ImageMeta | null>(null);

const status = ref("");
const error = ref("");
const loading = ref(false);
const comparing = ref(false);

/// « Neutre » existe (c'est l'état de départ, et ce que « Réinitialiser » rétablit), mais ne se choisit pas :
/// la liste n'a pas à proposer de ne rien faire.
const groupedPresets = computed(() =>
  groupBy(
    presets.value.filter((preset) => preset.id !== "neutral"),
    (preset) => textKey(preset.category),
  ).map(([key, items]) => ({
    key,
    title: items[0]?.category ?? key,
    items,
  })),
);

async function init() {
  presets.value = await listPresets();

  await getCurrentWebview().onDragDropEvent((event) => {
    if (event.payload.type !== "drop") return;

    // Une archive .zip est un cadre à importer (voir `useFrame`), pas une photo.
    const [path] = event.payload.paths;
    if (path && !path.toLowerCase().endsWith(".zip")) void load(path);
  });
}

async function browse() {
  const path = await pickImage();
  if (path) await load(path);
}

async function load(path: string) {
  loading.value = true;
  error.value = "";
  try {
    const previous = image.value;
    const meta = await openImage(path);
    if (previous) await closeImage(previous.id);

    thumbnails.value = {};
    image.value = meta;
    status.value = `${meta.width} × ${meta.height} px`;

    // Après l'affichage de la photo : les vignettes ne doivent rien retarder.
    void loadThumbnails(meta.id);
  } catch (e) {
    error.value = String(e);
  } finally {
    loading.value = false;
  }
}

async function loadThumbnails(id: string) {
  try {
    const list = await presetThumbnails(id);
    // La photo a pu changer pendant le calcul.
    if (image.value?.id !== id) return;

    thumbnails.value = Object.fromEntries(list.map((thumbnail) => [thumbnail.id, thumbnail.image]));
  } catch (e) {
    error.value = String(e);
  }
}

export function useEditor() {
  return {
    image,
    thumbnails,
    status,
    error,
    loading,
    comparing,
    groupedPresets,
    init,
    browse,
    load,
  };
}
