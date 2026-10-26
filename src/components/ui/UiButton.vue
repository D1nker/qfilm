<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: "primary" | "secondary" | "ghost";
    size?: "sm" | "md";
    icon?: boolean;
  }>(),
  { variant: "secondary", size: "md", icon: false },
);
</script>

<template>
  <button
    type="button"
    class="btn"
    :class="[`btn--${variant}`, `btn--${size}`, { 'btn--icon': icon }]"
  >
    <slot />
  </button>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  white-space: nowrap;
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease),
    border-color var(--duration-fast) var(--ease),
    color var(--duration-fast) var(--ease);
}

.btn:hover:not(:disabled) {
  background: var(--surface-hover);
}

.btn:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.btn--md {
  height: 30px;
  padding: 0 var(--space-3);
}

.btn--sm {
  height: 26px;
  padding: 0 var(--space-2);
}

.btn--icon.btn--md {
  width: 30px;
  padding: 0;
}

.btn--icon.btn--sm {
  width: 26px;
  padding: 0;
}

.btn--ghost {
  border-color: transparent;
  background: transparent;
  color: var(--text-muted);
}

.btn--ghost:hover:not(:disabled) {
  background: var(--surface-hover);
  color: var(--text);
}

.btn--primary {
  border-color: transparent;
  background: var(--accent);
  color: var(--accent-contrast);
}

.btn--primary:hover:not(:disabled) {
  background: var(--accent-hover);
}
</style>
