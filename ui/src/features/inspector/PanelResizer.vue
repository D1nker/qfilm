<template>
  <div
    ref="handle"
    class="resizer"
    :class="{ active: resizing }"
    role="separator"
    aria-orientation="vertical"
    tabindex="0"
    :aria-label="t('panel.resize')"
    :aria-valuemin="MIN_WIDTH"
    :aria-valuemax="maxWidthFor(viewport)"
    :aria-valuenow="current"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @dblclick="setWidth(null)"
    @keydown="onKeydown"
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

import { GUTTER, MIN_WIDTH, maxWidthFor, widthFromPointer } from "@/features/inspector/panelWidth";
import { usePanelWidth } from "@/features/inspector/usePanelWidth";
import { t } from "@/shared/i18n";

const { chosen, resizing, viewport, setWidth } = usePanelWidth();

const handle = ref<HTMLElement | null>(null);

/// La largeur réelle de la carte, y compris quand elle est automatique : le CSS la décide, il faut la
/// mesurer (et la suivre, la fenêtre pouvant changer) pour renseigner `aria-valuenow` et partir de la
/// bonne valeur au clavier.
const current = ref(0);
let observer: ResizeObserver | null = null;

onMounted(() => {
  const aside = handle.value?.parentElement;
  if (!aside) return;

  const measure = () => (current.value = Math.round(aside.getBoundingClientRect().width - GUTTER));
  observer = new ResizeObserver(measure);
  observer.observe(aside);
  measure();
});

onBeforeUnmount(() => observer?.disconnect());

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0) return;

  handle.value?.setPointerCapture?.(event.pointerId);
  resizing.value = true;
}

function onPointerMove(event: PointerEvent) {
  // En cours de geste on ne retient rien : le choix se garde au relâchement.
  if (resizing.value)
    setWidth(widthFromPointer(event.clientX, viewport.value), { remember: false });
}

function onPointerUp(event: PointerEvent) {
  if (!resizing.value) return;

  resizing.value = false;
  handle.value?.releasePointerCapture?.(event.pointerId);
  if (chosen.value !== null) setWidth(chosen.value);
}

/// Flèche gauche : le panneau s'élargit (son bord va vers la gauche) ; Maj pour de plus grands pas.
function onKeydown(event: KeyboardEvent) {
  const step = event.shiftKey ? 48 : 16;
  const base = current.value || MIN_WIDTH;

  if (event.key === "ArrowLeft") setWidth(base + step);
  else if (event.key === "ArrowRight") setWidth(base - step);
  else if (event.key === "Home") setWidth(null);
  else return;

  event.preventDefault();
}
</script>

<style scoped>
/* Une zone de saisie étroite sur le bord gauche de la carte ; seul un filet apparaît au survol. */
.resizer {
  position: absolute;
  top: var(--space-3);
  bottom: var(--space-3);
  left: -4px;
  z-index: 2;
  width: 9px;
  cursor: col-resize;
  touch-action: none;
}

.resizer::after {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: 4px;
  width: 2px;
  border-radius: var(--radius-full);
  background: transparent;
  transition: background var(--duration-fast) var(--ease);
}

.resizer:hover::after,
.resizer.active::after,
.resizer:focus-visible::after {
  background: var(--accent);
}

.resizer:focus-visible {
  outline: none;
}
</style>
