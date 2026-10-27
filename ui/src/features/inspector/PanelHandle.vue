<template>
  <!-- Pas de focus au clic : Espace doit rester « déplacer », pas « activer le bouton ». -->
  <UiTooltip :text="label" side="left">
    <button
      type="button"
      class="handle"
      :aria-label="label"
      :aria-expanded="open"
      @mousedown.prevent
      @click="toggle"
    >
      <ChevronRight v-if="open" :size="18" />
      <ChevronLeft v-else :size="18" />
    </button>
  </UiTooltip>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { ChevronLeft, ChevronRight } from "lucide-vue-next";

import { useInspector } from "@/features/inspector/useInspector";
import UiTooltip from "@/shared/ui/UiTooltip.vue";

const { open, toggle } = useInspector();

const label = computed(() => (open.value ? "Masquer le panneau (F)" : "Afficher le panneau (F)"));
</script>

<style scoped>
.handle {
  position: absolute;
  top: 50%;
  right: 0;
  z-index: 1;
  display: grid;
  place-items: center;
  width: 24px;
  height: 80px;
  padding: 0;
  transform: translateY(-50%);
  border: 1px solid var(--border);
  border-right: 0;
  border-radius: var(--radius-md) 0 0 var(--radius-md);
  background: color-mix(in oklch, var(--surface) 88%, transparent);
  color: var(--text-faint);
  cursor: pointer;
  backdrop-filter: blur(12px);
  transition:
    color var(--duration-fast) var(--ease),
    width var(--duration-fast) var(--ease);
}

.handle:hover {
  width: 28px;
  color: var(--text);
}

.handle:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
</style>
