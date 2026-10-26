<script setup lang="ts">
import { computed } from "vue";
import { FolderOpen, Moon, PanelRight, PanelRightClose, Redo2, Sun, Undo2 } from "lucide-vue-next";

import { useEditor } from "@/composables/useEditor";
import { useExport } from "@/composables/useExport";
import { useHistory } from "@/composables/useHistory";
import { useInspector } from "@/composables/useInspector";
import { useTheme } from "@/composables/useTheme";
import UiButton from "@/components/ui/UiButton.vue";
import UiTooltip from "@/components/ui/UiTooltip.vue";

const { image, status, comparing, browse } = useEditor();
const { openExport } = useExport();
const { open, toggle } = useInspector();
const { canUndo, canRedo, undo, redo } = useHistory();
const { mode, toggle: toggleTheme } = useTheme();

const themeIcon = computed(() => (mode.value === "dark" ? Moon : Sun));
const themeLabel = computed(() =>
  mode.value === "dark" ? "Passer en thème clair" : "Passer en thème sombre",
);
const inspectorLabel = computed(() =>
  open.value ? "Masquer le panneau (F)" : "Afficher le panneau (F)",
);
</script>

<template>
  <header>
    <h1><span>Q</span>film</h1>
    <div class="meta">
      <strong v-if="image">{{ image.fileName }}</strong>
      <span>{{ status }}</span>
    </div>

    <div class="actions">
      <UiTooltip text="Annuler (⌘Z)">
        <UiButton variant="ghost" icon aria-label="Annuler" :disabled="!canUndo" @click="undo">
          <Undo2 :size="16" />
        </UiButton>
      </UiTooltip>
      <UiTooltip text="Rétablir (⇧⌘Z)">
        <UiButton variant="ghost" icon aria-label="Rétablir" :disabled="!canRedo" @click="redo">
          <Redo2 :size="16" />
        </UiButton>
      </UiTooltip>

      <UiTooltip :text="themeLabel">
        <UiButton variant="ghost" icon :aria-label="themeLabel" @click="toggleTheme">
          <component :is="themeIcon" :size="16" />
        </UiButton>
      </UiTooltip>

      <UiTooltip v-if="image" text="Maintenir pour voir l'original (C)">
        <UiButton
          variant="ghost"
          @mousedown="comparing = true"
          @mouseup="comparing = false"
          @mouseleave="comparing = false"
        >
          {{ comparing ? "Original" : "Comparer" }}
        </UiButton>
      </UiTooltip>

      <UiButton @click="browse">
        <FolderOpen :size="14" />
        Ouvrir…
      </UiButton>
      <UiButton variant="primary" :disabled="!image" @click="openExport">Exporter…</UiButton>

      <UiTooltip :text="inspectorLabel">
        <UiButton
          variant="ghost"
          icon
          :aria-expanded="open"
          :aria-label="inspectorLabel"
          @click="toggle"
        >
          <PanelRightClose v-if="open" :size="16" />
          <PanelRight v-else :size="16" />
        </UiButton>
      </UiTooltip>
    </div>
  </header>
</template>

<style scoped>
header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 0 var(--space-4);
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

h1 {
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  letter-spacing: -0.01em;
}

h1 span {
  color: var(--accent);
}

.meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
  color: var(--text-muted);
  font-size: var(--text-xs);
  overflow: hidden;
}

.meta strong {
  color: var(--text);
  font-weight: var(--weight-medium);
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

.actions {
  display: flex;
  gap: var(--space-2);
  margin-left: auto;
}
</style>
