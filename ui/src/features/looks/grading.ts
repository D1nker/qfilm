import type { RenderParams } from "@/shared/api/api";

/// Les trois zones de l'étalonnage. Comme celles du mélangeur, ses réglages sont des champs
/// numériques ordinaires de `RenderParams`.
export const GRADING_ZONES = ["shadows", "midtones", "highlights"] as const;

export type GradingZone = (typeof GRADING_ZONES)[number];
export type GradingKey = `${GradingZone}Hue` | `${GradingZone}Saturation` | "gradingBalance";

export const hueKey = (zone: GradingZone) => `${zone}Hue` as const;
export const saturationKey = (zone: GradingZone) => `${zone}Saturation` as const;

export const gradingRanges: { key: keyof RenderParams; min: number; max: number; step: number }[] =
  [
    ...GRADING_ZONES.flatMap((zone) => [
      { key: hueKey(zone), min: 0, max: 360, step: 1 },
      { key: saturationKey(zone), min: 0, max: 1, step: 0.01 },
    ]),
    { key: "gradingBalance", min: -1, max: 1, step: 0.01 },
  ];
