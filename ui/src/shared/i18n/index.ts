import { ref } from "vue";
import { createI18n } from "vue-i18n";

import { en } from "@/shared/i18n/en";
import { fr, type Messages } from "@/shared/i18n/fr";

export type Locale = "fr" | "en";

export const LOCALES: { value: Locale; label: string; code: string }[] = [
  { value: "fr", label: "Français", code: "FR" },
  { value: "en", label: "English", code: "EN" },
];

const STORAGE_KEY = "qfilm-locale";

type Paths<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${Paths<T[K]>}`;
}[keyof T & string];

export type MessageKey = Paths<Messages>;

function isLocale(value: string | null): value is Locale {
  return value === "fr" || value === "en";
}

function initialLocale(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (isLocale(stored)) return stored;
  return navigator.language.toLowerCase().startsWith("fr") ? "fr" : "en";
}

export const i18n = createI18n({
  legacy: false,
  locale: initialLocale(),
  fallbackLocale: "fr",
  messages: { fr, en },
});

/// vue-i18n accepte n'importe quelle chaîne : celle-ci n'accepte que les clés du catalogue.
export function t(key: MessageKey, params: Record<string, string | number> = {}): string {
  return i18n.global.t(key, params);
}

const locale = ref<Locale>(i18n.global.locale.value);
document.documentElement.lang = locale.value;

function set(value: Locale) {
  locale.value = value;
  i18n.global.locale.value = value;
  document.documentElement.lang = value;
  localStorage.setItem(STORAGE_KEY, value);
}

export function useLocale() {
  return { locale, set };
}

/// Un texte venu des données : une chaîne pour toutes les langues, ou une chaîne par langue.
export type LocalizedText = string | Record<string, string>;

/// Le texte dans la langue courante, à défaut en anglais, en français, puis dans n'importe laquelle.
export function localized(text: LocalizedText | null | undefined): string {
  if (!text) return "";
  if (typeof text === "string") return text;
  return text[locale.value] ?? text.en ?? text.fr ?? Object.values(text)[0] ?? "";
}

/// Identifie un texte quelle que soit la langue affichée : sert à regrouper (catégories, sections).
export function textKey(text: LocalizedText): string {
  if (typeof text === "string") return text;
  return text.en ?? text.fr ?? Object.values(text)[0] ?? "";
}
