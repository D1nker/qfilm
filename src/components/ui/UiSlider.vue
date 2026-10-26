<template>
  <div class="slider" :class="{ disabled }">
    <div class="row">
      <span>{{ label }}</span>
      <span class="value">{{ display }}</span>
    </div>

    <SliderRoot
      class="root"
      :model-value="[model]"
      :min="min"
      :max="max"
      :step="step"
      :disabled="disabled"
      @update:model-value="onSlide"
      @value-commit="emit('change')"
      @dblclick="reset"
    >
      <SliderTrack class="track">
        <span class="fill" :style="fillStyle" />
      </SliderTrack>
      <SliderThumb class="thumb" :aria-label="label" />
    </SliderRoot>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { SliderRoot, SliderThumb, SliderTrack } from "reka-ui";

const props = withDefaults(
  defineProps<{
    label: string;
    display: string;
    min: number;
    max: number;
    step: number;
    disabled?: boolean;
  }>(),
  { disabled: false },
);

const emit = defineEmits<{
  /** À chaque mouvement du curseur. */
  input: [];
  /** Quand le geste est terminé (relâché, touche clavier, remise à zéro). */
  change: [];
}>();

const model = defineModel<number>({ required: true });

const origin = computed(() => (props.min < 0 ? 0 : props.min));

const percent = (value: number) => ((value - props.min) / (props.max - props.min)) * 100;

const fillStyle = computed(() => {
  const from = percent(origin.value);
  const to = percent(model.value);
  return { left: `${Math.min(from, to)}%`, width: `${Math.abs(to - from)}%` };
});

function onSlide(values: number[] | undefined) {
  const [value] = values ?? [];
  if (value === undefined) return;

  model.value = value;
  emit("input");
}

function reset() {
  if (props.disabled) return;

  model.value = origin.value;
  emit("input");
  emit("change");
}
</script>

<style scoped>
.slider {
  margin-top: var(--space-4);
  font-size: var(--text-sm);
}

.slider.disabled {
  opacity: 0.45;
}

.row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
}

.value {
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.root {
  position: relative;
  display: flex;
  align-items: center;
  height: 18px;
  cursor: pointer;
  touch-action: none;
}

.track {
  position: relative;
  flex: 1;
  height: 3px;
  border-radius: var(--radius-full);
  background: var(--surface-active);
}

.fill {
  position: absolute;
  top: 0;
  bottom: 0;
  border-radius: var(--radius-full);
  background: var(--accent);
}

.thumb {
  display: block;
  width: 14px;
  height: 14px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-full);
  background: var(--surface-raised);
  box-shadow: var(--shadow-sm);
  transition: transform var(--duration-fast) var(--ease);
}

.root:hover .thumb {
  transform: scale(1.12);
}

.thumb:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
</style>
