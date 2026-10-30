<template>
  <div>
    <div v-for="part in PARTS" v-show="page === part.id" :key="part.id">
      <UiPageHead :title="t(`adjust.parts.${part.id}`)">
        <UiButton
          variant="ghost"
          size="sm"
          :disabled="!partChanged(part)"
          :aria-label="`${t('adjust.resetPart')} : ${t(`adjust.parts.${part.id}`)}`"
          @click="resetPart(part)"
        >
          {{ t("common.reset") }}
        </UiButton>
      </UiPageHead>

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
    </div>
  </div>
</template>

<script setup lang="ts">
import { RotateCcw } from "lucide-vue-next";

import { t } from "@/shared/i18n";
import {
  GRADING_KEYS,
  HSL_KEYS,
  PARTS,
  changed,
  curvesChanged,
  isControlGroup,
  itemsOf,
  keysOf,
  partChanged,
  reset,
  resetCurves,
  resetPart,
} from "@/features/looks/adjustParts";
import { formatControlValue } from "@/features/looks/controls";
import CurvesPanel from "@/features/looks/CurvesPanel.vue";
import GradingPanel from "@/features/looks/GradingPanel.vue";
import HslMixer from "@/features/looks/HslMixer.vue";
import { NEUTRAL } from "@/features/looks/neutral";
import { trackFor } from "@/features/looks/tracks";
import { useEditor } from "@/features/photo";
import { useLook } from "@/features/looks/useLook";
import UiButton from "@/shared/ui/UiButton.vue";
import UiCollapsible from "@/shared/ui/UiCollapsible.vue";
import UiPageHead from "@/shared/ui/UiPageHead.vue";
import UiSlider from "@/shared/ui/UiSlider.vue";
import UiTooltip from "@/shared/ui/UiTooltip.vue";

/// Les réglages à la main. La page affichée est choisie sur la rampe d'icônes de l'hôte (`InspectorPanel`).
defineProps<{ page: string }>();

const { image } = useEditor();
const { params, setParam } = useLook();
</script>
