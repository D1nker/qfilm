import { computed, reactive, ref } from "vue";

import type { Preset, RenderParams } from "@/shared/api/api";
import { controls } from "@/features/looks/controls";
import { gradingRanges } from "@/features/looks/grading";
import { hslRanges } from "@/features/looks/hsl";
import { NEUTRAL } from "@/features/looks/neutral";

type ParamKey = keyof RenderParams;

const KEYS = Object.keys(NEUTRAL) as ParamKey[];
const RANGES = new Map(
  [...controls, ...hslRanges, ...gradingRanges].map((control) => [control.key, control]),
);

function zeroed(): RenderParams {
  const out = { ...NEUTRAL };
  for (const key of KEYS) out[key] = 0;
  return out;
}

/// Le rendu est la somme de trois couches, pour que l'intensité du preset et les
/// retouches à la main restent indépendantes :
///   effectif = neutre + (preset − neutre) × intensité + retouches
const activePreset = ref("neutral");
const amount = ref(1);
const presetParams = ref<RenderParams>({ ...NEUTRAL });
const adjustments = reactive<RenderParams>(zeroed());

const base = computed(() => {
  const out = { ...NEUTRAL };
  for (const key of KEYS) {
    out[key] = NEUTRAL[key] + (presetParams.value[key] - NEUTRAL[key]) * amount.value;
  }
  return out;
});

const params = computed(() => {
  const out = { ...base.value };
  for (const key of KEYS) {
    const range = RANGES.get(key);
    const value = base.value[key] + adjustments[key];
    out[key] = range ? Math.min(Math.max(value, range.min), range.max) : value;
  }
  return out;
});

function applyPreset(preset: Preset) {
  activePreset.value = preset.id;
  presetParams.value = { ...preset.params };
  amount.value = 1;
  Object.assign(adjustments, zeroed());
}

function setParam(key: ParamKey, value: number) {
  adjustments[key] = value - base.value[key];
}

function resetLook() {
  activePreset.value = "neutral";
  presetParams.value = { ...NEUTRAL };
  amount.value = 1;
  Object.assign(adjustments, zeroed());
}

export interface LookSnapshot {
  activePreset: string;
  amount: number;
  presetParams: RenderParams;
  adjustments: RenderParams;
}

function snapshot(): LookSnapshot {
  return {
    activePreset: activePreset.value,
    amount: amount.value,
    presetParams: { ...presetParams.value },
    adjustments: { ...adjustments },
  };
}

function restore(state: LookSnapshot) {
  activePreset.value = state.activePreset;
  amount.value = state.amount;
  presetParams.value = { ...state.presetParams };
  Object.assign(adjustments, state.adjustments);
}

export function useLook() {
  return { activePreset, amount, params, applyPreset, setParam, resetLook, snapshot, restore };
}
