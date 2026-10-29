import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch, type Ref } from "vue";

import { useEditor } from "@/features/photo";

/// Marge autour de la photo, la même que le padding du contenu (--space-8).
const PADDING = 32;
/// Bande réservée sous la photo pour la barre flottante (`--toolbar-clearance`).
const TOOLBAR_CLEARANCE = 40;
/// Au-delà, l'aperçu (1800 px) serait agrandi à un point où il devient flou.
const MAX_SCALE = 2;
const STEP = 1.25;
const MIN_ZOOM = 0.2;

interface Options {
  stage: Ref<HTMLElement | null>;
  scroller: Ref<HTMLElement | null>;
  previewImage: Ref<HTMLImageElement | null>;
  /** La taille que l'image aura une fois le rendu complet, quand ce qu'on voit est un brouillon. */
  logicalSize?: () => { width: number; height: number } | null;
}

interface Point {
  x: number;
  y: number;
}

/// Pincement natif de Safari / WebKit (donc du webview macOS de Tauri).
interface GestureLike extends Event {
  scale: number;
  clientX: number;
  clientY: number;
}

function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

export function useViewportNavigation({ stage, scroller, previewImage, logicalSize }: Options) {
  const { image } = useEditor();

  const zoom = ref(1);
  const stageSize = reactive({ width: 0, height: 0 });
  const natural = reactive({ width: 0, height: 0 });
  const spaceDown = ref(false);
  const panning = ref(false);

  const fit = computed(() => {
    if (!natural.width || !stageSize.width) return 1;

    return Math.min(
      1,
      (stageSize.width - PADDING * 2) / natural.width,
      (stageSize.height - PADDING * 2 - TOOLBAR_CLEARANCE) / natural.height,
    );
  });

  const maxZoom = computed(() => Math.max(1, MAX_SCALE / fit.value));
  const zoomPercent = computed(() => Math.round(fit.value * zoom.value * 100));
  const zoomed = computed(() => zoom.value > 1.001);
  const atFit = computed(() => Math.abs(zoom.value - 1) < 0.001);
  const pannable = computed(() => zoomed.value || spaceDown.value);

  const imageStyle = computed(() => {
    if (!natural.width || !stageSize.width) return { visibility: "hidden" as const };
    return { width: `${natural.width * fit.value * zoom.value}px` };
  });

  async function zoomTo(next: number, anchor?: Point) {
    const element = previewImage.value;
    const container = scroller.value;
    const clamped = Math.min(Math.max(next, MIN_ZOOM), maxZoom.value);
    if (!element || !container || clamped === zoom.value) return;

    const rect = element.getBoundingClientRect();
    const bounds = container.getBoundingClientRect();
    const point = anchor ?? {
      x: bounds.left + bounds.width / 2,
      y: bounds.top + bounds.height / 2,
    };
    const fx = (point.x - rect.left) / rect.width;
    const fy = (point.y - rect.top) / rect.height;

    zoom.value = clamped;
    await nextTick();

    const after = element.getBoundingClientRect();
    container.scrollLeft += after.left + fx * after.width - point.x;
    container.scrollTop += after.top + fy * after.height - point.y;
  }

  const zoomIn = () => zoomTo(zoom.value * STEP);
  const zoomOut = () => zoomTo(zoom.value / STEP);
  const fitToWindow = () => zoomTo(1);

  /// Une petite photo, déjà à 100 % une fois ajustée, passe à 200 % pour que le geste serve à
  /// quelque chose.
  function toggleActual(anchor?: Point) {
    if (!atFit.value) return fitToWindow();

    const actual = 1 / fit.value;
    return zoomTo(actual > 1.001 ? actual : 2, anchor);
  }

  function onWheel(event: WheelEvent) {
    if (!event.ctrlKey && !event.metaKey) return;

    event.preventDefault();
    const sensitivity = event.ctrlKey ? 0.01 : 0.005;
    void zoomTo(zoom.value * Math.exp(-event.deltaY * sensitivity), {
      x: event.clientX,
      y: event.clientY,
    });
  }

  let gestureStartZoom = 1;

  function onGestureStart(event: Event) {
    event.preventDefault();
    gestureStartZoom = zoom.value;
  }

  function onGestureChange(event: Event) {
    event.preventDefault();
    const { scale, clientX, clientY } = event as GestureLike;
    void zoomTo(gestureStartZoom * scale, { x: clientX, y: clientY });
  }

  let pan: { x: number; y: number; left: number; top: number } | null = null;

  function onPointerDown(event: PointerEvent) {
    const container = scroller.value;
    if (!container || event.button !== 0) return;

    const onZone = event.target instanceof Element && event.target.closest(".zone, .zone-editor");
    if (!spaceDown.value && (!zoomed.value || onZone)) return;

    event.preventDefault();
    pan = {
      x: event.clientX,
      y: event.clientY,
      left: container.scrollLeft,
      top: container.scrollTop,
    };
    panning.value = true;
    container.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent) {
    const container = scroller.value;
    if (!pan || !container) return;

    container.scrollLeft = pan.left - (event.clientX - pan.x);
    container.scrollTop = pan.top - (event.clientY - pan.y);
  }

  function onPointerUp(event: PointerEvent) {
    pan = null;
    panning.value = false;
    scroller.value?.releasePointerCapture?.(event.pointerId);
  }

  function onImageLoad() {
    const element = previewImage.value;
    if (!element) return;

    // Un brouillon est plus petit que le rendu final : on garde la taille de ce dernier pour que
    // l'affichage ne bouge pas quand on passe de l'un à l'autre.
    const logical = logicalSize?.();
    natural.width = logical?.width ?? element.naturalWidth;
    natural.height = logical?.height ?? element.naturalHeight;
  }

  let lastInput: "pointer" | "keyboard" = "pointer";

  const onPointerInput = () => (lastInput = "pointer");

  function onKeydown(event: KeyboardEvent) {
    if (event.key === "Tab") lastInput = "keyboard";
    if (!image.value || isTyping(event.target)) return;

    // Un bouton atteint à la touche Tab garde son Espace ; un bouton resté « focus » après
    // un clic (Chromium / WebView2) ne doit pas se réactiver quand on veut déplacer la photo.
    // `:focus-visible` ne permet pas de les distinguer : Chromium le passe à vrai dès la
    // première touche pressée.
    const keyboardFocusedButton =
      event.target instanceof HTMLButtonElement && lastInput === "keyboard";

    if (event.key === " " && !keyboardFocusedButton) {
      event.preventDefault();
      spaceDown.value = true;
    } else if (event.metaKey || event.ctrlKey) {
      if (event.key === "=" || event.key === "+") void zoomIn();
      else if (event.key === "-") void zoomOut();
      else if (event.key === "0") void fitToWindow();
      else return;

      // Sans cela, le webview zoomerait toute l'interface.
      event.preventDefault();
    }
  }

  function onKeyup(event: KeyboardEvent) {
    if (event.key !== " ") return;

    // Le « clic » d'un bouton naît au relâchement de la touche : on l'annule aussi.
    if (spaceDown.value) event.preventDefault();
    spaceDown.value = false;
  }

  const releaseSpace = () => (spaceDown.value = false);

  const observer = new ResizeObserver(([entry]) => {
    if (!entry) return;
    stageSize.width = entry.contentRect.width;
    stageSize.height = entry.contentRect.height;
  });

  watch(stage, (element, previous) => {
    if (previous) observer.unobserve(previous);
    if (element) observer.observe(element);
  });

  watch(image, () => {
    zoom.value = 1;
    scroller.value?.scrollTo(0, 0);
  });

  onMounted(() => {
    window.addEventListener("keydown", onKeydown);
    window.addEventListener("keyup", onKeyup);
    window.addEventListener("blur", releaseSpace);
    window.addEventListener("pointerdown", onPointerInput, true);
  });

  onUnmounted(() => {
    observer.disconnect();
    window.removeEventListener("keydown", onKeydown);
    window.removeEventListener("keyup", onKeyup);
    window.removeEventListener("blur", releaseSpace);
    window.removeEventListener("pointerdown", onPointerInput, true);
  });

  return {
    zoom,
    zoomPercent,
    zoomed,
    atFit,
    pannable,
    panning,
    spaceDown,
    imageStyle,
    zoomIn,
    zoomOut,
    fitToWindow,
    toggleActual,
    onWheel,
    onGestureStart,
    onGestureChange,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onImageLoad,
  };
}
