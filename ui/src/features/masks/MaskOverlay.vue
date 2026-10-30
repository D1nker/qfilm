<template>
  <div
    ref="overlay"
    class="overlay"
    role="group"
    :aria-label="t('masks.overlay')"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <svg
      v-if="mask"
      class="lines"
      :viewBox="`0 0 ${size.width} ${size.height}`"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <template v-if="linear">
        <line class="edge" v-bind="edges.start" />
        <line class="edge soft" v-bind="edges.end" />
        <line class="axis" v-bind="axis" />
      </template>
      <g v-else-if="radial" :transform="ellipseTransform">
        <ellipse class="edge" :rx="radii.x" :ry="radii.y" />
        <ellipse class="edge soft" :rx="radii.x * inner" :ry="radii.y * inner" />
      </g>
    </svg>

    <button
      v-for="handle in handles"
      :key="handle.id"
      type="button"
      class="handle"
      :class="[handle.id, { hollow: handle.hollow }]"
      :data-handle="handle.id"
      :style="{ left: `${handle.x * 100}%`, top: `${handle.y * 100}%` }"
      :aria-label="handle.label"
      @pointerdown.stop="startDrag($event, handle.id)"
      @keydown="onKeydown($event, handle.id)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";

import { t } from "@/shared/i18n";
import { beginDrag } from "@/shared/lib/useInteraction";
import {
  moveLinearHandle,
  moveRadialCenter,
  radialHandle,
  setRadialRadius,
  type Point,
} from "@/features/masks/maskShapes";
import { useMasks } from "@/features/masks/useMasks";

type HandleId = "from" | "to" | "center" | "radiusX" | "radiusY";

/// Les poignées du masque choisi, posées sur la photo : deux pour un dégradé linéaire, trois pour une
/// ellipse (le centre et les deux rayons). Seules les poignées captent la souris : le reste de la photo
/// garde son défilement et son zoom.
const { selected: mask, setShape } = useMasks();

/// La racine est toujours là, même sans masque choisi : c'est elle qu'on mesure au montage, et un cadre
/// SVG resté à sa taille de départ (1 × 1) transformerait ses traits en aplat sur toute la photo.
const overlay = ref<HTMLElement | null>(null);
const size = reactive({ width: 1, height: 1 });

let observer: ResizeObserver | undefined;
onMounted(() => {
  const element = overlay.value;
  if (!element) return;

  const measure = () => {
    size.width = Math.max(element.clientWidth, 1);
    size.height = Math.max(element.clientHeight, 1);
  };
  measure();
  observer = new ResizeObserver(measure);
  observer.observe(element);
});
onBeforeUnmount(() => observer?.disconnect());

/// Hauteur / largeur de la photo affichée : les rayons se mesurent en largeurs.
const aspect = computed(() => size.height / size.width);

const linear = computed(() => (mask.value?.shape.kind === "linear" ? mask.value.shape : null));
const radial = computed(() => (mask.value?.shape.kind === "radial" ? mask.value.shape : null));

interface Handle extends Point {
  id: HandleId;
  label: string;
  hollow?: boolean;
}

const handles = computed<Handle[]>(() => {
  const shape = mask.value?.shape;
  if (shape?.kind === "linear") {
    return [
      { id: "from", x: shape.from[0], y: shape.from[1], label: t("masks.handles.from") },
      {
        id: "to",
        x: shape.to[0],
        y: shape.to[1],
        label: t("masks.handles.to"),
        hollow: true,
      },
    ];
  }
  if (shape?.kind === "radial") {
    const [long, short] = [
      radialHandle(shape, 0, aspect.value),
      radialHandle(shape, 1, aspect.value),
    ];
    return [
      {
        id: "center",
        x: shape.center[0],
        y: shape.center[1],
        label: t("masks.handles.center"),
      },
      { id: "radiusX", ...long, label: t("masks.handles.radiusX"), hollow: true },
      { id: "radiusY", ...short, label: t("masks.handles.radiusY"), hollow: true },
    ];
  }
  return [];
});

/// Les deux bords du dégradé : des droites perpendiculaires à son axe, qui traversent toute la photo.
const edges = computed(() => {
  const shape = linear.value;
  if (!shape) return { start: {}, end: {} };

  const [ax, ay] = [shape.from[0] * size.width, shape.from[1] * size.height];
  const [bx, by] = [shape.to[0] * size.width, shape.to[1] * size.height];
  const length = Math.hypot(bx - ax, by - ay) || 1;
  // Perpendiculaire à l'axe, assez longue pour dépasser la photo dans tous les cas.
  const reach = Math.hypot(size.width, size.height);
  const [nx, ny] = [(-(by - ay) / length) * reach, ((bx - ax) / length) * reach];

  const through = (x: number, y: number) => ({ x1: x - nx, y1: y - ny, x2: x + nx, y2: y + ny });
  return { start: through(ax, ay), end: through(bx, by) };
});

const axis = computed(() => {
  const shape = linear.value;
  if (!shape) return {};

  return {
    x1: shape.from[0] * size.width,
    y1: shape.from[1] * size.height,
    x2: shape.to[0] * size.width,
    y2: shape.to[1] * size.height,
  };
});

const radii = computed(() => ({
  x: (radial.value?.radius[0] ?? 0) * size.width,
  y: (radial.value?.radius[1] ?? 0) * size.width,
}));

/// Le flou : l'effet est plein jusqu'à cette ellipse intérieure, puis s'estompe jusqu'au bord.
const inner = computed(() => 1 - Math.max(radial.value?.feather ?? 0, 0.01));

const ellipseTransform = computed(() => {
  const shape = radial.value;
  if (!shape) return "";

  return `translate(${shape.center[0] * size.width} ${shape.center[1] * size.height}) rotate(${shape.angle})`;
});

function pointer(event: PointerEvent): Point {
  const box = overlay.value?.getBoundingClientRect();
  if (!box || box.width === 0 || box.height === 0) return { x: 0, y: 0 };

  return { x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.height };
}

let dragging: { handle: HandleId; end: () => void; element: HTMLElement } | null = null;

function startDrag(event: PointerEvent, handle: HandleId) {
  if (event.button !== 0) return;

  const element = event.currentTarget as HTMLElement;
  element.setPointerCapture?.(event.pointerId);
  dragging = { handle, end: beginDrag(), element };
}

/// Pose une poignée au point donné : c'est la forme qui change, le reste suit.
function placeHandle(handle: HandleId, point: Point) {
  const current = mask.value;
  if (!current) return;

  const shape = current.shape;
  if (shape.kind === "linear" && (handle === "from" || handle === "to")) {
    setShape(current.id, moveLinearHandle(shape, handle, point));
  } else if (shape.kind === "radial") {
    if (handle === "center") setShape(current.id, moveRadialCenter(shape, point));
    if (handle === "radiusX") setShape(current.id, setRadialRadius(shape, 0, point, aspect.value));
    if (handle === "radiusY") setShape(current.id, setRadialRadius(shape, 1, point, aspect.value));
  }
}

function onPointerMove(event: PointerEvent) {
  if (dragging) placeHandle(dragging.handle, pointer(event));
}

function onPointerUp(event: PointerEvent) {
  if (!dragging) return;

  dragging.end();
  dragging.element.releasePointerCapture?.(event.pointerId);
  dragging = null;
}

/// Une poignée se déplace aussi aux flèches (Maj pour un grand pas) : elle part de sa position.
function onKeydown(event: KeyboardEvent, handle: HandleId) {
  const step = event.shiftKey ? 0.05 : 0.01;
  const delta: Record<string, [number, number] | undefined> = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step],
  };
  const move = delta[event.key];
  const from = handles.value.find((entry) => entry.id === handle);
  if (!move || !from) return;

  event.preventDefault();
  placeHandle(handle, { x: from.x + move[0], y: from.y + move[1] });
}
</script>

<style scoped>
.overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  touch-action: none;
}

.lines {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  fill: none;
  pointer-events: none;
}

.edge,
.axis {
  stroke: var(--accent);
  stroke-width: 1.5;
}

/* Le bord où l'effet cesse (ou la limite du plein effet) : en pointillés, il se distingue de l'autre. */
.edge.soft {
  stroke-dasharray: 5 4;
}

.axis {
  stroke-width: 1;
  stroke-opacity: 0.6;
}

.handle {
  position: absolute;
  width: 14px;
  height: 14px;
  padding: 0;
  transform: translate(-50%, -50%);
  border: 2px solid var(--surface);
  border-radius: var(--radius-full);
  background: var(--accent);
  box-shadow: var(--shadow-sm);
  cursor: grab;
  pointer-events: auto;
}

.handle.hollow {
  background: var(--surface);
  border-color: var(--accent);
}

.handle.center {
  width: 18px;
  height: 18px;
}

.handle:active {
  cursor: grabbing;
}

.handle:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
</style>
