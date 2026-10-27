<template>
  <header data-tauri-drag-region :class="{ overlay: isMac }">
    <UiMenu :entries="menu" :tooltip="t('menu.label')" align="start">
      <UiButton variant="ghost" class="brand" :aria-label="t('menu.label')">
        <span class="wordmark"><span>q</span>Film</span>
        <ChevronDown :size="14" class="chevron" />
      </UiButton>
    </UiMenu>

    <div class="meta">
      <strong v-if="image">{{ image.fileName }}</strong>
      <span>{{ status }}</span>
    </div>

    <div class="actions">
      <UiButton @click="browse">
        <FolderOpen :size="14" />
        {{ t("header.open") }}
      </UiButton>
      <UiButton variant="primary" :disabled="!image" @click="openExport">
        {{ t("header.export") }}
      </UiButton>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { ChevronDown, FolderOpen, Keyboard, Languages, Moon, Sun } from "lucide-vue-next";

import { useEditor } from "@/features/photo";
import { useExport } from "@/features/export";
import { useFrame } from "@/features/frames";
import { useHelp } from "@/app/useHelp";
import { useTheme, type ThemeMode } from "@/app/useTheme";
import { LOCALES, t, useLocale, type Locale } from "@/shared/i18n";
import UiButton from "@/shared/ui/UiButton.vue";
import UiMenu from "@/shared/ui/UiMenu.vue";
import type { MenuEntry } from "@/shared/ui/menu";

const isMac = navigator.userAgent.includes("Macintosh");

const { image, status, browse } = useEditor();
const { openExport } = useExport();
const { showFolder } = useFrame();
const { shortcutsOpen } = useHelp();
const { mode, set: setTheme } = useTheme();
const { locale, set: setLocale } = useLocale();

const menu = computed<MenuEntry[]>(() => [
  {
    kind: "choice",
    label: t("menu.theme"),
    value: mode.value,
    options: [
      { value: "dark", label: t("menu.dark"), icon: Moon },
      { value: "light", label: t("menu.light"), icon: Sun },
    ],
    onChange: (value) => setTheme(value as ThemeMode),
  },
  {
    kind: "choice",
    label: t("menu.language"),
    value: locale.value,
    options: LOCALES.map((option) => ({ ...option, icon: Languages })),
    onChange: (value) => setLocale(value as Locale),
  },
  { kind: "separator" },
  {
    kind: "item",
    label: t("menu.framesFolder"),
    icon: FolderOpen,
    onSelect: () => void showFolder(),
  },
  {
    kind: "item",
    label: t("menu.shortcuts"),
    icon: Keyboard,
    onSelect: () => (shortcutsOpen.value = true),
  },
]);
</script>

<style scoped>
header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 0 var(--space-4);
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

header.overlay {
  padding-left: 92px;
}

.brand {
  gap: var(--space-1);
  margin-left: calc(var(--space-2) * -1);
  padding: 0 var(--space-2);
  color: var(--text);
}

.wordmark {
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  letter-spacing: -0.01em;
}

.wordmark span {
  color: var(--accent);
}

.chevron {
  color: var(--text-faint);
}

.meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
  color: var(--text-muted);
  font-size: var(--text-xs);
  overflow: hidden;
  pointer-events: none;
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
