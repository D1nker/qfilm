<template>
  <div>
    <div v-for="group in groupedPresets" v-show="page === group.key" :key="group.key">
      <UiPageHead :title="localized(group.title)">
        <UiButton variant="ghost" size="sm" :disabled="isPristine" @click="resetLook">
          {{ t("common.reset") }}
        </UiButton>
      </UiPageHead>

      <div class="grid">
        <UiTooltip
          v-for="preset in group.items"
          :key="preset.id"
          :text="localized(preset.description)"
          side="left"
        >
          <UiThumbnailButton
            :name="localized(preset.name)"
            :src="thumbnails[preset.id]"
            :active="preset.id === activePreset"
            @click="select(preset)"
            @pointerenter="enter(preset)"
            @pointerleave="leave"
          />
        </UiTooltip>
      </div>
    </div>

    <UiSlider
      v-model="amount"
      :label="t('looks.intensity')"
      :display="`${Math.round(amount * 100)} %`"
      :min="0"
      :max="1"
      :step="0.01"
      :edit-scale="100"
      :disabled="activePreset === 'neutral'"
    />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, watch } from "vue";

import { localized, t } from "@/shared/i18n";
import type { Preset } from "@/shared/api/api";
import { useEditor } from "@/features/photo";
import { useLook } from "@/features/looks/useLook";
import { usePresetPreview } from "@/features/looks/usePresetPreview";
import UiButton from "@/shared/ui/UiButton.vue";
import UiPageHead from "@/shared/ui/UiPageHead.vue";
import UiSlider from "@/shared/ui/UiSlider.vue";
import UiTooltip from "@/shared/ui/UiTooltip.vue";
import UiThumbnailButton from "@/shared/ui/UiThumbnailButton.vue";

/// Les looks, rangés par catégorie. La page affichée est choisie sur la rampe d'icônes de l'hôte
/// (`InspectorPanel`), qui l'obtient de `useLookPages`.
const props = defineProps<{ page: string }>();

const emit = defineEmits<{ select: [preset: Preset] }>();

const { groupedPresets, thumbnails } = useEditor();
const { activePreset, amount, isPristine, applyPreset, resetLook } = useLook();

const { enter, leave, stop } = usePresetPreview();

// Une page cachée ne reçoit plus de `pointerleave` : sans cela l'aperçu resterait collé à la photo.
watch(() => props.page, stop);
onBeforeUnmount(stop);

function select(preset: Preset) {
  stop();
  applyPreset(preset);
  emit("select", preset);
}
</script>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
  padding: var(--space-1);
}
</style>
