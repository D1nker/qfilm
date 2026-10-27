<template>
  <RadioGroupRoot v-model="model" class="segments" :aria-label="label">
    <UiTooltip v-for="option in options" :key="option.value" :text="option.label">
      <RadioGroupItem :value="option.value" :aria-label="option.label" class="segment">
        <component :is="option.icon" v-if="option.icon" :size="14" />
        <template v-else>{{ option.text }}</template>
      </RadioGroupItem>
    </UiTooltip>
  </RadioGroupRoot>
</template>

<script setup lang="ts" generic="T extends string">
import type { Component } from "vue";
import { RadioGroupItem, RadioGroupRoot } from "reka-ui";

import UiTooltip from "@/shared/ui/UiTooltip.vue";

defineProps<{
  label: string;
  /// `label` nomme l'option pour les lecteurs d'écran et l'infobulle ; `icon` ou `text` la dessine.
  options: { value: T; label: string; icon?: Component; text?: string }[];
}>();

const model = defineModel<T>({ required: true });
</script>

<style scoped>
.segments {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
}

.segment {
  display: grid;
  place-items: center;
  min-width: 30px;
  height: 24px;
  padding: 0 6px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  cursor: pointer;
  transition: color var(--duration-fast) var(--ease);
}

.segment:hover {
  color: var(--text);
}

/* `data-state` est écrasé par celui de l'infobulle : seul `aria-checked` est fiable. */
.segment[aria-checked="true"] {
  background: var(--accent-soft);
  color: var(--accent);
}

.segment:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
</style>
