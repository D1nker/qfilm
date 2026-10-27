import type { RenderParams } from "@/shared/api/api";

export interface Control {
  key: keyof RenderParams;
  label: string;
  min: number;
  max: number;
  step: number;
  group: string;
}

export const controls: Control[] = [
  { group: "Lumière", key: "exposure", label: "Exposition", min: -3, max: 3, step: 0.01 },
  { group: "Lumière", key: "contrast", label: "Contraste", min: -1, max: 1, step: 0.01 },
  { group: "Lumière", key: "highlights", label: "Hautes lumières", min: -1, max: 1, step: 0.01 },
  { group: "Lumière", key: "shadows", label: "Ombres", min: -1, max: 1, step: 0.01 },
  { group: "Lumière", key: "whites", label: "Blancs", min: -1, max: 1, step: 0.01 },
  { group: "Lumière", key: "blacks", label: "Noirs", min: -1, max: 1, step: 0.01 },

  { group: "Couleur", key: "temperature", label: "Température", min: -1, max: 1, step: 0.01 },
  { group: "Couleur", key: "tint", label: "Teinte vert / magenta", min: -1, max: 1, step: 0.01 },
  { group: "Couleur", key: "saturation", label: "Saturation", min: -1, max: 1, step: 0.01 },
  { group: "Couleur", key: "vibrance", label: "Vibrance", min: -1, max: 1, step: 0.01 },

  { group: "Effets", key: "clarity", label: "Clarté", min: -1, max: 1, step: 0.01 },
  { group: "Effets", key: "lift", label: "Noirs délavés", min: 0, max: 1, step: 0.01 },
  { group: "Effets", key: "halation", label: "Halation", min: 0, max: 1, step: 0.01 },
  { group: "Effets", key: "grain", label: "Grain", min: 0, max: 1, step: 0.01 },
  { group: "Effets", key: "grainSize", label: "Taille du grain", min: 1, max: 6, step: 0.1 },
  { group: "Effets", key: "vignette", label: "Vignettage", min: 0, max: 1, step: 0.01 },
];

export function formatControlValue(key: keyof RenderParams, value: number) {
  if (key === "exposure") return `${value > 0 ? "+" : ""}${value.toFixed(2)} EV`;
  if (key === "grainSize") return value.toFixed(1);
  return value.toFixed(2);
}
