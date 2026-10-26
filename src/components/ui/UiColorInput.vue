<script setup lang="ts">
const model = defineModel<string>({ required: true });
</script>

<template>
  <input v-model="model" type="color" class="swatch" />
</template>

<style scoped>
.swatch {
  appearance: none;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-full);
  background: none;
  cursor: pointer;
}

.swatch::-webkit-color-swatch-wrapper {
  padding: 0;
}

.swatch::-webkit-color-swatch {
  border: 0;
  border-radius: var(--radius-full);
}

.swatch:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
</style>
