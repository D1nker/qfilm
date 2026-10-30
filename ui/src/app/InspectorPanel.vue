<template>
  <aside>
    <PanelResizer />
    <div class="card">
      <div class="scroll" role="region" :aria-label="t('rail.region')">
        <UiRailPanel
          :model-value="current"
          :label="t('rail.label')"
          :items="items"
          @update:model-value="go"
          @pick="unfold"
        >
          <LooksPanel v-if="tab === 'looks'" :page="looksPage" @select="labelFrameFromLook" />
          <AdjustPanel v-if="tab === 'adjust'" :page="group.adjust" />
          <MasksPanel v-if="tab === 'adjust' && group.adjust === MASKS_PAGE" />
          <FramePanel v-if="tab === 'frame'" :page="group.frame" />
        </UiRailPanel>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { localized, t } from "@/shared/i18n";
import type { Preset } from "@/shared/api/api";
import { FramePanel, frameRailItems, unfoldFramePage, useFrame } from "@/features/frames";
import { MASKS_PAGE, MasksPanel, maskRailItems, unfoldMasksPage } from "@/features/masks";
import { PanelResizer, useInspector, type InspectorTab } from "@/features/inspector";
import UiRailPanel from "@/shared/ui/UiRailPanel.vue";
import {
  AdjustPanel,
  LooksPanel,
  adjustRailItems,
  unfoldAdjustPage,
  useLookPages,
} from "@/features/looks";

const { tab, group } = useInspector();
const { labelFromLook } = useFrame();
const { page: looksPage, items: looksItems } = useLookPages(() => group.looks);

/// Une seule rampe pour tout le panneau : les looks, la retouche, le cadre, séparés d'un trait fin.
const items = computed(() => [
  ...looksItems().map((item) => ({ ...item, section: "looks" })),
  ...[...adjustRailItems(), ...maskRailItems()].map((item) => ({ ...item, section: "adjust" })),
  ...frameRailItems().map((item) => ({ ...item, section: "frame" })),
]);

/// La page affichée : celle que retient la section en cours.
const current = computed(() => (tab.value === "looks" ? looksPage.value : group[tab.value]));

/// Choisir une page, c'est aussi choisir sa section : le reste de l'app (le recadrage, la légende
/// sur la photo, les vignettes du cadre) ne regarde que `tab`.
function go(id: string) {
  const section = items.value.find((item) => item.id === id)?.section as InspectorTab | undefined;
  if (!section) return;

  tab.value = section;
  group[section] = id;
}

function unfold(id: string) {
  if (id === MASKS_PAGE) unfoldMasksPage();
  else if (tab.value === "adjust") unfoldAdjustPage(id);
  else if (tab.value === "frame") unfoldFramePage(id);
}

function labelFrameFromLook(preset: Preset) {
  labelFromLook(preset.id, localized(preset.name));
}
</script>

<style scoped>
aside {
  position: relative;
  min-width: 0;
  min-height: 0;
  padding: var(--space-3) var(--space-3) var(--space-3) 0;
  background: var(--canvas);
}

.card {
  height: 100%;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-md);
  overflow: hidden;
}

.scroll {
  height: 100%;
  min-height: 0;
  padding: var(--space-4);
  overflow-y: auto;
}
</style>
