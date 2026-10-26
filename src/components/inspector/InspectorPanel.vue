<script setup lang="ts">
import { useInspector, type InspectorTab } from "@/composables/useInspector";
import UiTabs from "@/components/ui/UiTabs.vue";
import AdjustPanel from "@/components/inspector/AdjustPanel.vue";
import FramePanel from "@/components/inspector/FramePanel.vue";
import LooksPanel from "@/components/inspector/LooksPanel.vue";

const TABS: { value: InspectorTab; label: string }[] = [
  { value: "looks", label: "Looks" },
  { value: "adjust", label: "Réglages" },
  { value: "frame", label: "Cadre" },
];

const { tab } = useInspector();
</script>

<template>
  <aside>
    <UiTabs v-model="tab" :tabs="TABS">
      <template #looks><LooksPanel /></template>
      <template #adjust><AdjustPanel /></template>
      <template #frame><FramePanel /></template>
    </UiTabs>
  </aside>
</template>

<style scoped>
aside {
  min-width: 0;
  min-height: 0;
  border-left: 1px solid var(--border);
  background: var(--surface);
  overflow: hidden;
}
</style>
