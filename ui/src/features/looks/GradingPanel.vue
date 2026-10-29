<template>
  <div class="grading">
    <ColorWheel
      :label="t('adjust.grading.wheel')"
      :pucks="pucks"
      :active="zone"
      :disabled="!image"
      @select="zone = $event as GradingZone"
      @change="onWheel"
      @reset="resetZone"
    />

    <UiSegmented v-model="zone" :label="t('adjust.grading.zone')" :options="zoneOptions" />

    <UiSlider
      :model-value="params[hueKey(zone)]"
      :label="t('adjust.grading.hue')"
      :display="formatControlValue(hueKey(zone), params[hueKey(zone)])"
      :min="0"
      :max="360"
      :step="1"
      :reset-to="0"
      :track="trackFor(hueKey(zone), params)"
      :disabled="!image"
      @update:model-value="setParam(hueKey(zone), $event)"
    />
    <UiSlider
      :model-value="params[saturationKey(zone)]"
      :label="t('adjust.grading.saturation')"
      :display="formatControlValue(saturationKey(zone), params[saturationKey(zone)])"
      :min="0"
      :max="1"
      :step="0.01"
      :reset-to="0"
      :track="trackFor(saturationKey(zone), params)"
      :disabled="!image"
      @update:model-value="setParam(saturationKey(zone), $event)"
    />
    <UiSlider
      :model-value="params.gradingBalance"
      :label="t('adjust.grading.balance')"
      :display="formatControlValue('gradingBalance', params.gradingBalance)"
      :min="-1"
      :max="1"
      :step="0.01"
      :reset-to="0"
      :disabled="!image"
      @update:model-value="setParam('gradingBalance', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import { formatControlValue } from "@/features/looks/controls";
import ColorWheel from "@/features/looks/ColorWheel.vue";
import { GRADING_ZONES, hueKey, saturationKey, type GradingZone } from "@/features/looks/grading";
import { trackFor } from "@/features/looks/tracks";
import { useLook } from "@/features/looks/useLook";
import type { HueSaturation } from "@/features/looks/wheel";
import { useEditor } from "@/features/photo";
import { t } from "@/shared/i18n";
import UiSegmented from "@/shared/ui/UiSegmented.vue";
import UiSlider from "@/shared/ui/UiSlider.vue";

const { image } = useEditor();
const { params, setParam } = useLook();

const zone = ref<GradingZone>("shadows");

const pucks = computed(() =>
  GRADING_ZONES.map((id) => ({
    id,
    label: t(`adjust.zones.${id}`),
    hue: params.value[hueKey(id)],
    saturation: params.value[saturationKey(id)],
  })),
);

const zoneOptions = computed(() =>
  GRADING_ZONES.map((id) => ({
    value: id,
    label: t(`adjust.zones.${id}`),
    text: t(`adjust.zonesShort.${id}`),
    marked: params.value[saturationKey(id)] > 0.001,
  })),
);

function onWheel(id: string, value: HueSaturation) {
  const target = id as GradingZone;
  setParam(hueKey(target), value.hue);
  setParam(saturationKey(target), value.saturation);
}

function resetZone(id: string) {
  onWheel(id, { hue: 0, saturation: 0 });
}
</script>

<style scoped>
.grading {
  display: grid;
  gap: var(--space-1);
}

.grading :deep(.segments) {
  justify-self: stretch;
  justify-content: space-between;
  margin-top: var(--space-4);
}

.grading :deep(.segment) {
  flex: 1;
  padding: 0 var(--space-1);
}
</style>
