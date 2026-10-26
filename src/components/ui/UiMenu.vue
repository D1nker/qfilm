<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemIndicator,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "reka-ui";
import { Check } from "lucide-vue-next";

import type { MenuChoice, MenuEntry } from "@/components/ui/menu";

defineProps<{ entries: MenuEntry[] }>();

function choose(entry: MenuChoice, value: unknown) {
  if (typeof value === "string") entry.onChange(value);
}
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger as-child>
      <slot />
    </DropdownMenuTrigger>

    <DropdownMenuPortal>
      <DropdownMenuContent class="ui-menu-content" align="end" :side-offset="6">
        <template v-for="(entry, index) in entries" :key="index">
          <DropdownMenuSeparator v-if="entry.kind === 'separator'" class="ui-menu-separator" />

          <template v-else-if="entry.kind === 'choice'">
            <DropdownMenuLabel class="ui-menu-label">{{ entry.label }}</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              :model-value="entry.value"
              @update:model-value="choose(entry, $event)"
            >
              <DropdownMenuRadioItem
                v-for="option in entry.options"
                :key="option.value"
                :value="option.value"
                class="ui-menu-item"
              >
                <component :is="option.icon" v-if="option.icon" :size="14" class="ui-menu-icon" />
                <span class="ui-menu-text">{{ option.label }}</span>
                <DropdownMenuItemIndicator class="ui-menu-check">
                  <Check :size="14" />
                </DropdownMenuItemIndicator>
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </template>

          <DropdownMenuItem v-else class="ui-menu-item" @select="entry.onSelect()">
            <component :is="entry.icon" v-if="entry.icon" :size="14" class="ui-menu-icon" />
            <span class="ui-menu-text">{{ entry.label }}</span>
          </DropdownMenuItem>
        </template>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>

<!-- Le menu est téléporté dans <body> : les styles scoped ne l'atteignent pas. -->
<style>
.ui-menu-content {
  z-index: 100;
  min-width: 220px;
  padding: var(--space-1);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-raised);
  box-shadow: var(--shadow-md);
}

.ui-menu-label {
  padding: 6px var(--space-2) 2px;
  color: var(--text-faint);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  letter-spacing: 0.04em;
  text-transform: uppercase;
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

.ui-menu-check {
  color: var(--accent);
}

.ui-menu-separator {
  height: 1px;
  margin: var(--space-1) 0;
  background: var(--border);
}
</style>
