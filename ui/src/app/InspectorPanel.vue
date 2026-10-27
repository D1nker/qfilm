<template>
  <aside>
    <UiTabs v-model="tab" :tabs="TABS">
      <template #looks><LooksPanel @select="labelFrameFromLook" /></template>
      <template #adjust><AdjustPanel /></template>
      <template #frame><FramePanel /></template>
    </UiTabs>
  </aside>
</template>

<script setup lang="ts">
import type { Preset } from "@/shared/api/api";
import { useFrame, FramePanel } from "@/features/frames";
import { useInspector, type InspectorTab } from "@/features/inspector";
import UiTabs from "@/shared/ui/UiTabs.vue";
import { AdjustPanel, LooksPanel } from "@/features/looks";

const TABS: { value: InspectorTab; label: string }[] = [
  { value: "looks", label: "Looks" },
  { value: "adjust", label: "Réglages" },
  { value: "frame", label: "Cadre" },
];

const { tab } = useInspector();
const { labelFromLook } = useFrame();

function labelFrameFromLook(preset: Preset) {
  labelFromLook(preset.id, preset.name);
}
</script>

<style scoped>
aside {
  min-width: 0;
  min-height: 0;
  border-left: 1px solid var(--border);
  background: var(--surface);
  overflow: hidden;
}
</style>
