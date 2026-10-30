<template>
  <div>
    <UiPageHead :title="t('masks.title')">
      <UiButton variant="ghost" size="sm" :disabled="masks.length === 0" @click="reset">
        {{ t("common.reset") }}
      </UiButton>
    </UiPageHead>

    <div class="add">
      <UiButton :disabled="!image" @click="add('linear')">
        <Slash :size="14" />
        {{ t("masks.linear") }}
      </UiButton>
      <UiButton :disabled="!image" @click="add('radial')">
        <Circle :size="14" />
        {{ t("masks.radial") }}
      </UiButton>
    </div>

    <p v-if="masks.length === 0" class="empty">{{ t("masks.empty") }}</p>

    <ul v-else class="list" :aria-label="t('masks.list')">
      <li
        v-for="mask in masks"
        :key="mask.id"
        class="row"
        :class="{ selected: mask.id === selectedId }"
      >
        <button
          type="button"
          class="pick"
          :aria-pressed="mask.id === selectedId"
          @click="select(mask.id)"
        >
          <component :is="mask.shape.kind === 'linear' ? Slash : Circle" :size="14" />
          <span class="name">{{ nameOf(mask) }}</span>
          <span v-if="!isIdle(mask.adjust)" class="dot" aria-hidden="true" />
        </button>
        <UiTooltip :text="t('masks.remove', { name: nameOf(mask) })">
          <UiButton
            variant="ghost"
            size="sm"
            icon
            :aria-label="t('masks.remove', { name: nameOf(mask) })"
            @click="remove(mask.id)"
          >
            <Trash2 :size="13" />
          </UiButton>
        </UiTooltip>
      </li>
    </ul>

    <template v-if="selected">
      <div class="shape">
        <UiField :label="t('masks.invert')" as="div">
          <UiSwitch
            :model-value="selected.invert"
            @update:model-value="setInvert(selected.id, $event)"
          />
        </UiField>

        <template v-if="selected.shape.kind === 'radial'">
          <UiSlider
            :model-value="selected.shape.feather"
            :label="t('masks.feather')"
            :display="`${Math.round(selected.shape.feather * 100)} %`"
            :min="0"
            :max="1"
            :step="0.01"
            :edit-scale="100"
            @update:model-value="setFeather"
          />
          <UiSlider
            :model-value="selected.shape.angle"
            :label="t('masks.angle')"
            :display="`${Math.round(selected.shape.angle)}°`"
            :min="-180"
            :max="180"
            :step="1"
            :reset-to="0"
            @update:model-value="setAngle"
          />
        </template>
      </div>

      <UiCollapsible
        v-for="section in SECTIONS"
        :id="`mask-${section.id}`"
        :key="section.id"
        :title="t(`adjust.groups.${section.id}`)"
      >
        <UiSlider
          v-for="control in section.controls"
          :key="control.key"
          :model-value="selected.adjust[control.key]"
          :label="t(`adjust.controls.${control.key}`)"
          :display="formatControlValue(control.key, selected.adjust[control.key])"
          :min="control.min"
          :max="control.max"
          :step="control.step"
          :reset-to="0"
          :track="trackFor(control.key, NEUTRAL)"
          @update:model-value="setAdjust(selected.id, control.key, $event)"
        />
      </UiCollapsible>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Circle, Slash, Trash2 } from "lucide-vue-next";

import { t } from "@/shared/i18n";
import type { Mask } from "@/shared/api/api";
import { NEUTRAL, controls, formatControlValue, trackFor } from "@/features/looks";
import { MASK_KEYS, isIdle, ordinalOf, type MaskAdjustKey } from "@/features/masks/maskShapes";
import { useMasks } from "@/features/masks/useMasks";
import { useEditor } from "@/features/photo";
import UiButton from "@/shared/ui/UiButton.vue";
import UiCollapsible from "@/shared/ui/UiCollapsible.vue";
import UiField from "@/shared/ui/UiField.vue";
import UiPageHead from "@/shared/ui/UiPageHead.vue";
import UiSlider from "@/shared/ui/UiSlider.vue";
import UiSwitch from "@/shared/ui/UiSwitch.vue";
import UiTooltip from "@/shared/ui/UiTooltip.vue";

/// La page des masques : on en ajoute, on choisit celui qu'on règle, ses poignées sont sur la photo
/// (`MaskOverlay`). Un masque ne règle que la lumière et la couleur, avec les mêmes curseurs que Retouche.
const { image } = useEditor();
const { masks, selected, selectedId, add, remove, select, setShape, setAdjust, setInvert, reset } =
  useMasks();

const SECTIONS = (["light", "color"] as const).map((id) => ({
  id,
  controls: controls.filter(
    (control): control is typeof control & { key: MaskAdjustKey } =>
      control.group === id && (MASK_KEYS as readonly string[]).includes(control.key),
  ),
}));

const nameOf = (mask: Mask) =>
  t(mask.shape.kind === "linear" ? "masks.linearName" : "masks.radialName", {
    n: ordinalOf(masks.value, mask),
  });

function setFeather(feather: number) {
  const mask = selected.value;
  if (mask?.shape.kind === "radial") setShape(mask.id, { ...mask.shape, feather });
}

function setAngle(angle: number) {
  const mask = selected.value;
  if (mask?.shape.kind === "radial") setShape(mask.id, { ...mask.shape, angle });
}
</script>

<style scoped>
.add {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.empty {
  margin: var(--space-4) var(--space-1) 0;
  color: var(--text-faint);
  font-size: var(--text-xs);
  line-height: 1.5;
}

.list {
  display: grid;
  gap: var(--space-1);
  margin: var(--space-4) 0 0;
  padding: 0;
  list-style: none;
}

.row {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  border-radius: var(--radius-md);
}

.row.selected {
  background: var(--accent-soft);
}

.pick {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  height: 32px;
  padding: 0 var(--space-2);
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: var(--text-sm);
  text-align: left;
  cursor: pointer;
}

.row.selected .pick {
  color: var(--accent);
}

.pick:hover {
  color: var(--text);
}

.pick:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Un point quand le masque change quelque chose : un masque neutre ne coûte rien et se voit comme tel. */
.dot {
  width: 6px;
  height: 6px;
  margin-left: auto;
  border-radius: var(--radius-full);
  background: var(--accent);
}

.shape {
  margin: var(--space-4) 0 var(--space-5);
}
</style>
