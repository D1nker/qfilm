<script setup lang="ts">
import { Eye, Minus, Plus, Redo2, Undo2 } from "lucide-vue-next";

import { useEditor } from "@/composables/useEditor";
import { useHistory } from "@/composables/useHistory";
import UiButton from "@/components/ui/UiButton.vue";
import UiTooltip from "@/components/ui/UiTooltip.vue";

defineProps<{ zoomPercent: number; atFit: boolean }>();

const emit = defineEmits<{ zoomIn: []; zoomOut: []; toggleZoom: [] }>();

const { comparing } = useEditor();
const { canUndo, canRedo, undo, redo } = useHistory();
</script>

<template>
  <!-- Pas de focus au clic : Espace doit rester « déplacer », pas « activer le bouton ». -->
  <div class="toolbar" role="toolbar" aria-label="Outils de la photo" @mousedown.prevent>
    <UiTooltip text="Annuler (⌘Z)">
      <UiButton
        variant="ghost"
        size="sm"
        icon
        aria-label="Annuler"
        :disabled="!canUndo"
        @click="undo"
      >
        <Undo2 :size="15" />
      </UiButton>
    </UiTooltip>
    <UiTooltip text="Rétablir (⇧⌘Z)">
      <UiButton
        variant="ghost"
        size="sm"
        icon
        aria-label="Rétablir"
        :disabled="!canRedo"
        @click="redo"
      >
        <Redo2 :size="15" />
      </UiButton>
    </UiTooltip>

    <span class="separator" />

    <UiTooltip text="Maintenir pour voir l'original (C)">
      <UiButton
        variant="ghost"
        size="sm"
        @mousedown="comparing = true"
        @mouseup="comparing = false"
        @mouseleave="comparing = false"
      >
        <Eye :size="15" />
        {{ comparing ? "Original" : "Comparer" }}
      </UiButton>
    </UiTooltip>

    <span class="separator" />

    <UiTooltip text="Dézoomer (⌘ −)">
      <UiButton variant="ghost" size="sm" icon aria-label="Dézoomer" @click="emit('zoomOut')">
        <Minus :size="14" />
      </UiButton>
    </UiTooltip>
    <UiTooltip :text="atFit ? 'Afficher à 100 %' : 'Ajuster à la fenêtre (⌘ 0)'">
      <UiButton variant="ghost" size="sm" class="zoom-label" @click="emit('toggleZoom')">
        {{ zoomPercent }} %
      </UiButton>
    </UiTooltip>
    <UiTooltip text="Zoomer (⌘ +)">
      <UiButton variant="ghost" size="sm" icon aria-label="Zoomer" @click="emit('zoomIn')">
        <Plus :size="14" />
      </UiButton>
    </UiTooltip>
  </div>
</template>

<style scoped>
.toolbar {
  position: absolute;
  bottom: var(--space-4);
  left: 50%;
  display: flex;
  align-items: center;
  gap: 2px;
  transform: translateX(-50%);
  padding: var(--space-1);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: color-mix(in oklch, var(--surface) 88%, transparent);
  box-shadow: var(--shadow-md);
  backdrop-filter: blur(12px);
}

.separator {
  width: 1px;
  height: 18px;
  margin: 0 var(--space-1);
  background: var(--border-strong);
}

.zoom-label {
  min-width: 52px;
  font-variant-numeric: tabular-nums;
}
</style>
