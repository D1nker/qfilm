<template>
  <TooltipRoot :open="tooltipOpen" @update:open="tooltipOpen = $event && !open">
    <TooltipTrigger as-child>
      <span class="ui-popover-trigger">
        <PopoverRoot v-model:open="open">
          <PopoverTrigger as-child>
            <slot name="trigger" />
          </PopoverTrigger>

          <PopoverPortal>
            <PopoverContent
              ref="content"
              class="ui-popover-content"
              :side="side"
              :align="align"
              :side-offset="8"
              @open-auto-focus="focusContent"
            >
              <slot />
            </PopoverContent>
          </PopoverPortal>
        </PopoverRoot>
      </span>
    </TooltipTrigger>

    <TooltipPortal v-if="tooltip">
      <TooltipContent class="ui-tooltip" :side="side" :side-offset="6">
        {{ tooltip }}
      </TooltipContent>
    </TooltipPortal>
  </TooltipRoot>
</template>

<script setup lang="ts">
import {
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger,
  TooltipContent,
  TooltipPortal,
  TooltipRoot,
  TooltipTrigger,
} from "reka-ui";
import { ref, watch, type ComponentPublicInstance } from "vue";

withDefaults(
  defineProps<{ tooltip?: string; side?: "top" | "bottom"; align?: "start" | "end" }>(),
  { tooltip: undefined, side: "top", align: "start" },
);

// Comme pour UiMenu : le survol ouvre l'infobulle après un délai, et le popover doit rester seul
// à l'écran. Le popover reste hors de TooltipRoot, sinon son déclencheur s'ancre sur l'infobulle.
const open = ref(false);
const tooltipOpen = ref(false);
const content = ref<ComponentPublicInstance | null>(null);

watch(open, (isOpen) => {
  if (isOpen) tooltipOpen.value = false;
});

// Le focus initial va au popover, pas à son premier contrôle : celui-ci afficherait aussitôt son
// infobulle, et cette infobulle avalerait le premier appui sur Échap.
function focusContent(event: Event) {
  event.preventDefault();
  content.value?.$el.focus();
}
</script>

<style>
.ui-popover-trigger {
  display: inline-flex;
}

.ui-popover-content {
  z-index: 100;
  padding: var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface-raised);
  box-shadow: var(--shadow-md);
}

.ui-popover-content:focus-visible {
  outline: none;
}
</style>
