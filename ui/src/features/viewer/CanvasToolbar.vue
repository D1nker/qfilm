<template>
  <!-- Pas de focus au clic : Espace doit rester « déplacer », pas « activer le bouton ». -->
  <div class="toolbar" role="toolbar" :aria-label="t('toolbar.label')" @mousedown.prevent>
    <UiTooltip :text="t('toolbar.undoTip')">
      <UiButton
        variant="ghost"
        size="sm"
        icon
        :aria-label="t('toolbar.undo')"
        :disabled="!canUndo"
        @click="undo"
      >
        <Undo2 :size="15" />
      </UiButton>
    </UiTooltip>
    <UiTooltip :text="t('toolbar.redoTip')">
      <UiButton
        variant="ghost"
        size="sm"
        icon
        :aria-label="t('toolbar.redo')"
        :disabled="!canRedo"
        @click="redo"
      >
        <Redo2 :size="15" />
      </UiButton>
    </UiTooltip>

    <span class="separator" />

    <UiTooltip :text="t('toolbar.compareTip')">
      <UiButton
        variant="ghost"
        size="sm"
        @mousedown="comparing = true"
        @mouseup="comparing = false"
        @mouseleave="comparing = false"
      >
        <Eye :size="15" />
        {{ comparing ? t("toolbar.original") : t("toolbar.compare") }}
      </UiButton>
    </UiTooltip>

    <span class="separator" />

    <UiTooltip :text="t('toolbar.zoomOutTip')">
      <UiButton
        variant="ghost"
        size="sm"
        icon
        :aria-label="t('toolbar.zoomOut')"
        @click="emit('zoomOut')"
      >
        <Minus :size="14" />
      </UiButton>
    </UiTooltip>
    <UiTooltip :text="atFit ? t('toolbar.actualSize') : t('toolbar.fit')">
      <UiButton variant="ghost" size="sm" class="zoom-label" @click="emit('toggleZoom')">
        {{ zoomPercent }} %
      </UiButton>
    </UiTooltip>
    <UiTooltip :text="t('toolbar.zoomInTip')">
      <UiButton
        variant="ghost"
        size="sm"
        icon
        :aria-label="t('toolbar.zoomIn')"
        @click="emit('zoomIn')"
      >
        <Plus :size="14" />
      </UiButton>
    </UiTooltip>
  </div>
</template>

<script setup lang="ts">
import { Eye, Minus, Plus, Redo2, Undo2 } from "lucide-vue-next";
import { t } from "@/shared/i18n";

import { useEditor } from "@/features/photo";
import { useHistory } from "@/features/history";
import UiButton from "@/shared/ui/UiButton.vue";
import UiTooltip from "@/shared/ui/UiTooltip.vue";

defineProps<{ zoomPercent: number; atFit: boolean }>();

const emit = defineEmits<{ zoomIn: []; zoomOut: []; toggleZoom: [] }>();

const { comparing } = useEditor();
const { canUndo, canRedo, undo, redo } = useHistory();
</script>

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
