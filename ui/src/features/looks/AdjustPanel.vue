<template>
  <UiRailPanel v-model="group" :label="t('adjust.rail')" :items="railItems()" @pick="unfold">
    <template v-for="part in PARTS" :key="part.id" #[part.id]>
      <div class="part-head">
        <h3 class="part-title">{{ t(`adjust.parts.${part.id}`) }}</h3>
        <UiButton
          variant="ghost"
          size="sm"
          :disabled="!partChanged(part)"
          :aria-label="`${t('adjust.resetPart')} : ${t(`adjust.parts.${part.id}`)}`"
          @click="resetPart(part)"
        >
          {{ t("common.reset") }}
        </UiButton>
      </div>

      <template v-for="id in part.sections" :key="id">
        <UiCollapsible
          v-if="isControlGroup(id)"
          :id="`adjust-${id}`"
          :title="t(`adjust.groups.${id}`)"
          :modified="changed(keysOf(itemsOf(id)))"
        >
          <template #actions>
            <UiTooltip v-if="changed(keysOf(itemsOf(id)))" :text="t('adjust.resetGroup')">
              <UiButton
                variant="ghost"
                size="sm"
                icon
                :aria-label="`${t('adjust.resetGroup')} : ${t(`adjust.groups.${id}`)}`"
                @click="reset(keysOf(itemsOf(id)))"
              >
                <RotateCcw :size="13" />
              </UiButton>
            </UiTooltip>
          </template>

          <UiSlider
            v-for="control in itemsOf(id)"
            :key="control.key"
            :model-value="params[control.key]"
            :label="t(`adjust.controls.${control.key}`)"
            :display="formatControlValue(control.key, params[control.key])"
            :min="control.min"
            :max="control.max"
            :step="control.step"
            :reset-to="NEUTRAL[control.key]"
            :track="trackFor(control.key, params)"
            :disabled="!image"
            @update:model-value="setParam(control.key, $event)"
          />
        </UiCollapsible>

        <UiCollapsible
          v-else-if="id === 'curves'"
          id="adjust-curves"
          :title="t('adjust.groups.curves')"
          :modified="curvesChanged"
        >
          <template #actions>
            <UiTooltip v-if="curvesChanged" :text="t('adjust.resetGroup')">
              <UiButton
                variant="ghost"
                size="sm"
                icon
                :aria-label="`${t('adjust.resetGroup')} : ${t('adjust.groups.curves')}`"
                @click="resetCurves"
              >
                <RotateCcw :size="13" />
              </UiButton>
            </UiTooltip>
          </template>
          <CurvesPanel />
        </UiCollapsible>

        <UiCollapsible
          v-else-if="id === 'hsl'"
          id="adjust-hsl"
          :title="t('adjust.groups.hsl')"
          :modified="changed(HSL_KEYS)"
        >
          <template #actions>
            <UiTooltip v-if="changed(HSL_KEYS)" :text="t('adjust.resetGroup')">
              <UiButton
                variant="ghost"
                size="sm"
                icon
                :aria-label="`${t('adjust.resetGroup')} : ${t('adjust.groups.hsl')}`"
                @click="reset(HSL_KEYS)"
              >
                <RotateCcw :size="13" />
              </UiButton>
            </UiTooltip>
          </template>
          <HslMixer />
        </UiCollapsible>

        <UiCollapsible
          v-else
          id="adjust-grading"
          :title="t('adjust.groups.grading')"
          :modified="changed(GRADING_KEYS)"
        >
          <template #actions>
            <UiTooltip v-if="changed(GRADING_KEYS)" :text="t('adjust.resetGroup')">
              <UiButton
                variant="ghost"
                size="sm"
                icon
                :aria-label="`${t('adjust.resetGroup')} : ${t('adjust.groups.grading')}`"
                @click="reset(GRADING_KEYS)"
              >
                <RotateCcw :size="13" />
              </UiButton>
            </UiTooltip>
          </template>
          <GradingPanel />
        </UiCollapsible>
      </template>
    </template>
  </UiRailPanel>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Palette, RotateCcw, Sparkles, SunMedium } from "lucide-vue-next";

import { t } from "@/shared/i18n";

import { controls, formatControlValue, type ControlGroup } from "@/features/looks/controls";
import { CURVE_IDS, isFlat } from "@/features/looks/curves";
import CurvesPanel from "@/features/looks/CurvesPanel.vue";
import { gradingRanges } from "@/features/looks/grading";
import GradingPanel from "@/features/looks/GradingPanel.vue";
import HslMixer from "@/features/looks/HslMixer.vue";
import { hslRanges } from "@/features/looks/hsl";
import { NEUTRAL, type NumericParamKey } from "@/features/looks/neutral";
import { trackFor } from "@/features/looks/tracks";
import { openPanels } from "@/shared/lib/panelState";
import { useEditor } from "@/features/photo";
import { useLook } from "@/features/looks/useLook";
import UiButton from "@/shared/ui/UiButton.vue";
import UiCollapsible from "@/shared/ui/UiCollapsible.vue";
import UiRailPanel from "@/shared/ui/UiRailPanel.vue";
import UiSlider from "@/shared/ui/UiSlider.vue";
import UiTooltip from "@/shared/ui/UiTooltip.vue";

const { image } = useEditor();
const { params, setParam, setCurve } = useLook();

/// La page affichée : le panneau d'à côté (`InspectorPanel`) la tient, pour que le raccourci de recadrage, ailleurs, sache y aller.
const group = defineModel<string>("group", { required: true });

type Section = ControlGroup | "curves" | "hsl" | "grading";

/// L'ordre du panneau : des sections de réglages regroupées par intention, pour qu'on s'y repère.
const PARTS: { id: "tone" | "color" | "finish"; sections: Section[] }[] = [
  { id: "tone", sections: ["light", "curves"] },
  { id: "color", sections: ["color", "hsl", "grading"] },
  { id: "finish", sections: ["detail", "effects"] },
];

const RAIL_ICONS = { tone: SunMedium, color: Palette, finish: Sparkles };

const railItems = () =>
  PARTS.map(({ id }) => ({ id, label: t(`adjust.parts.${id}`), icon: RAIL_ICONS[id] }));

const isControlGroup = (section: Section): section is ControlGroup =>
  !["curves", "hsl", "grading"].includes(section);

const itemsOf = (group: ControlGroup) => controls.filter((control) => control.group === group);

const HSL_KEYS = hslRanges.map((range) => range.key);
const GRADING_KEYS = gradingRanges.map((range) => range.key);

const keysOf = (items: { key: NumericParamKey }[]) => items.map((item) => item.key);

const changed = (keys: NumericParamKey[]) =>
  keys.some((key) => Math.abs(params.value[key] - NEUTRAL[key]) > 1e-6);

function reset(keys: NumericParamKey[]) {
  for (const key of keys) setParam(key, NEUTRAL[key]);
}

/// L'identifiant sous lequel chaque section retient qu'elle est ouverte.
const panelId = (section: Section) => `adjust-${section}`;

/// Choisir une page déplie ses sections : elles sont peu nombreuses, on veut voir leur contenu.
function unfold(id: string) {
  const part = PARTS.find((entry) => entry.id === id);
  if (part) openPanels(part.sections.map(panelId));
}

const sectionKeys = (section: Section): NumericParamKey[] => {
  if (section === "hsl") return HSL_KEYS;
  if (section === "grading") return GRADING_KEYS;
  if (isControlGroup(section)) return keysOf(itemsOf(section));
  return [];
};

type Part = (typeof PARTS)[number];

/// Une page se réinitialise d'un bloc : ses curseurs, et ses courbes si elle en a.
const partChanged = (part: Part) =>
  part.sections.some((section) => changed(sectionKeys(section))) ||
  (part.sections.includes("curves") && curvesChanged.value);

function resetPart(part: Part) {
  for (const section of part.sections) reset(sectionKeys(section));
  if (part.sections.includes("curves")) resetCurves();
}

const curvesChanged = computed(() => CURVE_IDS.some((id) => !isFlat(params.value.curves[id])));

function resetCurves() {
  for (const id of CURVE_IDS) setCurve(id, []);
}
</script>

<style scoped>
.part-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 28px;
  margin-bottom: var(--space-2);
}

.part-title {
  margin: 0;
  color: var(--text);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
</style>
