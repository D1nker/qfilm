import { Camera, Circle, Contrast, Film, Layers, ScanLine } from "lucide-vue-next";
import type { Component } from "vue";

/// L'icône de la rampe pour chaque catégorie de looks, d'après sa clé (`textKey`, le nom anglais).
/// Une catégorie qu'on n'a pas prévue prend l'icône des calques : la liste vient des données.
const ICONS: Record<string, Component> = {
  Base: Circle,
  "Color negative": Film,
  "Black & white": Contrast,
  Instant: Camera,
  Scanner: ScanLine,
};

export const categoryIcon = (key: string): Component => ICONS[key] ?? Layers;
