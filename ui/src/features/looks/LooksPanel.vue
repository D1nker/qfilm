<template>
  <div>
    <UiSlider
      v-model="amount"
      :label="t('looks.intensity')"
      :display="`${Math.round(amount * 100)} %`"
      :min="0"
      :max="1"
      :step="0.01"
      :edit-scale="100"
      :disabled="activePreset === 'neutral'"
      class="amount"
    />

    <UiCollapsible v-for="group in groupedPresets" :key="group.key" :title="localized(group.title)">
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
          />
        </UiTooltip>
      </div>
    </UiCollapsible>
  </div>
</template>

<script setup lang="ts">
import { localized, t } from "@/shared/i18n";
import type { Preset } from "@/shared/api/api";
import { useEditor } from "@/features/photo";
import { useLook } from "@/features/looks/useLook";
import UiCollapsible from "@/shared/ui/UiCollapsible.vue";
import UiSlider from "@/shared/ui/UiSlider.vue";
import UiTooltip from "@/shared/ui/UiTooltip.vue";
import UiThumbnailButton from "@/shared/ui/UiThumbnailButton.vue";

const emit = defineEmits<{ select: [preset: Preset] }>();

const { groupedPresets, thumbnails } = useEditor();
const { activePreset, amount, applyPreset } = useLook();
function select(preset: Preset) {
  applyPreset(preset);
  emit("select", preset);
}
</script>

<style scoped>
.amount {
  margin: 0 0 var(--space-4);
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
  padding: var(--space-2) var(--space-1) var(--space-1);
}
</style>
