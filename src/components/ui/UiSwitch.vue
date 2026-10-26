<template>
  <SwitchRoot class="switch" :model-value="model" @update:model-value="toggle">
    <SwitchThumb class="thumb" />
  </SwitchRoot>
</template>

<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from "reka-ui";

const emit = defineEmits<{ change: [] }>();

const model = defineModel<boolean>({ required: true });

function toggle(value: boolean) {
  model.value = value;
  emit("change");
}
</script>

<style scoped>
.switch {
  position: relative;
  width: 30px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-full);
  background: var(--surface-active);
  cursor: pointer;
  transition: background var(--duration) var(--ease);
}

.switch[data-state="checked"] {
  background: var(--accent);
}

.switch:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.thumb {
  display: block;
  width: 14px;
  height: 14px;
  border-radius: var(--radius-full);
  background: var(--surface-raised);
  box-shadow: var(--shadow-sm);
  transform: translateX(2px);
  transition: transform var(--duration) var(--ease);
}

.thumb[data-state="checked"] {
  transform: translateX(14px);
}
</style>
