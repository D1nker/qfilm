<template>
  <component :is="as" class="field" :class="{ stacked }">
    <span class="label">{{ label }}</span>
    <slot />
  </component>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ label: string; stacked?: boolean; as?: "label" | "div" }>(), {
  stacked: false,
  as: "label",
});
</script>

<style scoped>
.field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-top: var(--space-4);
  font-size: var(--text-sm);
}

.field.stacked {
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
}
</style>
