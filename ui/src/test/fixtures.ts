import type { ChoiceOption, FrameInfo, ParamDef } from "@/shared/api/api";

const STOCKS: ChoiceOption[] = [
  {
    id: "amber",
    label: "Ambre",
    sets: { color: "#120f0c", ink: "#f0a63c", text: "PORTRAIT 400" },
  },
  {
    id: "green",
    label: "Vert",
    sets: { color: "#0d1210", ink: "#6fce8a", text: "VERT VIF 400" },
  },
  { id: "plain", label: "Sans marquages", sets: { color: "#0a0a0a", text: "" } },
];

const printed = { param: "stock", notEquals: "plain" };

function filmParams(width: number): ParamDef[] {
  return [
    {
      id: "stock",
      label: "Pellicule",
      type: "choice",
      display: "list",
      section: "Pellicule",
      default: "amber",
      options: STOCKS,
      persist: true,
    },
    {
      id: "width",
      label: "Épaisseur",
      type: "number",
      min: 1,
      max: 30,
      step: 0.5,
      unit: "%",
      default: width,
    },
    { id: "color", label: "Support", type: "color", default: "#120f0c" },
    { id: "sprockets", label: "Perforations", type: "bool", default: false, hidden: true },
    { id: "ink", label: "Marquages", type: "color", default: "#f0a63c", visibleIf: printed },
    {
      id: "text",
      label: "Texte pellicule",
      type: "text",
      default: "PORTRAIT 400",
      maxLength: 60,
      visibleIf: printed,
      fromLook: true,
    },
    {
      id: "frameNumber",
      label: "Numéro de vue",
      type: "text",
      default: "24A",
      maxLength: 12,
      visibleIf: printed,
      persist: true,
    },
  ];
}

function frame(id: string, name: string, params: ParamDef[], captionDefaults = {}): FrameInfo {
  return {
    id,
    name,
    description: "",
    author: "",
    rotatePortrait: false,
    captionDefaults,
    params,
    builtin: true,
  };
}

export const noFrame = frame("none", "Aucun", []);
export const film35 = frame("film35", "35 mm", filmParams(14));
export const film120 = frame("film120", "Moyen format", filmParams(10));
export const solid = frame(
  "solid",
  "Marge unie",
  [
    {
      id: "width",
      label: "Épaisseur",
      type: "number",
      min: 1,
      max: 30,
      step: 0.5,
      unit: "%",
      default: 4,
    },
    { id: "color", label: "Couleur", type: "color", default: "#ffffff" },
  ],
  { color: "#1a1a1a" },
);

export const catalog = {
  frames: [noFrame, film35, film120, solid],
  issues: [],
  directory: "/frames",
};

export const NEUTRAL_PARAMS = {
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  saturation: 0,
  vibrance: 0,
  temperature: 0,
  tint: 0,
  redHue: 0,
  redSaturation: 0,
  redLuminance: 0,
  orangeHue: 0,
  orangeSaturation: 0,
  orangeLuminance: 0,
  yellowHue: 0,
  yellowSaturation: 0,
  yellowLuminance: 0,
  greenHue: 0,
  greenSaturation: 0,
  greenLuminance: 0,
  aquaHue: 0,
  aquaSaturation: 0,
  aquaLuminance: 0,
  blueHue: 0,
  blueSaturation: 0,
  blueLuminance: 0,
  purpleHue: 0,
  purpleSaturation: 0,
  purpleLuminance: 0,
  magentaHue: 0,
  magentaSaturation: 0,
  magentaLuminance: 0,
  clarity: 0,
  sharpening: 0,
  sharpenRadius: 1,
  noiseLuminance: 0,
  noiseColor: 0,
  lift: 0,
  shadowsHue: 0,
  shadowsSaturation: 0,
  midtonesHue: 0,
  midtonesSaturation: 0,
  highlightsHue: 0,
  highlightsSaturation: 0,
  gradingBalance: 0,
  halation: 0,
  grain: 0,
  grainSize: 2,
  grainRoughness: 1,
  vignette: 0,
  vignetteMidpoint: 0,
  vignetteFeather: 0.5,
};
