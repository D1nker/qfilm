<template>
  <TooltipRoot :open="tooltipOpen" @update:open="tooltipOpen = $event && !menuOpen">
    <TooltipTrigger as-child>
      <span class="ui-menu-trigger">
        <DropdownMenuRoot v-model:open="menuOpen">
          <DropdownMenuTrigger as-child>
            <slot />
          </DropdownMenuTrigger>

          <DropdownMenuPortal>
            <DropdownMenuContent class="ui-menu-content" :align="align" :side-offset="6">
              <template v-for="(entry, index) in entries" :key="index">
                <DropdownMenuSeparator
                  v-if="entry.kind === 'separator'"
                  class="ui-menu-separator"
                />
                <DropdownMenuItem v-else class="ui-menu-item" @select="entry.onSelect()">
                  <component :is="entry.icon" v-if="entry.icon" :size="14" class="ui-menu-icon" />
                  <span class="ui-menu-text">{{ entry.label }}</span>
                </DropdownMenuItem>
              </template>
            </DropdownMenuContent>
          </DropdownMenuPortal>
        </DropdownMenuRoot>
      </span>
    </TooltipTrigger>

    <TooltipPortal v-if="tooltip">
      <TooltipContent class="ui-tooltip" side="bottom" :side-offset="6">
        {{ tooltip }}
      </TooltipContent>
    </TooltipPortal>
  </TooltipRoot>
</template>

<script setup lang="ts">
import {
  TooltipContent,
  TooltipPortal,
  TooltipRoot,
  TooltipTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "reka-ui";
import { ref, watch } from "vue";

import type { MenuEntry } from "@/shared/ui/menu";

withDefaults(defineProps<{ entries: MenuEntry[]; tooltip?: string; align?: "start" | "end" }>(), {
  tooltip: undefined,
  align: "end",
});

// Le survol ouvre l'infobulle après un délai : si le menu s'est ouvert entre-temps, elle
// viendrait se poser sur ses entrées.
const menuOpen = ref(false);
const tooltipOpen = ref(false);

watch(menuOpen, (open) => {
  if (open) tooltipOpen.value = false;
});
</script>

<style>
.ui-menu-trigger {
  display: inline-flex;
}

.ui-menu-content {
  z-index: 100;
  min-width: 220px;
  padding: var(--space-1);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-raised);
  box-shadow: var(--shadow-md);
}

.ui-menu-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 6px var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  cursor: pointer;
  outline: none;
}

.ui-menu-item[data-highlighted] {
  background: var(--surface-hover);
}

.ui-menu-icon {
  color: var(--text-muted);
}

.ui-menu-text {
  flex: 1;
}

.ui-menu-separator {
  height: 1px;
  margin: var(--space-1) 0;
  background: var(--border);
}
</style>
