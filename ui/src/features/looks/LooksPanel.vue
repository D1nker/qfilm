<template>
  <UiRailPanel v-model="page" :label="t('looks.rail')" :items="railItems()" @pick="unfold">
    <template v-for="group in groupedPresets" :key="group.key" #[group.key]>
      <UiCollapsible :id="`looks-${group.key}`" :title="localized(group.title)">
        <template #actions>
          <UiButton variant="ghost" size="sm" :disabled="isPristine" @click="resetLook">
            {{ t("common.reset") }}
          </UiButton>
        </template>

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
    </template>

    <template #footer>
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
    </template>
  </UiRailPanel>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { localized, t } from "@/shared/i18n";
import type { Preset } from "@/shared/api/api";
import { useEditor } from "@/features/photo";
import { categoryIcon } from "@/features/looks/categoryIcons";
import { useLook } from "@/features/looks/useLook";
import { openPanels } from "@/shared/lib/panelState";
import UiButton from "@/shared/ui/UiButton.vue";
import UiCollapsible from "@/shared/ui/UiCollapsible.vue";
import UiRailPanel from "@/shared/ui/UiRailPanel.vue";
import UiSlider from "@/shared/ui/UiSlider.vue";
import UiTooltip from "@/shared/ui/UiTooltip.vue";
import UiThumbnailButton from "@/shared/ui/UiThumbnailButton.vue";

const emit = defineEmits<{ select: [preset: Preset] }>();

const { groupedPresets, thumbnails } = useEditor();
const { activePreset, amount, isPristine, applyPreset, resetLook } = useLook();

/// La catégorie affichée, tenue par le panneau d'à côté (voir `AdjustPanel`). Vide : celle du look
/// appliqué, à défaut la première.
const chosen = defineModel<string>("group", { required: true });

const automatic = computed(() => {
  const groups = groupedPresets.value;
  const active = groups.find((entry) =>
    entry.items.some((preset) => preset.id === activePreset.value),
  );
  return (active ?? groups[0])?.key ?? "";
});

const page = computed({
  get: () =>
    groupedPresets.value.some((entry) => entry.key === chosen.value)
      ? chosen.value
      : automatic.value,
  set: (key: string) => {
    chosen.value = key;
  },
});

const railItems = () =>
  groupedPresets.value.map(({ key, title }) => ({
    id: key,
    label: localized(title),
    icon: categoryIcon(key),
  }));

/// Choisir une catégorie déplie sa section : elles sont peu nombreuses, on veut voir les vignettes.
const unfold = (key: string) => openPanels([`looks-${key}`]);
function select(preset: Preset) {
  applyPreset(preset);
  emit("select", preset);
}
</script>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
  padding: var(--space-2) var(--space-1) var(--space-1);
}
</style>
