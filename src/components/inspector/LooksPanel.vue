<template>
  <div>
    <UiSlider
      v-model="amount"
      label="Intensité"
      :display="`${Math.round(amount * 100)} %`"
      :min="0"
      :max="1"
      :step="0.01"
      :disabled="activePreset === 'neutral'"
      class="amount"
    />

    <UiCollapsible v-for="[category, items] in groupedPresets" :key="category" :title="category">
      <div class="grid">
        <UiTooltip v-for="preset in items" :key="preset.id" :text="preset.description" side="left">
          <ThumbnailButton
            :name="preset.name"
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
import type { Preset } from "@/lib/api";
import { useEditor } from "@/composables/useEditor";
import { useFrame } from "@/composables/useFrame";
import { useLook } from "@/composables/useLook";
import UiCollapsible from "@/components/ui/UiCollapsible.vue";
import UiSlider from "@/components/ui/UiSlider.vue";
import UiTooltip from "@/components/ui/UiTooltip.vue";
import ThumbnailButton from "@/components/inspector/ThumbnailButton.vue";

const { groupedPresets, thumbnails } = useEditor();
const { activePreset, amount, applyPreset } = useLook();
const { labelFromLook } = useFrame();

function select(preset: Preset) {
  applyPreset(preset);
  labelFromLook(preset.id, preset.name);
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
