<template>
  <UiRailPanel :label="t('frames.rail')" :items="railItems()">
    <GeometryPanel data-rail="crop" />

    <UiCollapsible id="frame-shape" data-rail="frame" :title="t('frames.shape')">
      <template #actions>
        <UiButton variant="ghost" size="sm" :disabled="isPristine" @click="resetFrame">
          {{ t("common.reset") }}
        </UiButton>
      </template>
      <div class="grid">
        <UiThumbnailButton
          v-for="info in frames"
          :key="info.id"
          :name="localized(info.name)"
          :src="thumbnails[info.id]"
          :active="info.id === frame.id"
          fit="contain"
          @click="applyFrame(info.id)"
        />
      </div>
    </UiCollapsible>

    <UiCollapsible
      v-for="section in sections"
      :key="`${frame.id}:${section.key}`"
      :title="localized(section.title)"
    >
      <FrameParamControl
        v-for="def in section.defs"
        :key="def.id"
        :def="def"
        :value="valueOf(def)"
        @change="setParam(def, $event)"
      />
    </UiCollapsible>

    <UiCollapsible id="frame-caption" data-rail="caption" :title="t('frames.caption')">
      <UiField :label="t('caption.text')" stacked>
        <UiInput v-model="caption.text" :placeholder="t('caption.placeholder')" />
      </UiField>

      <UiField :label="t('caption.font')">
        <UiSelect v-model="caption.font" :options="fontOptions()" />
      </UiField>

      <UiSlider
        v-model="caption.size"
        :label="t('caption.size')"
        :display="`${caption.size.toFixed(1)} %`"
        :min="1"
        :max="20"
        :step="0.5"
      />

      <UiField :label="t('caption.color')">
        <UiColorInput v-model="caption.color" />
      </UiField>

      <UiField :label="t('caption.position')" as="div">
        <UiButton size="sm" :disabled="caption.x === null" @click="recenterCaption">
          {{ t("caption.recenter") }}
        </UiButton>
      </UiField>

      <p class="note">
        {{ t("caption.hint") }}
      </p>
    </UiCollapsible>

    <UiCollapsible
      id="frame-mine"
      data-rail="library"
      :title="t('frames.myFrames')"
      :default-open="false"
    >
      <FrameLibrary />
    </UiCollapsible>
  </UiRailPanel>
</template>

<script setup lang="ts">
import { Crop, Film, FolderOpen, Type } from "lucide-vue-next";
import { localized, t } from "@/shared/i18n";
import { computed } from "vue";

import type { ParamDef, ParamValue } from "@/shared/api/api";
import { fontOptions } from "@/features/frames/fonts";
import { GeometryPanel } from "@/features/geometry";
import { sectionsOf } from "@/features/frames/frameParams";
import { useFrame } from "@/features/frames/useFrame";
import { useFrameThumbnails } from "@/features/frames/useFrameThumbnails";
import UiButton from "@/shared/ui/UiButton.vue";
import UiCollapsible from "@/shared/ui/UiCollapsible.vue";
import UiRailPanel from "@/shared/ui/UiRailPanel.vue";
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

const railItems = () => [
  { id: "crop", label: t("geometry.title"), icon: Crop },
  { id: "frame", label: t("tabs.frame"), icon: Film },
  { id: "caption", label: t("frames.caption"), icon: Type },
  { id: "library", label: t("frames.myFrames"), icon: FolderOpen },
];

const sections = computed(() => (current.value ? sectionsOf(current.value, frame.params) : []));

function valueOf(def: ParamDef): ParamValue {
  return frame.params[def.id] ?? def.default;
}
</script>

<style scoped>
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
