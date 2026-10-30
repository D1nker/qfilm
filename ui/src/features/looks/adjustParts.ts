import { computed } from "vue";
import { Palette, Sparkles, SunMedium } from "lucide-vue-next";

import { t } from "@/shared/i18n";
import { openPanels } from "@/shared/lib/panelState";
import { controls, type ControlGroup } from "@/features/looks/controls";
import { CURVE_IDS, isFlat } from "@/features/looks/curves";
import { gradingRanges } from "@/features/looks/grading";
import { hslRanges } from "@/features/looks/hsl";
import { NEUTRAL, type NumericParamKey } from "@/features/looks/neutral";
import { useLook } from "@/features/looks/useLook";

/// Les pages de Retouche et ce qu'on peut en dire sans afficher le panneau : la rampe d'icônes, que
/// l'hôte tient, a besoin de leurs noms, de leurs points « modifié » et de quoi les déplier.

const { params, setParam, setCurve } = useLook();

export type Section = ControlGroup | "curves" | "hsl" | "grading";

/// L'ordre du panneau : des sections de réglages regroupées par intention, pour qu'on s'y repère.
export const PARTS: { id: "tone" | "color" | "finish"; sections: Section[] }[] = [
  { id: "tone", sections: ["light", "curves"] },
  { id: "color", sections: ["color", "hsl", "grading"] },
  { id: "finish", sections: ["detail", "effects"] },
];

export type Part = (typeof PARTS)[number];

const RAIL_ICONS = { tone: SunMedium, color: Palette, finish: Sparkles };

export const isControlGroup = (section: Section): section is ControlGroup =>
  !["curves", "hsl", "grading"].includes(section);

export const itemsOf = (group: ControlGroup) =>
  controls.filter((control) => control.group === group);

export const HSL_KEYS = hslRanges.map((range) => range.key);
export const GRADING_KEYS = gradingRanges.map((range) => range.key);

export const keysOf = (items: { key: NumericParamKey }[]) => items.map((item) => item.key);

export const changed = (keys: NumericParamKey[]) =>
  keys.some((key) => Math.abs(params.value[key] - NEUTRAL[key]) > 1e-6);

export function reset(keys: NumericParamKey[]) {
  for (const key of keys) setParam(key, NEUTRAL[key]);
}

export const curvesChanged = computed(() =>
  CURVE_IDS.some((id) => !isFlat(params.value.curves[id])),
);

export function resetCurves() {
  for (const id of CURVE_IDS) setCurve(id, []);
}

const sectionKeys = (section: Section): NumericParamKey[] => {
  if (section === "hsl") return HSL_KEYS;
  if (section === "grading") return GRADING_KEYS;
  if (isControlGroup(section)) return keysOf(itemsOf(section));
  return [];
};

/// Une page se réinitialise d'un bloc : ses curseurs, et ses courbes si elle en a.
export const partChanged = (part: Part) =>
  part.sections.some((section) => changed(sectionKeys(section))) ||
  (part.sections.includes("curves") && curvesChanged.value);

export function resetPart(part: Part) {
  for (const section of part.sections) reset(sectionKeys(section));
  if (part.sections.includes("curves")) resetCurves();
}

export const adjustRailItems = () =>
  PARTS.map((part) => ({
    id: part.id,
    label: t(`adjust.parts.${part.id}`),
    icon: RAIL_ICONS[part.id],
    mark: partChanged(part) ? t("common.modified") : undefined,
  }));

/// L'identifiant sous lequel chaque section retient qu'elle est ouverte.
export const panelId = (section: Section) => `adjust-${section}`;

/// Choisir une page déplie ses sections : elles sont peu nombreuses, on veut voir leur contenu.
export function unfoldAdjustPage(id: string) {
  const part = PARTS.find((entry) => entry.id === id);
  if (part) openPanels(part.sections.map(panelId));
}
