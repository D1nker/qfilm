import { ref, watchEffect } from "vue";

export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "qfilm-theme";

function readStored(): ThemeMode {
  return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
}

const mode = ref<ThemeMode>(readStored());

watchEffect(() => {
  document.documentElement.dataset.theme = mode.value;
  localStorage.setItem(STORAGE_KEY, mode.value);
});

function toggle() {
  mode.value = mode.value === "dark" ? "light" : "dark";
}

export function useTheme() {
  return { mode, toggle };
}
