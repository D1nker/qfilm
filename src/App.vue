<script setup lang="ts">
import { onMounted } from "vue";
import { TooltipProvider } from "reka-ui";

import { useEditor } from "@/composables/useEditor";
import { useFrame } from "@/composables/useFrame";
import { useInspector } from "@/composables/useInspector";
import { useNotice } from "@/composables/useNotice";
import { useShortcuts } from "@/composables/useShortcuts";
import AppHeader from "@/components/AppHeader.vue";
import ImageViewport from "@/components/ImageViewport.vue";
import ExportDialog from "@/components/export/ExportDialog.vue";
import ShortcutsDialog from "@/components/ShortcutsDialog.vue";
import InspectorPanel from "@/components/inspector/InspectorPanel.vue";

const { error, init } = useEditor();
const { init: initFrames } = useFrame();
const { open } = useInspector();
const { notice } = useNotice();

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

    <div class="toasts">
      <p v-if="error" class="toast error" role="alert">{{ error }}</p>
      <p v-if="notice" class="toast" role="status">{{ notice }}</p>
    </div>

    <ExportDialog />
    <ShortcutsDialog />
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

/* En haut : le bas du canvas appartient à la barre d'outils flottante. */
.toasts {
  position: fixed;
  top: calc(52px + var(--space-3));
  left: 50%;
  z-index: 200;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  align-items: center;
  max-width: min(560px, calc(100vw - 32px));
  transform: translateX(-50%);
  pointer-events: none;
}

.toast {
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  background: var(--surface-raised);
  box-shadow: var(--shadow-md);
  font-size: var(--text-sm);
}

.toast.error {
  border-color: var(--danger);
  color: var(--danger);
}
</style>
