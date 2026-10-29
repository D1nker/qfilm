<template>
  <div class="slider" :class="{ disabled }">
    <div class="row">
      <span>{{ label }}</span>
      <input
        v-if="editing"
        ref="field"
        v-model="typed"
        class="value editor"
        inputmode="decimal"
        :aria-label="t('slider.value', { label })"
        @keydown.enter.prevent="commitEdit"
        @keydown.esc.prevent="cancelEdit"
        @blur="commitEdit"
      />
      <button
        v-else
        type="button"
        class="value"
        tabindex="-1"
        :disabled="disabled"
        :title="t('slider.edit')"
        @click="startEdit"
      >
        {{ display }}
      </button>
    </div>

    <SliderRoot
      class="root"
      :model-value="[model]"
      :min="min"
      :max="max"
      :step="step"
      :disabled="disabled"
      @update:model-value="onSlide"
      @pointerdown="startDrag"
      @value-commit="finish"
      @dblclick="reset"
    >
      <SliderTrack
        class="track"
        :class="{ colored: track }"
        :style="track ? { background: track } : undefined"
      >
        <span class="fill" :style="fillStyle" />
        <span v-if="bipolar && !track" class="zero" :style="{ left: `${percent(0)}%` }" />
      </SliderTrack>
      <SliderThumb class="thumb" :aria-label="label" @keydown.enter.prevent="startEdit" />
    </SliderRoot>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { SliderRoot, SliderThumb, SliderTrack } from "reka-ui";

import { t } from "@/shared/i18n";
import { fromEditText, toEditText } from "@/shared/lib/sliderValue";
import { beginDrag } from "@/shared/lib/useInteraction";

const props = withDefaults(
  defineProps<{
    label: string;
    display: string;
    min: number;
    max: number;
    step: number;
    /** Un dégradé CSS qui remplace la piste : pour un réglage dont la valeur est une couleur. */
    track?: string;
    /** Valeur retrouvée par un double-clic ; à défaut 0, ou le minimum si 0 est hors plage. */
    resetTo?: number;
    /** Pour passer de l'unité stockée à celle qu'on affiche et qu'on saisit (0,5 → 50 : 100). */
    editScale?: number;
    disabled?: boolean;
  }>(),
  { track: undefined, resetTo: undefined, editScale: 1, disabled: false },
);

const emit = defineEmits<{
  /** À chaque mouvement du curseur. */
  input: [];
  /** Quand le geste est terminé (relâché, touche clavier, remise à zéro). */
  change: [];
}>();

const model = defineModel<number>({ required: true });

const origin = computed(() => (props.min < 0 ? 0 : props.min));

/// Un curseur qui va de part et d'autre de zéro : une marque dit où est le zéro, et le remplissage part de là.
const bipolar = computed(() => props.min < 0 && props.max > 0);

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

// Seuls les gestes à la souris passent en brouillon : un pas au clavier ne change qu'une valeur.
let endDrag: (() => void) | null = null;

function startDrag() {
  if (props.disabled || endDrag) return;

  endDrag = beginDrag();
  const stop = () => finish();
  window.addEventListener("pointerup", stop, { once: true });
  window.addEventListener("pointercancel", stop, { once: true });
}

function finish() {
  endDrag?.();
  endDrag = null;
  emit("change");
}

const editing = ref(false);
const typed = ref("");
const field = ref<HTMLInputElement | null>(null);

async function startEdit() {
  if (editing.value) return;

  typed.value = toEditText(model.value, props.step, props.editScale);
  editing.value = true;
  await nextTick();
  field.value?.focus();
  field.value?.select();
}

function commitEdit() {
  if (!editing.value) return;

  editing.value = false;
  const value = fromEditText(typed.value, props.min, props.max, props.editScale);
  if (value === null || value === model.value) return;

  model.value = value;
  emit("input");
  emit("change");
}

function cancelEdit() {
  editing.value = false;
}

function reset() {
  if (props.disabled) return;

  model.value = props.resetTo ?? origin.value;
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
  padding: 0 2px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

button.value {
  cursor: text;
}

button.value:hover:not(:disabled) {
  background: var(--surface-hover);
  color: var(--text);
}

.editor {
  width: 72px;
  margin: -2px 0;
  padding: 1px 4px;
  border: 1px solid var(--accent);
  background: var(--surface);
  color: var(--text);
}

.editor:focus-visible {
  outline: none;
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

.track.colored {
  height: 5px;
}

.track.colored .fill {
  display: none;
}

.zero {
  position: absolute;
  top: -3px;
  bottom: -3px;
  width: 1px;
  transform: translateX(-0.5px);
  background: var(--text-muted);
  pointer-events: none;
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

/* En dernier : à spécificité égale la dernière règle gagne, requête de conteneur ou non. À l'aise, un
   curseur tient sur une ligne (le nom, la piste, la valeur) ; plus étroit, sur deux. */
@container rail-body (min-width: 340px) {
  .slider {
    display: grid;
    grid-template-columns: minmax(6rem, 32%) minmax(0, 1fr) 3.75rem;
    column-gap: var(--space-3);
    align-items: center;
    margin-top: var(--space-3);
  }

  .row {
    display: contents;
  }

  .row > span {
    grid-column: 1;
    grid-row: 1;
    line-height: 1.25;
  }

  .root {
    grid-column: 2;
    grid-row: 1;
  }

  .value {
    grid-column: 3;
    grid-row: 1;
    justify-self: end;
  }

  .editor {
    width: 100%;
  }
}
</style>
