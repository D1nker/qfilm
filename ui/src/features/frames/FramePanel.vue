<template>
  <div>
    <div class="head">
      <p>Cadre</p>
      <UiButton variant="ghost" size="sm" :disabled="isPristine" @click="resetFrame">
        Réinitialiser
      </UiButton>
    </div>

    <UiCollapsible title="Forme">
      <div class="grid">
        <UiThumbnailButton
          v-for="info in frames"
          :key="info.id"
          :name="info.name"
          :src="thumbnails[info.id]"
          :active="info.id === frame.id"
          fit="contain"
          @click="applyFrame(info.id)"
        />
      </div>
    </UiCollapsible>

    <UiCollapsible v-for="[title, defs] in sections" :key="`${frame.id}:${title}`" :title="title">
      <FrameParamControl
        v-for="def in defs"
        :key="def.id"
        :def="def"
        :value="valueOf(def)"
        @change="setParam(def, $event)"
      />
    </UiCollapsible>

    <UiCollapsible title="Légende">
      <UiField label="Texte" stacked>
        <UiInput v-model="caption.text" placeholder="Biarritz, août 2026" />
      </UiField>

      <UiField label="Police">
        <UiSelect v-model="caption.font" :options="FONTS" />
      </UiField>

      <UiSlider
        v-model="caption.size"
        label="Taille"
        :display="`${caption.size.toFixed(1)} %`"
        :min="1"
        :max="20"
        :step="0.5"
      />

      <UiField label="Couleur">
        <UiColorInput v-model="caption.color" />
      </UiField>

      <UiField label="Position" as="div">
        <UiButton size="sm" :disabled="caption.x === null" @click="recenterCaption">
          Recentrer
        </UiButton>
      </UiField>

      <p class="note">
        Clique sur l'image pour modifier un texte, glisse la légende pour la placer.
      </p>
    </UiCollapsible>

    <UiCollapsible title="Mes cadres" :default-open="false">
      <FrameLibrary />
    </UiCollapsible>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import type { ParamDef, ParamValue } from "@/shared/api/api";
import { FONTS } from "@/features/frames/fonts";
import { sectionsOf } from "@/features/frames/frameParams";
import { useFrame } from "@/features/frames/useFrame";
import { useFrameThumbnails } from "@/features/frames/useFrameThumbnails";
import UiButton from "@/shared/ui/UiButton.vue";
import UiCollapsible from "@/shared/ui/UiCollapsible.vue";
import UiColorInput from "@/shared/ui/UiColorInput.vue";
import UiField from "@/shared/ui/UiField.vue";
import UiInput from "@/shared/ui/UiInput.vue";
import UiSelect from "@/shared/ui/UiSelect.vue";
import UiSlider from "@/shared/ui/UiSlider.vue";
import FrameLibrary from "@/features/frames/FrameLibrary.vue";
import FrameParamControl from "@/features/frames/FrameParamControl.vue";
import UiThumbnailButton from "@/shared/ui/UiThumbnailButton.vue";

const {
  frames,
  frame,
  caption,
  current,
  isPristine,
  applyFrame,
  setParam,
  resetFrame,
  recenterCaption,
} = useFrame();
const { thumbnails } = useFrameThumbnails();

const sections = computed(() => (current.value ? sectionsOf(current.value, frame.params) : []));

function valueOf(def: ParamDef): ParamValue {
  return frame.params[def.id] ?? def.default;
}
</script>

<style scoped>
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-3);
  font-weight: var(--weight-semibold);
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
  padding: var(--space-2) var(--space-1) var(--space-1);
}

.note {
  margin-top: var(--space-3);
  color: var(--text-faint);
  font-size: var(--text-xs);
  line-height: 1.5;
}
</style>
