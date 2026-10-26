<script setup lang="ts">
import { TooltipContent, TooltipPortal, TooltipRoot, TooltipTrigger } from "reka-ui";

withDefaults(defineProps<{ text: string; side?: "top" | "right" | "bottom" | "left" }>(), {
  side: "bottom",
});
</script>

<template>
  <TooltipRoot>
    <TooltipTrigger as-child>
      <slot />
    </TooltipTrigger>
    <TooltipPortal>
      <TooltipContent class="ui-tooltip" :side="side" :side-offset="6">
        {{ text }}
      </TooltipContent>
    </TooltipPortal>
  </TooltipRoot>
</template>

<!-- Le contenu est téléporté dans <body> : les styles scoped ne l'atteignent pas. -->
<style>
.ui-tooltip {
  z-index: 100;
  max-width: 260px;
  padding: 5px var(--space-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-raised);
  box-shadow: var(--shadow-md);
  color: var(--text);
  font-size: var(--text-xs);
  line-height: 1.4;
}
</style>
