<script setup lang="ts">
import { computed } from "vue";
import {
  Ellipsis,
  FolderOpen,
  Keyboard,
  Moon,
  PanelRight,
  PanelRightClose,
  Sun,
} from "lucide-vue-next";

import { useEditor } from "@/composables/useEditor";
import { useExport } from "@/composables/useExport";
import { useFrame } from "@/composables/useFrame";
import { useHelp } from "@/composables/useHelp";
import { useInspector } from "@/composables/useInspector";
import { useTheme, type ThemeMode } from "@/composables/useTheme";
import UiButton from "@/components/ui/UiButton.vue";
import UiMenu from "@/components/ui/UiMenu.vue";
import UiTooltip from "@/components/ui/UiTooltip.vue";
import type { MenuEntry } from "@/components/ui/menu";

const { image, status, browse } = useEditor();
const { openExport } = useExport();
const { showFolder } = useFrame();
const { shortcutsOpen } = useHelp();
const { open, toggle } = useInspector();
const { mode, set: setTheme } = useTheme();

const inspectorLabel = computed(() =>
  open.value ? "Masquer le panneau (F)" : "Afficher le panneau (F)",
);

const menu = computed<MenuEntry[]>(() => [
  {
    kind: "choice",
    label: "Thème",
    value: mode.value,
    options: [
      { value: "dark", label: "Sombre", icon: Moon },
      { value: "light", label: "Clair", icon: Sun },
    ],
    onChange: (value) => setTheme(value as ThemeMode),
  },
  { kind: "separator" },
  {
    kind: "item",
    label: "Ouvrir le dossier des cadres",
    icon: FolderOpen,
    onSelect: () => void showFolder(),
  },
  {
    kind: "item",
    label: "Raccourcis clavier",
    icon: Keyboard,
    onSelect: () => (shortcutsOpen.value = true),
  },
]);
</script>

<template>
  <header>
    <h1><span>Q</span>film</h1>
    <div class="meta">
      <strong v-if="image">{{ image.fileName }}</strong>
      <span>{{ status }}</span>
    </div>

    <div class="actions">
      <UiButton @click="browse">
        <FolderOpen :size="14" />
        Ouvrir…
      </UiButton>
      <UiButton variant="primary" :disabled="!image" @click="openExport">Exporter…</UiButton>

      <UiMenu :entries="menu">
        <UiButton variant="ghost" icon aria-label="Menu">
          <Ellipsis :size="16" />
        </UiButton>
      </UiMenu>

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
