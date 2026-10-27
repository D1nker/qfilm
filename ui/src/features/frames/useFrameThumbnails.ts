import { ref, watch } from "vue";

import { frameThumbnails } from "@/shared/api/api";
import { selectionFor } from "@/features/frames/frameParams";
import { useEditor } from "@/features/photo";
import { useFrame } from "@/features/frames/useFrame";
import { useInspector } from "@/features/inspector";
import { useLook } from "@/features/looks";

const DELAY = 120;

const { image, error } = useEditor();
const { params } = useLook();
const { frames, memory } = useFrame();
const { tab } = useInspector();

const thumbnails = ref<Record<string, string>>({});

let timer: number | undefined;
let sequence = 0;

async function refresh() {
  const current = image.value;
  if (!current || tab.value !== "frame" || frames.value.length === 0) return;

  const run = ++sequence;
  const known = frames.value;

  try {
    const images = await frameThumbnails(
      current.id,
      { ...params.value },
      known.map((info) => selectionFor(info, memory)),
    );
    // Un look ou une photo plus récents ont pris le relais pendant le calcul.
    if (run !== sequence) return;

    thumbnails.value = Object.fromEntries(
      known.map((info, index) => [info.id, images[index] ?? ""]),
    );
  } catch (e) {
    error.value = String(e);
  }
}

watch([tab, image, params, frames, () => JSON.stringify(memory)], () => {
  clearTimeout(timer);
  timer = window.setTimeout(() => void refresh(), DELAY);
});

watch(image, () => {
  sequence++;
  thumbnails.value = {};
});

export function useFrameThumbnails() {
  return { thumbnails };
}
