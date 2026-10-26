import { computed, nextTick, onMounted, onUnmounted, reactive, watch, type Ref } from "vue";

import type { TextZone } from "@/lib/api";
import { FONT_ASCENT, FONT_FAMILIES } from "@/lib/fonts";
import { useFrame } from "@/composables/useFrame";
import { useRender } from "@/composables/useRender";

const DRAG_THRESHOLD = 4;

interface Options {
  previewImage: Ref<HTMLImageElement | null>;
  captionCanvas: Ref<HTMLCanvasElement | null>;
  onCaptionClick: () => void;
}

export function useCaptionLayer({ previewImage, captionCanvas, onCaptionClick }: Options) {
  const { caption } = useFrame();
  const { view } = useRender();

  // Boîte réellement occupée par l'image : `object-fit: contain` laisse des marges
  // que le CSS seul ne permet pas de connaître.
  const imageBox = reactive({ left: 0, top: 0, width: 0, height: 0 });

  const displayScale = computed(() => (view.width ? imageBox.width / view.width : 0));

  let measureContext: CanvasRenderingContext2D | null = null;

  const captionMetrics = computed(() => {
    const px = Math.min(view.width, view.height) * (caption.size / 100);
    const cx = (caption.x ?? view.captionX) * view.width;
    const cy = (caption.y ?? view.captionY) * view.height;

    measureContext ??= document.createElement("canvas").getContext("2d");
    let width = 0;
    if (measureContext && caption.text.trim()) {
      measureContext.font = `${px}px "${FONT_FAMILIES[caption.font]}"`;
      width = measureContext.measureText(caption.text).width;
    }

    return { px, cx, cy, width };
  });

  const captionZoneStyle = computed(() => {
    const { px, cx, cy, width } = captionMetrics.value;
    const scale = displayScale.value;
    const boxWidth = Math.max(width, view.width * 0.12) * scale;
    const boxHeight = px * scale;

    return {
      left: `${imageBox.left + cx * scale - boxWidth / 2}px`,
      top: `${imageBox.top + cy * scale - boxHeight / 2}px`,
      width: `${boxWidth}px`,
      height: `${boxHeight}px`,
    };
  });

  const captionCanvasStyle = computed(() => ({
    left: `${imageBox.left}px`,
    top: `${imageBox.top}px`,
    width: `${imageBox.width}px`,
    height: `${imageBox.height}px`,
  }));

  function zoneStyle(zone: TextZone) {
    return {
      left: `${imageBox.left + (zone.x / view.width) * imageBox.width}px`,
      top: `${imageBox.top + (zone.y / view.height) * imageBox.height}px`,
      width: `${(zone.width / view.width) * imageBox.width}px`,
      height: `${(zone.height / view.height) * imageBox.height}px`,
    };
  }

  function measureImage() {
    const element = previewImage.value;
    if (!element || !element.naturalWidth) return;

    const box = element.getBoundingClientRect();
    const parent = element.parentElement?.getBoundingClientRect();
    if (!parent) return;

    const scale = Math.min(box.width / element.naturalWidth, box.height / element.naturalHeight);
    const width = element.naturalWidth * scale;
    const height = element.naturalHeight * scale;

    imageBox.left = box.left - parent.left + (box.width - width) / 2;
    imageBox.top = box.top - parent.top + (box.height - height) / 2;
    imageBox.width = width;
    imageBox.height = height;

    drawCaption();
  }

  function drawCaption() {
    const canvas = captionCanvas.value;
    const scale = displayScale.value;
    if (!canvas || !scale) return;

    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(imageBox.width * ratio));
    canvas.height = Math.max(1, Math.round(imageBox.height * ratio));

    const context = canvas.getContext("2d");
    if (!context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
    if (!caption.text.trim()) return;

    const { px, cx, cy } = captionMetrics.value;
    const drawn = px * scale * ratio;

    context.font = `${drawn}px "${FONT_FAMILIES[caption.font]}"`;
    context.fillStyle = caption.color;
    context.textAlign = "center";
    context.textBaseline = "alphabetic";
    // Même règle que Rust : le bloc de texte fait exactement un cadratin de haut.
    context.fillText(
      caption.text,
      cx * scale * ratio,
      (cy - px / 2) * scale * ratio + FONT_ASCENT[caption.font] * drawn,
    );
  }

  watch(
    () => [
      caption.text,
      caption.font,
      caption.size,
      caption.color,
      caption.x,
      caption.y,
      view.captionX,
      view.captionY,
      imageBox.width,
      imageBox.height,
      view.width,
    ],
    () => void nextTick(drawCaption),
  );

  // Un nouveau rendu peut changer les dimensions sans que l'image soit rechargée.
  watch(
    () => [view.width, view.height],
    () => void nextTick(measureImage),
  );

  let drag: { moved: boolean; startX: number; startY: number } | null = null;

  function startCaptionDrag(event: PointerEvent) {
    drag = { moved: false, startX: event.clientX, startY: event.clientY };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function onCaptionDrag(event: PointerEvent) {
    if (!drag) return;
    if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < DRAG_THRESHOLD)
      return;

    drag.moved = true;
    moveCaption(event.clientX, event.clientY);
  }

  function endCaptionDrag(event: PointerEvent) {
    const moved = drag?.moved ?? false;
    drag = null;
    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
    if (!moved) onCaptionClick();
  }

  function moveCaption(clientX: number, clientY: number) {
    const parent = previewImage.value?.parentElement?.getBoundingClientRect();
    if (!parent || !imageBox.width) return;

    const x = (clientX - parent.left - imageBox.left) / imageBox.width;
    const y = (clientY - parent.top - imageBox.top) / imageBox.height;

    caption.x = Math.min(Math.max(x, 0), 1);
    caption.y = Math.min(Math.max(y, 0), 1);
  }

  // L'image change de taille avec la fenêtre, mais aussi quand le panneau se replie.
  const observer = new ResizeObserver(() => measureImage());

  watch(
    previewImage,
    (element, previous) => {
      if (previous) observer.unobserve(previous);
      if (element) observer.observe(element);
    },
    { flush: "post" },
  );

  onMounted(async () => {
    // Sans attendre le chargement, la première mesure de texte serait fausse.
    await Promise.all(
      Object.values(FONT_FAMILIES).map((family) => document.fonts.load(`16px "${family}"`)),
    );
    drawCaption();
  });

  onUnmounted(() => observer.disconnect());

  return {
    measureImage,
    zoneStyle,
    captionZoneStyle,
    captionCanvasStyle,
    startCaptionDrag,
    onCaptionDrag,
    endCaptionDrag,
  };
}
