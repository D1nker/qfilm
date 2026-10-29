import type { NumericParamKey } from "@/features/looks/neutral";

/// Les huit teintes du mélangeur, avec leur teinte en degrés (qui sert à dessiner la pastille).
export const HSL_BANDS = [
  { id: "red", hue: 0 },
  { id: "orange", hue: 30 },
  { id: "yellow", hue: 60 },
  { id: "green", hue: 120 },
  { id: "aqua", hue: 180 },
  { id: "blue", hue: 240 },
  { id: "purple", hue: 270 },
  { id: "magenta", hue: 300 },
] as const;

export const HSL_CHANNELS = ["hue", "saturation", "luminance"] as const;

export type HslBand = (typeof HSL_BANDS)[number]["id"];
export type HslChannel = (typeof HSL_CHANNELS)[number];
export type HslKey = `${HslBand}${Capitalize<HslChannel>}`;

export function hslKey(band: HslBand, channel: HslChannel): HslKey {
  return `${band}${channel.charAt(0).toUpperCase()}${channel.slice(1)}` as HslKey;
}

/// Un décalage de teinte à 1 déplace la couleur de ce nombre de degrés (même valeur côté Rust).
export const HSL_HUE_REACH = 30;

export function isHslHueKey(key: string): boolean {
  return HSL_BANDS.some((band) => hslKey(band.id, "hue") === key);
}

const RANGE = { min: -1, max: 1, step: 0.01 };

/// Les 24 réglages du mélangeur sont des champs numériques ordinaires de `RenderParams` : couches,
/// historique, remise à zéro et presets les gèrent sans cas particulier.
export const hslRanges: { key: NumericParamKey; min: number; max: number }[] = HSL_BANDS.flatMap(
  (band) => HSL_CHANNELS.map((channel) => ({ key: hslKey(band.id, channel), ...RANGE })),
);
