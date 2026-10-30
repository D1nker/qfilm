<template>
  <p v-if="current" class="look">
    <span class="label">{{ t("adjust.currentLook") }}</span>
    <span class="name">{{ localized(current.name) }}</span>
    <span class="amount">{{ Math.round(amount * 100) }} %</span>
  </p>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { localized, t } from "@/shared/i18n";
import { useEditor } from "@/features/photo";
import { useLook } from "@/features/looks/useLook";

/// Les retouches se posent sur un look : cette ligne dit lequel, et à quelle intensité.
const { groupedPresets } = useEditor();
const { activePreset, amount } = useLook();

const current = computed(() =>
  groupedPresets.value
    .flatMap((group) => group.items)
    .find((preset) => preset.id === activePreset.value),
);
</script>

<style scoped>
.look {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  margin: 0;
  padding: var(--space-1) var(--space-2) var(--space-3);
  font-size: var(--text-sm);
}

.label {
  color: var(--text-faint);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.name {
  min-width: 0;
  overflow: hidden;
  color: var(--text);
  font-weight: var(--weight-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.amount {
  margin-left: auto;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
</style>
