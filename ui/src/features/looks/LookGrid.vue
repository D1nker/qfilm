<template>
  <div class="grid">
    <div
      v-for="(preset, index) in presets"
      :key="preset.id"
      class="cell"
      @pointerenter="enter(preset)"
      @pointerleave="leave"
    >
      <UiTooltip :text="localized(preset.description)" side="left">
        <UiThumbnailButton
          :name="localized(preset.name)"
          :src="thumbnails[preset.id]"
          :active="preset.id === activePreset"
          @click="pick(preset)"
        />
      </UiTooltip>

      <button
        type="button"
        class="star"
        :class="{ on: isFavorite(preset.id) }"
        :aria-pressed="isFavorite(preset.id)"
        :aria-label="t(isFavorite(preset.id) ? 'looks.removeFavorite' : 'looks.addFavorite')"
        :aria-describedby="`${uid}-${index}`"
        @click="toggleFavorite(preset.id)"
      >
        <Star :size="14" :fill="isFavorite(preset.id) ? 'currentColor' : 'none'" />
      </button>
      <!-- Sans le nom du look dans celui du bouton (il se confondrait avec la vignette), la description le dit. -->
      <span :id="`${uid}-${index}`" class="sr-only">{{ localized(preset.name) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, useId } from "vue";
import { Star } from "lucide-vue-next";

import { localized, t } from "@/shared/i18n";
import type { Preset } from "@/shared/api/api";
import { useEditor } from "@/features/photo";
import { useFavorites } from "@/features/looks/useFavorites";
import { useLook } from "@/features/looks/useLook";
import { usePresetPreview } from "@/features/looks/usePresetPreview";
import UiThumbnailButton from "@/shared/ui/UiThumbnailButton.vue";
import UiTooltip from "@/shared/ui/UiTooltip.vue";

/// Une grille de vignettes de looks : un clic l'applique, survoler l'essaie sur la photo, l'étoile
/// le garde dans les favoris.
defineProps<{ presets: Preset[] }>();

const emit = defineEmits<{ select: [preset: Preset] }>();

const { thumbnails } = useEditor();
const { activePreset } = useLook();
const { isFavorite, toggleFavorite } = useFavorites();

const { enter, leave, stop } = usePresetPreview();
const uid = useId();

/// Le look est appliqué : l'aperçu, qui le montrait à pleine intensité, doit s'effacer, sinon le
// pointeur resté sur la vignette masquerait les réglages qui suivent.
function pick(preset: Preset) {
  stop();
  emit("select", preset);
}

// Une page qu'on quitte emporte sa grille, qui ne recevra plus de `pointerleave` : sans cela
// l'aperçu resterait collé à la photo.
onBeforeUnmount(stop);
</script>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
  padding: var(--space-1);
}

.cell {
  position: relative;
  min-width: 0;
}

.star {
  position: absolute;
  top: var(--space-1);
  right: var(--space-1);
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-full);
  background: color-mix(in oklab, var(--bg) 70%, transparent);
  color: var(--text);
  cursor: pointer;
  opacity: 0;
  transition:
    opacity var(--duration-fast) var(--ease),
    color var(--duration-fast) var(--ease);
}

/* Une étoile allumée reste visible : c'est elle qui dit que le look est dans les favoris. */
.cell:hover .star,
.star:focus-visible,
.star.on {
  opacity: 1;
}

.star.on {
  color: var(--accent);
}

.star:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
