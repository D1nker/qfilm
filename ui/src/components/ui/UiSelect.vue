<template>
  <SelectRoot v-model="model">
    <SelectTrigger class="trigger">
      <SelectValue :placeholder="placeholder" />
      <ChevronDown :size="14" class="chevron" />
    </SelectTrigger>

    <SelectPortal>
      <SelectContent class="ui-select-content" position="popper" :side-offset="4">
        <SelectViewport class="ui-select-viewport">
          <SelectItem
            v-for="option in options"
            :key="option.value"
            class="ui-select-item"
            :value="option.value"
          >
            <SelectItemText>{{ option.label }}</SelectItemText>
            <SelectItemIndicator>
              <Check :size="14" />
            </SelectItemIndicator>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>

<script setup lang="ts" generic="T extends string">
import {
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport,
} from "reka-ui";
import { Check, ChevronDown } from "lucide-vue-next";

defineProps<{ options: { value: T; label: string }[]; placeholder?: string }>();

const model = defineModel<T>({ required: true });
</script>

<style scoped>
.trigger {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  min-width: 130px;
  height: 30px;
  padding: 0 var(--space-2) 0 var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease);
}

.trigger:hover {
  background: var(--surface-hover);
}

.trigger:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.chevron {
  color: var(--text-muted);
}
</style>

<!-- Le popup est téléporté dans <body> : les styles scoped ne l'atteignent pas. -->
<style>
.ui-select-content {
  z-index: 100;
  min-width: var(--reka-select-trigger-width);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-raised);
  box-shadow: var(--shadow-md);
  overflow: hidden;
}

.ui-select-viewport {
  padding: var(--space-1);
}

.ui-select-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: 6px var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  cursor: pointer;
  outline: none;
}

.ui-select-item[data-highlighted] {
  background: var(--surface-hover);
}

.ui-select-item[data-state="checked"] {
  color: var(--accent);
}
</style>
