import type { FontChoice } from "@/shared/api/api";

export const FONTS: { value: FontChoice; label: string }[] = [
  { value: "condensed", label: "Condensée" },
  { value: "typewriter", label: "Machine à écrire" },
  { value: "handwritten", label: "Manuscrite" },
];

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
