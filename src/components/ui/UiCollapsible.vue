<script setup lang="ts">
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from "reka-ui";
import { ChevronDown } from "lucide-vue-next";

withDefaults(defineProps<{ title: string; defaultOpen?: boolean }>(), { defaultOpen: true });
</script>

<template>
  <CollapsibleRoot class="group" :default-open="defaultOpen">
    <CollapsibleTrigger class="head">
      <ChevronDown :size="12" class="chevron" />
      {{ title }}
    </CollapsibleTrigger>
    <CollapsibleContent class="content">
      <slot />
    </CollapsibleContent>
  </CollapsibleRoot>
</template>

<style scoped>
.group + .group {
  margin-top: var(--space-3);
}

.head {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: var(--space-1) var(--space-2);
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-faint);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
  transition: color var(--duration-fast) var(--ease);
}

.head:hover {
  color: var(--text-muted);
}

.head:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.chevron {
  transition: transform var(--duration) var(--ease);
}

.head[data-state="closed"] .chevron {
  transform: rotate(-90deg);
}

.content {
  overflow: hidden;
}

.content[data-state="open"] {
  animation: slide-down var(--duration) var(--ease);
}

.content[data-state="closed"] {
  animation: slide-up var(--duration) var(--ease);
}

@keyframes slide-down {
  from {
    height: 0;
  }
  to {
    height: var(--reka-collapsible-content-height);
  }
}

@keyframes slide-up {
  from {
    height: var(--reka-collapsible-content-height);
  }
  to {
    height: 0;
  }
}
</style>
