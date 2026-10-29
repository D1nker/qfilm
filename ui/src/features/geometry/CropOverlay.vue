<template>
  <div
    ref="overlay"
    class="overlay"
    role="group"
    :aria-label="t('geometry.overlay')"
    @pointerdown.stop
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @dblclick="stopCropping"
  >
    <svg class="dim" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path fill-rule="evenodd" :d="dimPath" />
    </svg>

    <div
      class="crop"
      :style="cropStyle"
      tabindex="0"
      role="group"
      :aria-label="cropLabel"
      @pointerdown="startDrag($event, 'move')"
      @keydown="onKeydown($event, 'move')"
    >
      <span class="third vertical" style="left: 33.333%" />
      <span class="third vertical" style="left: 66.667%" />
      <span class="third horizontal" style="top: 33.333%" />
      <span class="third horizontal" style="top: 66.667%" />

      <button
        v-for="handle in HANDLES"
        :key="handle"
        type="button"
        class="handle"
        :class="handle"
        :data-handle="handle"
        :aria-label="t(`geometry.handles.${handle}`)"
        @pointerdown.stop="startDrag($event, handle)"
        @keydown="onKeydown($event, handle)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import { move, resize, type Handle, type Rect } from "@/features/geometry/crop";
import { useGeometry } from "@/features/geometry/useGeometry";
import { t } from "@/shared/i18n";
import { beginDrag } from "@/shared/lib/useInteraction";

const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

const { crop, context, setCrop, stopCropping } = useGeometry();

const overlay = ref<HTMLElement | null>(null);

interface Drag {
  kind: Handle | "move";
  start: { x: number; y: number };
  origin: Rect;
  end: () => void;
}
let dragging: Drag | null = null;

const dimPath = computed(() => {
  const { x, y, width, height } = crop;
  return `M0 0H100V100H0Z M${x * 100} ${y * 100}H${(x + width) * 100}V${(y + height) * 100}H${x * 100}Z`;
});

const cropStyle = computed(() => ({
  left: `${crop.x * 100}%`,
  top: `${crop.y * 100}%`,
  width: `${crop.width * 100}%`,
  height: `${crop.height * 100}%`,
}));

const cropLabel = computed(() =>
  t("geometry.cropSize", {
    width: Math.round(crop.width * context.value.canvas.width),
    height: Math.round(crop.height * context.value.canvas.height),
  }),
);

function pointer(event: PointerEvent) {
  const box = overlay.value?.getBoundingClientRect();
  if (!box || box.width === 0 || box.height === 0) return { x: 0, y: 0 };

  return { x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.height };
}

function startDrag(event: PointerEvent, kind: Drag["kind"]) {
  if (event.button !== 0) return;

  overlay.value?.setPointerCapture?.(event.pointerId);
  dragging = { kind, start: pointer(event), origin: { ...crop }, end: beginDrag() };
}

function onPointerMove(event: PointerEvent) {
  if (!dragging) return;

  const at = pointer(event);
  if (dragging.kind === "move") {
    const { origin, start } = dragging;
    setCrop(move(origin, at.x - start.x, at.y - start.y, context.value));
    return;
  }
  setCrop(resize({ ...crop }, dragging.kind, at, context.value));
}

function onPointerUp(event: PointerEvent) {
  dragging?.end();
  dragging = null;
  overlay.value?.releasePointerCapture?.(event.pointerId);
}

/// Où se trouve une poignée, pour la déplacer au clavier : elle suit les flèches d'un pas.
function handlePoint(handle: Handle) {
  const { x, y, width, height } = crop;
  return {
    x: handle.includes("w") ? x : handle.includes("e") ? x + width : x + width / 2,
    y: handle.includes("n") ? y : handle.includes("s") ? y + height : y + height / 2,
  };
}

function onKeydown(event: KeyboardEvent, kind: Drag["kind"]) {
  const step = event.shiftKey ? 0.05 : 0.01;
  const delta = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step],
  }[event.key];
  if (!delta) return;

  event.preventDefault();
  const [dx, dy] = delta as [number, number];
  if (kind === "move") {
    setCrop(move({ ...crop }, dx, dy, context.value));
    return;
  }

  const at = handlePoint(kind);
  setCrop(resize({ ...crop }, kind, { x: at.x + dx, y: at.y + dy }, context.value));
}
</script>

<style scoped>
.overlay {
  position: absolute;
  inset: 0;
  touch-action: none;
}

.dim {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  fill: color-mix(in oklch, var(--canvas) 62%, transparent);
  pointer-events: none;
}

.crop {
  position: absolute;
  box-shadow: inset 0 0 0 1px var(--accent);
  cursor: move;
}

.crop:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 2px var(--accent);
}

.third {
  position: absolute;
  background: color-mix(in oklch, var(--text) 38%, transparent);
  pointer-events: none;
}

.third.vertical {
  top: 0;
  bottom: 0;
  width: 1px;
}

.third.horizontal {
  right: 0;
  left: 0;
  height: 1px;
}

.handle {
  position: absolute;
  width: 10px;
  height: 10px;
  padding: 0;
  transform: translate(-50%, -50%);
  border: 1px solid var(--surface);
  border-radius: 2px;
  background: var(--accent);
  box-shadow: var(--shadow-sm);
}

.handle:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.handle.nw,
.handle.n,
.handle.ne {
  top: 0;
}

.handle.sw,
.handle.s,
.handle.se {
  top: 100%;
}

.handle.w,
.handle.e {
  top: 50%;
}

.handle.nw,
.handle.w,
.handle.sw {
  left: 0;
}

.handle.ne,
.handle.e,
.handle.se {
  left: 100%;
}

.handle.n,
.handle.s {
  left: 50%;
}

.handle.nw,
.handle.se {
  cursor: nwse-resize;
}

.handle.ne,
.handle.sw {
  cursor: nesw-resize;
}

.handle.n,
.handle.s {
  cursor: ns-resize;
}

.handle.e,
.handle.w {
  cursor: ew-resize;
}
</style>
