<template>
  <aside>
    <PanelResizer />
    <div class="card">
      <UiTabs v-model="tab" :tabs="tabs">
        <template #looks>
          <LooksPanel v-model:group="group.looks" @select="labelFrameFromLook" />
        </template>
        <template #adjust><AdjustPanel v-model:group="group.adjust" /></template>
        <template #frame><FramePanel v-model:group="group.frame" /></template>
      </UiTabs>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { localized, t } from "@/shared/i18n";
import type { Preset } from "@/shared/api/api";
import { useFrame, FramePanel } from "@/features/frames";
import { PanelResizer, useInspector, type InspectorTab } from "@/features/inspector";
import UiTabs from "@/shared/ui/UiTabs.vue";
import { AdjustPanel, LooksPanel } from "@/features/looks";

const tabs = computed<{ value: InspectorTab; label: string }[]>(() => [
  { value: "looks", label: t("tabs.looks") },
  { value: "adjust", label: t("tabs.adjust") },
  { value: "frame", label: t("tabs.frame") },
]);

const { tab, group } = useInspector();
const { labelFromLook } = useFrame();

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
</style>
