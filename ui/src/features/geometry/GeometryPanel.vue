<template>
  <div>
    <UiPageHead :title="t('geometry.title')">
      <UiButton
        variant="ghost"
        size="sm"
        :disabled="!modified"
        :aria-label="`${t('adjust.resetGroup')} : ${t('geometry.title')}`"
        @click="reset"
      >
        {{ t("common.reset") }}
      </UiButton>
    </UiPageHead>

    <div class="geometry">
      <UiButton
        :variant="cropping ? 'primary' : 'secondary'"
        :disabled="!image"
        @click="toggleCropping"
      >
        <Crop :size="14" />
        {{ cropping ? t("geometry.done") : t("geometry.crop") }}
      </UiButton>

      <UiField :label="t('geometry.aspect')">
        <div class="aspect">
          <UiSelect
            :model-value="aspect"
            :options="aspectOptions()"
            @update:model-value="setAspect($event)"
          />
          <UiTooltip :text="t('geometry.orientation')">
            <UiButton
              icon
              :disabled="!image || aspect === 'original'"
              :aria-label="t('geometry.orientation')"
              @click="swapOrientation"
            >
              <component :is="portrait ? RectangleVertical : RectangleHorizontal" :size="14" />
            </UiButton>
          </UiTooltip>
        </div>
      </UiField>

      <UiField v-for="row in toolRows()" :key="row.id" :label="row.label" as="div">
        <div class="pair" role="group" :aria-label="row.label">
          <UiTooltip v-for="tool in row.tools" :key="tool.id" :text="tool.label">
            <UiButton icon :disabled="!image" :aria-label="tool.label" @click="tool.run">
              <component :is="tool.icon" :size="14" />
            </UiButton>
          </UiTooltip>
        </div>
      </UiField>

      <UiSlider
        :model-value="angle"
        :label="t('geometry.straighten')"
        :display="`${angle.toFixed(1)}°`"
        :min="-MAX_ANGLE"
        :max="MAX_ANGLE"
        :step="0.1"
        :reset-to="0"
        :disabled="!image"
        @update:model-value="setAngle"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  Crop,
  FlipHorizontal2,
  FlipVertical2,
  RectangleHorizontal,
  RectangleVertical,
  RotateCcw,
  RotateCw,
} from "lucide-vue-next";

import { ASPECTS, type AspectId } from "@/features/geometry/crop";
import { MAX_ANGLE, useGeometry } from "@/features/geometry/useGeometry";
import { useEditor } from "@/features/photo";
import { t } from "@/shared/i18n";
import UiButton from "@/shared/ui/UiButton.vue";
import UiField from "@/shared/ui/UiField.vue";
import UiPageHead from "@/shared/ui/UiPageHead.vue";
import UiSelect from "@/shared/ui/UiSelect.vue";
import UiSlider from "@/shared/ui/UiSlider.vue";
import UiTooltip from "@/shared/ui/UiTooltip.vue";

const { image } = useEditor();
const {
  cropping,
  aspect,
  portrait,
  angle,
  modified,
  toggleCropping,
  setAspect,
  swapOrientation,
  setAngle,
  rotate,
  flip,
  reset,
} = useGeometry();

/// Les formats chiffrés (3:2…) ne se traduisent pas ; « original » et « libre », si.
const aspectLabel = (id: AspectId) =>
  id === "original" || id === "free" ? t(`geometry.aspects.${id}`) : id;

const aspectOptions = () => ASPECTS.map((id) => ({ value: id, label: aspectLabel(id) }));

/// Deux rangées de deux boutons : ce qui pivote, ce qui retourne. Une icône seule ne dit pas laquelle est laquelle.
const toolRows = () => [
  {
    id: "rotation",
    label: t("geometry.rotation"),
    tools: [
      { id: "left", icon: RotateCcw, label: t("geometry.rotateLeft"), run: () => rotate(false) },
      { id: "right", icon: RotateCw, label: t("geometry.rotateRight"), run: () => rotate(true) },
    ],
  },
  {
    id: "mirror",
    label: t("geometry.mirror"),
    tools: [
      {
        id: "horizontal",
        icon: FlipHorizontal2,
        label: t("geometry.flipHorizontal"),
        run: () => flip("horizontal"),
      },
      {
        id: "vertical",
        icon: FlipVertical2,
        label: t("geometry.flipVertical"),
        run: () => flip("vertical"),
      },
    ],
  },
];
</script>

<style scoped>
/* Les rangées ont toutes le même rythme : `UiField` y ajoute sa propre marge, qu'on retire. */
.geometry {
  display: grid;
  gap: var(--space-4);
  margin-top: var(--space-2);
}

.geometry :deep(.field) {
  margin-top: 0;
}

.aspect {
  display: flex;
  gap: var(--space-2);
}

.pair {
  display: flex;
  gap: var(--space-1);
}
</style>
