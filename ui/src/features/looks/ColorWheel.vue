<template>
  <div
    ref="wheel"
    class="wheel"
    :class="{ disabled }"
    role="group"
    :aria-label="label"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @dblclick="emit('reset', active)"
  >
    <button
      v-for="puck in pucks"
      :key="puck.id"
      type="button"
      class="puck"
      :class="{ active: puck.id === active }"
      :data-puck="puck.id"
      :style="puckStyle(puck)"
      :disabled="disabled"
      :aria-label="puckLabel(puck)"
      @focus="emit('select', puck.id)"
      @keydown="onKeydown($event, puck)"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

import {
  moveTo,
  nudge,
  pointFor,
  type HueSaturation,
  type WheelPoint,
} from "@/features/looks/wheel";
import { t } from "@/shared/i18n";
import { beginDrag } from "@/shared/lib/useInteraction";

export interface WheelPuck extends HueSaturation {
  id: string;
  label: string;
}

const props = defineProps<{
  label: string;
  pucks: WheelPuck[];
  active: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  select: [id: string];
  change: [id: string, value: HueSaturation];
  reset: [id: string];
}>();

const wheel = ref<HTMLElement | null>(null);
let dragging: { id: string; end: () => void } | null = null;

const find = (id: string) => props.pucks.find((puck) => puck.id === id);

function pointOf(event: PointerEvent): WheelPoint {
  const box = wheel.value?.getBoundingClientRect();
  if (!box) return { x: 0, y: 0 };

  const radius = box.width / 2;
  return {
    x: (event.clientX - box.left - radius) / radius,
    y: (event.clientY - box.top - radius) / radius,
  };
}

function follow(event: PointerEvent) {
  const puck = dragging && find(dragging.id);
  if (!dragging || !puck) return;

  emit("change", puck.id, moveTo(pointOf(event), puck));
}

function onPointerDown(event: PointerEvent) {
  if (props.disabled || event.button !== 0) return;

  const target =
    event.target instanceof Element ? event.target.closest<HTMLElement>("[data-puck]") : null;
  const id = target?.dataset.puck ?? props.active;

  emit("select", id);
  wheel.value?.setPointerCapture?.(event.pointerId);
  dragging = { id, end: beginDrag() };
  // Un clic dans le vide amène la pastille active à cet endroit ; sur une pastille, on la saisit.
  if (!target) follow(event);
}

function onPointerMove(event: PointerEvent) {
  if (dragging) follow(event);
}

function onPointerUp(event: PointerEvent) {
  dragging?.end();
  dragging = null;
  wheel.value?.releasePointerCapture?.(event.pointerId);
}

function onKeydown(event: KeyboardEvent, puck: WheelPuck) {
  const next = nudge(puck, event.key, !event.shiftKey);
  if (!next) return;

  event.preventDefault();
  emit("change", puck.id, next);
}

function puckStyle(puck: WheelPuck) {
  const { x, y } = pointFor(puck);
  const tint = puck.saturation > 0.001 ? `hsl(${puck.hue} 85% 55%)` : "hsl(0 0% 60%)";
  return { left: `${(x + 1) * 50}%`, top: `${(y + 1) * 50}%`, background: tint };
}

const puckLabel = (puck: WheelPuck) =>
  t("adjust.grading.puck", {
    zone: puck.label,
    hue: Math.round(puck.hue),
    saturation: puck.saturation.toFixed(2),
  });
</script>

<style scoped>
.wheel {
  position: relative;
  width: 168px;
  height: 168px;
  margin: var(--space-4) auto var(--space-3);
  border-radius: var(--radius-full);
  background:
    radial-gradient(circle, hsl(0 0% 55%) 0%, hsl(0 0% 55% / 0) 72%),
    conic-gradient(
      hsl(0 85% 55%),
      hsl(60 85% 55%),
      hsl(120 85% 55%),
      hsl(180 85% 55%),
      hsl(240 85% 55%),
      hsl(300 85% 55%),
      hsl(360 85% 55%)
    );
  box-shadow: inset 0 0 0 1px var(--border-strong);
  cursor: crosshair;
  touch-action: none;
}

.wheel.disabled {
  opacity: 0.45;
  cursor: default;
}

.puck {
  position: absolute;
  width: 16px;
  height: 16px;
  padding: 0;
  transform: translate(-50%, -50%);
  border: 2px solid var(--surface);
  border-radius: var(--radius-full);
  box-shadow:
    0 0 0 1px var(--border-strong),
    var(--shadow-sm);
  cursor: grab;
}

.puck.active {
  z-index: 1;
  box-shadow:
    0 0 0 2px var(--text),
    var(--shadow-sm);
}

.puck:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
</style>
