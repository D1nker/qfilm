<script setup lang="ts">
const model = defineModel<string>({ required: true });
</script>

<template>
  <input v-model="model" type="text" class="input" />
</template>

<style scoped>
.input {
  min-width: 0;
  height: 30px;
  padding: 0 var(--space-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-size: var(--text-sm);
  transition: border-color var(--duration-fast) var(--ease);
}

.input::placeholder {
  color: var(--text-faint);
}

.input:hover {
  border-color: var(--border-strong);
}

.input:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: var(--focus-ring);
}
</style>
