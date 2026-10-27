<template>
  <UiSlider
    v-if="def.type === 'number'"
    :model-value="number"
    :label="def.label"
    :display="`${number.toFixed(decimalsOf(def.step))}${def.unit ? ` ${def.unit}` : ''}`"
    :min="def.min"
    :max="def.max"
    :step="def.step"
    @update:model-value="emit('change', $event)"
  />

  <UiField v-else-if="def.type === 'color'" :label="def.label">
    <UiColorInput :model-value="text" @update:model-value="emit('change', $event)" />
  </UiField>

  <UiField v-else-if="def.type === 'bool'" :label="def.label">
    <UiSwitch :model-value="flag" @update:model-value="emit('change', $event)" />
  </UiField>

  <UiField v-else-if="def.type === 'text'" :label="def.label" stacked>
    <UiInput
      :model-value="text"
      :maxlength="def.maxLength"
      @update:model-value="emit('change', $event)"
    />
  </UiField>

  <template v-else-if="def.type === 'choice' && def.display === 'list'">
    <UiListItem
      v-for="option in def.options"
      :key="option.id"
      :active="option.id === text"
      @click="emit('change', option.id)"
    >
      {{ option.label }}
    </UiListItem>
  </template>

  <UiField v-else-if="def.type === 'choice'" :label="def.label">
    <UiSelect :model-value="text" :options="menu" @update:model-value="emit('change', $event)" />
  </UiField>
</template>

<script setup lang="ts">
import { computed } from "vue";

import type { ParamDef, ParamValue } from "@/shared/api/api";
import { decimalsOf } from "@/features/frames/frameParams";
import UiColorInput from "@/shared/ui/UiColorInput.vue";
import UiField from "@/shared/ui/UiField.vue";
import UiInput from "@/shared/ui/UiInput.vue";
import UiListItem from "@/shared/ui/UiListItem.vue";
import UiSelect from "@/shared/ui/UiSelect.vue";
import UiSlider from "@/shared/ui/UiSlider.vue";
import UiSwitch from "@/shared/ui/UiSwitch.vue";

const props = defineProps<{ def: ParamDef; value: ParamValue }>();
const emit = defineEmits<{ change: [value: ParamValue] }>();

const text = computed(() => String(props.value));
const number = computed(() => Number(props.value));
const flag = computed(() => props.value === true);
const menu = computed(() =>
  props.def.type === "choice"
    ? props.def.options.map((option) => ({ value: option.id, label: option.label }))
    : [],
);
</script>
