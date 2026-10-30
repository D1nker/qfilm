import { computed, reactive, ref } from "vue";

import type { Preset, RenderParams } from "@/shared/api/api";
import { controls } from "@/features/looks/controls";
import {
  CURVE_IDS,
  isFlat,
  scaleCurve,
  type CurveId,
  type CurvePoint,
} from "@/features/looks/curves";
import { gradingRanges } from "@/features/looks/grading";
import { hslRanges } from "@/features/looks/hsl";
import { NEUTRAL, type NumericParamKey } from "@/features/looks/neutral";

type Adjustments = Record<NumericParamKey, number>;
type CurveEdits = Partial<Record<CurveId, CurvePoint[]>>;

const KEYS = Object.keys(NEUTRAL).filter((key) => key !== "curves") as NumericParamKey[];

const NUMERIC_NEUTRAL = Object.fromEntries(KEYS.map((key) => [key, NEUTRAL[key]])) as Adjustments;
const RANGES = new Map(
  [...controls, ...hslRanges, ...gradingRanges].map((control) => [control.key, control]),
);

function zeroed(): Adjustments {
  return Object.fromEntries(KEYS.map((key) => [key, 0])) as Adjustments;
}

const copyCurve = (points: CurvePoint[]): CurvePoint[] => points.map(([x, y]) => [x, y]);

/// Le rendu est la somme de trois couches, pour que l'intensité du preset et les
/// retouches à la main restent indépendantes :
///   effectif = neutre + (preset − neutre) × intensité + retouches
/// Une courbe n'est pas un nombre : l'intensité ramène celle du preset vers la diagonale, mais dès
/// qu'on retouche une courbe, la liste de points modifiée la remplace (`curveEdits`, vide = diagonale).
const activePreset = ref("neutral");
const amount = ref(1);
const presetParams = ref<RenderParams>({ ...NEUTRAL });
const adjustments = reactive<Adjustments>(zeroed());
const curveEdits = ref<CurveEdits>({});

const base = computed(() => {
  const out = { ...NUMERIC_NEUTRAL };
  for (const key of KEYS) {
    out[key] = NEUTRAL[key] + (presetParams.value[key] - NEUTRAL[key]) * amount.value;
  }
  return out;
});

const curves = computed(
  () =>
    Object.fromEntries(
      CURVE_IDS.map((id) => [
        id,
        curveEdits.value[id] ?? scaleCurve(presetParams.value.curves[id], amount.value),
      ]),
    ) as RenderParams["curves"],
);

const params = computed<RenderParams>(() => {
  const out = { ...base.value };
  for (const key of KEYS) {
    const range = RANGES.get(key);
    const value = base.value[key] + adjustments[key];
    out[key] = range ? Math.min(Math.max(value, range.min), range.max) : value;
  }
  return { ...out, curves: curves.value };
});

/// Le preset survolé, tel qu'un clic l'appliquerait (intensité pleine, sans retouche). Ce n'est pas
/// de l'état d'édition : ni l'historique ni les curseurs ne le voient, seul le rendu s'en sert.
const previewed = ref<RenderParams | null>(null);

/// Ce que l'aperçu affiche : le look survolé, à défaut le look en cours.
const shown = computed<RenderParams>(() => previewed.value ?? params.value);

function previewPreset(preset: Preset | null) {
  previewed.value = preset ? { ...preset.params } : null;
}

/// Rien n'est appliqué : ni preset, ni retouche, ni courbe. Le réglage « Réinitialiser » n'a alors rien à faire.
const isPristine = computed(
  () =>
    activePreset.value === "neutral" &&
    KEYS.every((key) => Math.abs(params.value[key] - NEUTRAL[key]) < 1e-6) &&
    CURVE_IDS.every((id) => isFlat(params.value.curves[id])),
);

function applyPreset(preset: Preset) {
  activePreset.value = preset.id;
  presetParams.value = { ...preset.params };
  amount.value = 1;
  Object.assign(adjustments, zeroed());
  curveEdits.value = {};
}

function setParam(key: NumericParamKey, value: number) {
  adjustments[key] = value - base.value[key];
}

/// Une liste vide remet la courbe à la diagonale.
function setCurve(id: CurveId, points: CurvePoint[]) {
  curveEdits.value = { ...curveEdits.value, [id]: copyCurve(points) };
}

function resetLook() {
  activePreset.value = "neutral";
  presetParams.value = { ...NEUTRAL };
  amount.value = 1;
  Object.assign(adjustments, zeroed());
  curveEdits.value = {};
}

export interface LookSnapshot {
  activePreset: string;
  amount: number;
  presetParams: RenderParams;
  adjustments: Adjustments;
  curveEdits: CurveEdits;
}

const copyEdits = (edits: CurveEdits): CurveEdits => {
  const out: CurveEdits = {};
  for (const id of CURVE_IDS) {
    const points = edits[id];
    if (points) out[id] = copyCurve(points);
  }
  return out;
};

function snapshot(): LookSnapshot {
  return {
    activePreset: activePreset.value,
    amount: amount.value,
    presetParams: { ...presetParams.value },
    adjustments: { ...adjustments },
    curveEdits: copyEdits(curveEdits.value),
  };
}

function restore(state: LookSnapshot) {
  activePreset.value = state.activePreset;
  amount.value = state.amount;
  presetParams.value = { ...state.presetParams };
  Object.assign(adjustments, state.adjustments);
  curveEdits.value = copyEdits(state.curveEdits);
}

export function useLook() {
  return {
    activePreset,
    amount,
    params,
    shown,
    previewPreset,
    isPristine,
    applyPreset,
    setParam,
    setCurve,
    resetLook,
    snapshot,
    restore,
  };
}
