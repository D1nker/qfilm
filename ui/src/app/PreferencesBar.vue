<template>
  <div class="preferences" role="group" :aria-label="t('preferences.label')">
    <UiSegmented v-model="theme" :label="t('preferences.theme')" :options="themeOptions" />
    <span class="separator" />
    <UiSegmented v-model="language" :label="t('preferences.language')" :options="languageOptions" />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Moon, Sun } from "lucide-vue-next";

import { useTheme, type ThemeMode } from "@/app/useTheme";
import { LOCALES, t, useLocale, type Locale } from "@/shared/i18n";
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
  display: flex;
  align-items: center;
  gap: var(--space-1);
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
  background: var(--border-strong);
}
</style>
