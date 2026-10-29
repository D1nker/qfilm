<template>
  <div class="curves">
    <UiSegmented v-model="channel" :label="t('adjust.curves.channel')" :options="channelOptions" />

    <CurveEditor
      :label="t('adjust.curves.graph')"
      :points="pointsOf(params.curves[channel])"
      :color="CHANNEL_COLORS[channel]"
      :disabled="!image"
      @change="setCurve(channel, $event)"
    />

    <p class="hint">{{ t("adjust.curves.hint") }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import CurveEditor from "@/features/looks/CurveEditor.vue";
import { CURVE_IDS, isFlat, pointsOf, type CurveId } from "@/features/looks/curves";
import { useLook } from "@/features/looks/useLook";
import { useEditor } from "@/features/photo";
import { t } from "@/shared/i18n";
import UiSegmented from "@/shared/ui/UiSegmented.vue";

const { image } = useEditor();
const { params, setCurve } = useLook();

const channel = ref<CurveId>("rgb");

/// Des teintes d'illustration, pas des couleurs d'interface ; la courbe RVB suit le texte.
const CHANNEL_COLORS: Record<CurveId, string> = {
  rgb: "var(--text)",
  red: "hsl(0 75% 55%)",
  green: "hsl(130 65% 45%)",
  blue: "hsl(220 80% 60%)",
};

const channelOptions = computed(() =>
  CURVE_IDS.map((id) => ({
    value: id,
    label: t(`adjust.curves.${id}`),
    ...(id === "rgb" ? { text: t("adjust.curves.rgbShort") } : { color: CHANNEL_COLORS[id] }),
    marked: !isFlat(params.value.curves[id]),
  })),
);
</script>

<style scoped>
.curves {
  display: grid;
}

.curves :deep(.segments) {
  justify-self: stretch;
  justify-content: space-between;
  margin-top: var(--space-4);
}

.curves :deep(.segment) {
  flex: 1;
}

.hint {
  margin: var(--space-3) 0 0;
  color: var(--text-faint);
  font-size: var(--text-xs);
  text-align: center;
}
</style>
