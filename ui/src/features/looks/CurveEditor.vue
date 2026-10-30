<template>
  <div
    ref="graph"
    class="graph"
    :class="{ disabled }"
    role="group"
    :aria-label="label"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @dblclick="onDoubleClick"
  >
    <svg class="plot" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path class="grid" d="M25 0V100M50 0V100M75 0V100M0 25H100M0 50H100M0 75H100" />
      <path class="diagonal" d="M0 100L100 0" />
      <polyline class="line" :points="line" :style="{ stroke: color }" />
    </svg>
    <button
      v-for="(point, index) in points"
      :key="index"
      type="button"
      class="point"
      :style="pointStyle(point)"
      :data-point="index"
      :disabled="disabled"
      :aria-label="pointLabel(point, index)"
      @keydown="onKeydown($event, index)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import {
  addPoint,
  movePoint,
  nudgePoint,
  removePoint,
  sampleCurve,
  type CurvePoint,
} from "@/features/looks/curves";
import { t } from "@/shared/i18n";
import { beginDrag } from "@/shared/lib/useInteraction";

const props = defineProps<{
  label: string;
  /// Au moins deux points, triés : les extrémités d'abord et en dernier.
  points: CurvePoint[];
  color: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{ change: [points: CurvePoint[]] }>();

const graph = ref<HTMLElement | null>(null);
let dragging: { index: number; end: () => void } | null = null;

const line = computed(() =>
  sampleCurve(props.points)
    .map(([x, y]) => `${x * 100},${(1 - y) * 100}`)
    .join(" "),
);

function pointerAt(event: MouseEvent): CurvePoint {
  const box = graph.value?.getBoundingClientRect();
  if (!box || box.width === 0) return [0, 0];

  return [(event.clientX - box.left) / box.width, 1 - (event.clientY - box.top) / box.height];
}

function onPointerDown(event: PointerEvent) {
  if (props.disabled || event.button !== 0) return;

  const target =
    event.target instanceof Element ? event.target.closest<HTMLElement>("[data-point]") : null;
  let index = target ? Number(target.dataset.point) : -1;

  // Un clic dans le vide ajoute un point à cet endroit et le saisit aussitôt.
  if (index < 0) {
    const [x, y] = pointerAt(event);
    const added = addPoint(props.points, x, y);
    if (!added) return;

    emit("change", added.points);
    index = added.index;
  }

  graph.value?.setPointerCapture?.(event.pointerId);
  dragging = { index, end: beginDrag() };
}

function onPointerMove(event: PointerEvent) {
  if (!dragging) return;

  const [x, y] = pointerAt(event);
  emit("change", movePoint(props.points, dragging.index, x, y));
}

function onPointerUp(event: PointerEvent) {
  dragging?.end();
  dragging = null;
  graph.value?.releasePointerCapture?.(event.pointerId);
}

/// La capture du pointeur redirige le double-clic vers le graphique, pas vers le bouton visé : on
/// retrouve le point à sa position.
const GRAB_RADIUS = 0.05;

function onDoubleClick(event: MouseEvent) {
  if (props.disabled) return;

  const [x, y] = pointerAt(event);
  const index = props.points.findIndex(([px, py]) => Math.hypot(px - x, py - y) <= GRAB_RADIUS);
  if (index >= 0) remove(index);
}

function remove(index: number) {
  const next = removePoint(props.points, index);
  if (next) emit("change", next);
}

function onKeydown(event: KeyboardEvent, index: number) {
  if (event.key === "Delete" || event.key === "Backspace") {
    event.preventDefault();
    remove(index);
    return;
  }

  const next = nudgePoint(props.points, index, event.key, !event.shiftKey);
  if (!next) return;

  event.preventDefault();
  emit("change", next);
}

const pointStyle = ([x, y]: CurvePoint) => ({
  left: `${x * 100}%`,
  top: `${(1 - y) * 100}%`,
  borderColor: props.color,
});

const percent = (value: number) => Math.round(value * 100);

const pointLabel = ([x, y]: CurvePoint, index: number) =>
  t("adjust.curves.point", { n: index + 1, input: percent(x), output: percent(y) });
</script>

<style scoped>
.graph {
  position: relative;
  width: min(100%, 260px);
  aspect-ratio: 1;
  margin: var(--space-3) auto 0;
  border-radius: var(--radius-md);
  background: var(--surface);
  box-shadow: inset 0 0 0 1px var(--border-strong);
  cursor: crosshair;
  touch-action: none;
}

.graph.disabled {
  opacity: 0.45;
  cursor: default;
}

.plot {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  fill: none;
}

.grid {
  stroke: var(--border);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.diagonal {
  stroke: var(--border-strong);
  stroke-width: 1;
  stroke-dasharray: 3 3;
  vector-effect: non-scaling-stroke;
}

.line {
  stroke-width: 2;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.point {
  position: absolute;
  width: 12px;
  height: 12px;
  padding: 0;
  transform: translate(-50%, -50%);
  border: 2px solid var(--text);
  border-radius: var(--radius-full);
  background: var(--surface);
  cursor: grab;
}

.point:focus-visible {
  outline: none;
  background: var(--accent);
  box-shadow: var(--focus-ring);
}
</style>
