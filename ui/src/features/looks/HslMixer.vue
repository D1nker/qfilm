<template>
  <div class="mixer">
    <UiSegmented v-model="band" :label="t('adjust.hsl.band')" :options="bandOptions" />

    <UiSlider
      v-for="channel in HSL_CHANNELS"
      :key="`${band}-${channel}`"
      :model-value="params[hslKey(band, channel)]"
      :label="t(`adjust.hsl.${channel}`)"
      :display="formatControlValue(hslKey(band, channel), params[hslKey(band, channel)])"
      :min="-1"
      :max="1"
      :step="0.01"
      :reset-to="0"
      :track="mixerTrack(channel)"
      :disabled="!image"
      @update:model-value="setParam(hslKey(band, channel), $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import { formatControlValue } from "@/features/looks/controls";
import {
  HSL_BANDS,
  HSL_CHANNELS,
  HSL_HUE_REACH,
  hslKey,
  type HslBand,
  type HslChannel,
} from "@/features/looks/hsl";
import { lightnessTrack, saturationTrack, shiftTrack } from "@/features/looks/tracks";
import { useLook } from "@/features/looks/useLook";
import { useEditor } from "@/features/photo";
import { t } from "@/shared/i18n";
import UiSegmented from "@/shared/ui/UiSegmented.vue";
import UiSlider from "@/shared/ui/UiSlider.vue";

const { image } = useEditor();
const { params, setParam } = useLook();

const band = ref<HslBand>("red");

const bandHue = computed(() => HSL_BANDS.find((entry) => entry.id === band.value)?.hue ?? 0);

function mixerTrack(channel: HslChannel) {
  if (channel === "hue") return shiftTrack(bandHue.value, HSL_HUE_REACH);
  if (channel === "saturation") return saturationTrack(bandHue.value);
  return lightnessTrack(bandHue.value);
}

const bandOptions = computed(() =>
  HSL_BANDS.map(({ id, hue }) => ({
    value: id,
    label: t(`adjust.bands.${id}`),
    color: `hsl(${hue} 75% 55%)`,
    marked: HSL_CHANNELS.some((channel) => Math.abs(params.value[hslKey(id, channel)]) > 0.001),
  })),
);
</script>

<style scoped>
.mixer {
  display: grid;
  gap: var(--space-1);
}

.mixer :deep(.segments) {
  justify-self: stretch;
  justify-content: space-between;
  margin-bottom: var(--space-2);
}
</style>
