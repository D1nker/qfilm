<template>
  <CollapsibleRoot v-model:open="open" class="group">
    <div class="bar">
      <CollapsibleTrigger class="head">
        <ChevronDown :size="12" class="chevron" />
        {{ title }}
        <span v-if="modified" class="modified" role="img" :aria-label="t('common.modified')" />
      </CollapsibleTrigger>
      <div class="actions">
        <slot name="actions" />
      </div>
    </div>
    <CollapsibleContent class="content">
      <slot />
    </CollapsibleContent>
  </CollapsibleRoot>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from "reka-ui";
import { ChevronDown } from "lucide-vue-next";

import { t } from "@/shared/i18n";
import { usePanelOpen } from "@/shared/lib/panelState";

const props = withDefaults(
  defineProps<{
    title: string;
    defaultOpen?: boolean;
    /** Avec un identifiant, l'état ouvert ou fermé est gardé d'une session à l'autre. */
    id?: string;
    /** Signale, en tête de section, qu'un réglage qu'elle contient a bougé. */
    modified?: boolean;
  }>(),
  { defaultOpen: true, id: undefined, modified: false },
);

// Lu une fois : l'identifiant d'une section ne change pas.
const open = props.id ? usePanelOpen(props.id, props.defaultOpen) : ref(props.defaultOpen);
</script>

<style scoped>
.group {
  --ring-room: 6px;
}

.group + .group {
  margin-top: var(--space-3);
}

.bar {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
}

.modified {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-full);
  background: var(--accent);
}

.head {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 6px;
  min-width: 0;
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
  /* Le rognage de l'animation couperait l'anneau de focus des contrôles collés au bord. */
  margin: calc(var(--ring-room) * -1);
  padding: var(--ring-room);
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
