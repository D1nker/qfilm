import type { FontChoice } from "@/shared/api/api";
import { t } from "@/shared/i18n";

export const fontOptions = (): { value: FontChoice; label: string }[] =>
  (["condensed", "typewriter", "handwritten"] as const).map((value) => ({
    value,
    label: t(`caption.fonts.${value}`),
  }));

export const FONT_FAMILIES: Record<FontChoice, string> = {
  condensed: "qfilm-condensed",
  typewriter: "qfilm-typewriter",
  handwritten: "qfilm-handwritten",
};

// Relevées sur les fichiers de police, où ascendante + descendante font 1 cadratin.
export const FONT_ASCENT: Record<FontChoice, number> = {
  condensed: 0.7917,
  typewriter: 0.6957,
  handwritten: 0.7619,
};
