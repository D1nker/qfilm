<template>
  <div>
    <template v-for="entry in pages" :key="entry.id">
      <div v-if="page === entry.id">
        <UiPageHead :title="entry.title">
          <UiButton variant="ghost" size="sm" :disabled="isPristine" @click="resetLook">
            {{ t("common.reset") }}
          </UiButton>
        </UiPageHead>

        <LookGrid v-if="entry.presets.length > 0" :presets="entry.presets" @select="select" />
        <p v-else class="empty">{{ entry.empty }}</p>
      </div>
    </template>

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
import { computed } from "vue";

import { localized, t } from "@/shared/i18n";
import type { Preset } from "@/shared/api/api";
import { useEditor } from "@/features/photo";
import LookGrid from "@/features/looks/LookGrid.vue";
import { FAVORITES_PAGE, RECENT_PAGE } from "@/features/looks/lookPages";
import { useFavorites } from "@/features/looks/useFavorites";
import { useLook } from "@/features/looks/useLook";
import UiButton from "@/shared/ui/UiButton.vue";
import UiPageHead from "@/shared/ui/UiPageHead.vue";
import UiSlider from "@/shared/ui/UiSlider.vue";

/// Les looks : les favoris, les récents, puis une page par catégorie. La page affichée est choisie sur
/// la rampe d'icônes de l'hôte (`InspectorPanel`), qui l'obtient de `useLookPages`. Seule cette page
/// est montée : ses vignettes et l'aperçu au survol partent avec elle.
const props = defineProps<{ page: string }>();

const emit = defineEmits<{ select: [preset: Preset] }>();

const { groupedPresets } = useEditor();
const { activePreset, amount, isPristine, applyPreset, resetLook } = useLook();
const { favoritePresets, recentPresets, noteUsed } = useFavorites();

const pages = computed(() => [
  {
    id: FAVORITES_PAGE,
    title: t("looks.favorites"),
    presets: favoritePresets.value,
    empty: t("looks.noFavorites"),
  },
  {
    id: RECENT_PAGE,
    title: t("looks.recent"),
    presets: recentPresets.value,
    empty: t("looks.noRecent"),
  },
  ...groupedPresets.value.map((group) => ({
    id: group.key,
    title: localized(group.title),
    presets: group.items,
    empty: "",
  })),
]);

function select(preset: Preset) {
  applyPreset(preset);
  // Dans les récents le look y est déjà : le remonter changerait la grille sous le pointeur, qui
  // se mettrait à essayer le look d'à côté.
  if (props.page !== RECENT_PAGE) noteUsed(preset);
  emit("select", preset);
}
</script>

<style scoped>
.empty {
  margin: var(--space-4) var(--space-1);
  color: var(--text-faint);
  font-size: var(--text-xs);
  line-height: 1.5;
}
</style>
