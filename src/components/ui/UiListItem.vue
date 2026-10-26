<script setup lang="ts">
defineProps<{ active: boolean }>();
</script>

<template>
  <button type="button" class="item" :class="{ active }">
    <slot />
  </button>
</template>

<style scoped>
.item {
  display: block;
  width: 100%;
  padding: 7px var(--space-2);
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  font-size: var(--text-md);
  text-align: left;
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease),
    color var(--duration-fast) var(--ease);
}

.item:hover {
  background: var(--surface-hover);
  color: var(--text);
}

.item:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.item.active {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: var(--weight-medium);
}
</style>
