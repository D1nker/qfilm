import type { RenderParams } from "@/shared/api/api";

/// Les dégradés des curseurs dont la valeur est une couleur : le curseur montre ce qu'il fait.
/// Ce sont des couleurs d'illustration (des teintes en degrés), pas des couleurs de l'interface.

const hsl = (hue: number, saturation = 75, lightness = 55) =>
  `hsl(${hue} ${saturation}% ${lightness}%)`;

const gradient = (...stops: string[]) => `linear-gradient(to right, ${stops.join(", ")})`;

const NEUTRAL_GREY = hsl(0, 0, 55);

/// Toutes les teintes, du rouge au rouge.
export const hueTrack = () => gradient(...[0, 60, 120, 180, 240, 300, 360].map((hue) => hsl(hue)));

/// Du bleu (froid) au jaune (chaud).
export const temperatureTrack = () => gradient(hsl(215, 80, 55), hsl(0, 0, 80), hsl(45, 90, 55));

/// Du vert au magenta.
export const tintTrack = () => gradient(hsl(135, 65, 45), hsl(0, 0, 80), hsl(320, 70, 55));

/// Du gris à la couleur de cette teinte : ce que fait monter la saturation.
export const saturationTrack = (hue: number) => gradient(NEUTRAL_GREY, hsl(hue, 85, 55));

/// Autour d'une teinte, sur la plage qu'un réglage de teinte peut parcourir (± `reach` degrés).
export const shiftTrack = (hue: number, reach: number) =>
  gradient(hsl(hue - reach), hsl(hue), hsl(hue + reach));

/// Du sombre au clair, par la couleur.
export const lightnessTrack = (hue: number) =>
  gradient(hsl(hue, 70, 20), hsl(hue, 80, 55), hsl(hue, 85, 90));

const GRADING_HUE: Partial<Record<keyof RenderParams, keyof RenderParams>> = {
  shadowsSaturation: "shadowsHue",
  midtonesSaturation: "midtonesHue",
  highlightsSaturation: "highlightsHue",
};

/// Le dégradé du curseur d'un réglage, s'il en a un.
export function trackFor(key: keyof RenderParams, params: RenderParams): string | undefined {
  if (key === "temperature") return temperatureTrack();
  if (key === "tint") return tintTrack();
  if (key === "shadowsHue" || key === "midtonesHue" || key === "highlightsHue") return hueTrack();

  const hueKey = GRADING_HUE[key];
  return hueKey ? saturationTrack(params[hueKey]) : undefined;
}
