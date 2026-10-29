import type { RenderParams } from "@/shared/api/api";

export type ControlGroup = "light" | "color" | "grading" | "detail" | "effects";

export interface Control {
  key: keyof RenderParams;
  min: number;
  max: number;
  step: number;
  group: ControlGroup;
}

export const controls: Control[] = [
  { group: "light", key: "exposure", min: -3, max: 3, step: 0.01 },
  { group: "light", key: "contrast", min: -1, max: 1, step: 0.01 },
  { group: "light", key: "highlights", min: -1, max: 1, step: 0.01 },
  { group: "light", key: "shadows", min: -1, max: 1, step: 0.01 },
  { group: "light", key: "whites", min: -1, max: 1, step: 0.01 },
  { group: "light", key: "blacks", min: -1, max: 1, step: 0.01 },

  { group: "color", key: "temperature", min: -1, max: 1, step: 0.01 },
  { group: "color", key: "tint", min: -1, max: 1, step: 0.01 },
  { group: "color", key: "saturation", min: -1, max: 1, step: 0.01 },
  { group: "color", key: "vibrance", min: -1, max: 1, step: 0.01 },

  { group: "grading", key: "shadowsHue", min: 0, max: 360, step: 1 },
  { group: "grading", key: "shadowsSaturation", min: 0, max: 1, step: 0.01 },
  { group: "grading", key: "midtonesHue", min: 0, max: 360, step: 1 },
  { group: "grading", key: "midtonesSaturation", min: 0, max: 1, step: 0.01 },
  { group: "grading", key: "highlightsHue", min: 0, max: 360, step: 1 },
  { group: "grading", key: "highlightsSaturation", min: 0, max: 1, step: 0.01 },
  { group: "grading", key: "gradingBalance", min: -1, max: 1, step: 0.01 },

  { group: "detail", key: "sharpening", min: 0, max: 1, step: 0.01 },
  { group: "detail", key: "sharpenRadius", min: 0.5, max: 3, step: 0.1 },
  { group: "detail", key: "noiseLuminance", min: 0, max: 1, step: 0.01 },
  { group: "detail", key: "noiseColor", min: 0, max: 1, step: 0.01 },

  { group: "effects", key: "clarity", min: -1, max: 1, step: 0.01 },
  { group: "effects", key: "lift", min: 0, max: 1, step: 0.01 },
  { group: "effects", key: "halation", min: 0, max: 1, step: 0.01 },
  { group: "effects", key: "grain", min: 0, max: 1, step: 0.01 },
  { group: "effects", key: "grainSize", min: 1, max: 6, step: 0.1 },
  { group: "effects", key: "grainRoughness", min: 0, max: 1, step: 0.01 },
  { group: "effects", key: "vignette", min: 0, max: 1, step: 0.01 },
  { group: "effects", key: "vignetteMidpoint", min: 0, max: 0.95, step: 0.01 },
  { group: "effects", key: "vignetteFeather", min: 0, max: 1, step: 0.01 },
];

export function formatControlValue(key: keyof RenderParams, value: number) {
  if (key === "exposure") return `${value > 0 ? "+" : ""}${value.toFixed(2)} EV`;
  if (key.endsWith("Hue")) return `${Math.round(value)}°`;
  if (key === "grainSize" || key === "sharpenRadius") return value.toFixed(1);
  return value.toFixed(2);
}
