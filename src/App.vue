<script setup lang="ts">
import { onMounted } from "vue";
import { TooltipProvider } from "reka-ui";

import { useEditor } from "@/composables/useEditor";
import { useFrame } from "@/composables/useFrame";
import { useInspector } from "@/composables/useInspector";
import { useShortcuts } from "@/composables/useShortcuts";
import AppHeader from "@/components/AppHeader.vue";
import ImageViewport from "@/components/ImageViewport.vue";
import ExportDialog from "@/components/export/ExportDialog.vue";
import InspectorPanel from "@/components/inspector/InspectorPanel.vue";

const { error, init } = useEditor();
const { init: initFrames } = useFrame();
const { open } = useInspector();

useShortcuts();

onMounted(() => void Promise.all([init(), initFrames()]));
</script>

<template>
  <TooltipProvider :delay-duration="400">
    <div class="layout" :class="{ collapsed: !open }">
      <AppHeader class="area-header" />
      <ImageViewport class="area-main" />
      <InspectorPanel v-show="open" class="area-inspector" />
    </div>

    <p v-if="error" class="error" role="alert">{{ error }}</p>

    <ExportDialog />
  </TooltipProvider>
</template>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: 1fr 320px;
  grid-template-rows: 52px minmax(0, 1fr);
  grid-template-areas: "header header" "main inspector";
  height: 100%;
  transition: grid-template-columns var(--duration) var(--ease);
}

.layout.collapsed {
  grid-template-columns: 1fr 0;
}

.area-header {
  grid-area: header;
}

.area-main {
  grid-area: main;
}

.area-inspector {
  grid-area: inspector;
}

.error {
  position: fixed;
  bottom: var(--space-4);
  left: 50%;
  z-index: 200;
  max-width: min(560px, calc(100vw - 32px));
  transform: translateX(-50%);
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--danger);
  border-radius: var(--radius-md);
  background: var(--surface-raised);
  box-shadow: var(--shadow-md);
  color: var(--danger);
  font-size: var(--text-sm);
}
</style>
