<template>
  <div class="preferences">
    <UiPopover :tooltip="t('preferences.label')">
      <template #trigger>
        <UiButton variant="ghost" size="sm" icon :aria-label="t('preferences.label')">
          <SlidersHorizontal :size="15" />
        </UiButton>
      </template>

      <div class="row">
        <span class="label">{{ t("preferences.theme") }}</span>
        <UiSegmented v-model="theme" :label="t('preferences.theme')" :options="themeOptions" />
      </div>
      <div class="row">
        <span class="label">{{ t("preferences.language") }}</span>
        <UiSegmented
          v-model="language"
          :label="t('preferences.language')"
          :options="languageOptions"
        />
      </div>
    </UiPopover>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Moon, SlidersHorizontal, Sun } from "lucide-vue-next";

import { useTheme, type ThemeMode } from "@/app/useTheme";
import { LOCALES, t, useLocale, type Locale } from "@/shared/i18n";
import UiButton from "@/shared/ui/UiButton.vue";
import UiPopover from "@/shared/ui/UiPopover.vue";
import UiSegmented from "@/shared/ui/UiSegmented.vue";

const { mode, set: setTheme } = useTheme();
const { locale, set: setLocale } = useLocale();

const theme = computed<ThemeMode>({ get: () => mode.value, set: setTheme });
const language = computed<Locale>({ get: () => locale.value, set: setLocale });

const themeOptions = computed(() => [
  { value: "dark" as const, label: t("preferences.dark"), icon: Moon },
  { value: "light" as const, label: t("preferences.light"), icon: Sun },
]);

const languageOptions = LOCALES.map(({ value, label, code }) => ({ value, label, text: code }));
</script>

<style scoped>
.preferences {
  padding: var(--space-1);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: color-mix(in oklch, var(--surface) 88%, transparent);
  box-shadow: var(--shadow-md);
  backdrop-filter: blur(12px);
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-5);
}

.row + .row {
  margin-top: var(--space-3);
}

.label {
  color: var(--text-muted);
  font-size: var(--text-sm);
}
</style>
