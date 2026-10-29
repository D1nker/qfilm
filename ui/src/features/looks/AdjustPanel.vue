<template>
  <div>
    <div class="head">
      <p>{{ t("tabs.adjust") }}</p>
      <UiButton variant="ghost" size="sm" @click="resetLook">
        {{ t("common.reset") }}
      </UiButton>
    </div>

    <UiCollapsible
      v-for="[group, items] in groupedControls"
      :key="group"
      :title="t(`adjust.groups.${group}`)"
    >
      <UiSlider
        v-for="control in items"
        :key="control.key"
        :model-value="params[control.key]"
        :label="t(`adjust.controls.${control.key}`)"
        :display="formatControlValue(control.key, params[control.key])"
        :min="control.min"
        :max="control.max"
        :step="control.step"
        :reset-to="NEUTRAL[control.key]"
        :disabled="!image"
        @update:model-value="setParam(control.key, $event)"
      />
    </UiCollapsible>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { t } from "@/shared/i18n";

import { controls, formatControlValue } from "@/features/looks/controls";
import { NEUTRAL } from "@/features/looks/neutral";
import { groupBy } from "@/shared/lib/groupBy";
import { useEditor } from "@/features/photo";
import { useLook } from "@/features/looks/useLook";
import UiButton from "@/shared/ui/UiButton.vue";
import UiCollapsible from "@/shared/ui/UiCollapsible.vue";
import UiSlider from "@/shared/ui/UiSlider.vue";

const { image } = useEditor();
const { params, setParam, resetLook } = useLook();

const groupedControls = computed(() => groupBy(controls, (control) => control.group));
</script>

<style scoped>
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-3);
  font-weight: var(--weight-semibold);
}
</style>
