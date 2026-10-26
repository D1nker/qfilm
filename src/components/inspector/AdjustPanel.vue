<script setup lang="ts">
import { computed } from "vue";

import { controls, formatControlValue } from "@/lib/controls";
import { groupBy } from "@/lib/groupBy";
import { useEditor } from "@/composables/useEditor";
import { useLook } from "@/composables/useLook";
import UiButton from "@/components/ui/UiButton.vue";
import UiCollapsible from "@/components/ui/UiCollapsible.vue";
import UiSlider from "@/components/ui/UiSlider.vue";

const { image } = useEditor();
const { params, setParam, resetLook } = useLook();

const groupedControls = computed(() => groupBy(controls, (control) => control.group));
</script>

<template>
  <div>
    <div class="head">
      <p>Réglages</p>
      <UiButton variant="ghost" size="sm" @click="resetLook">Réinitialiser</UiButton>
    </div>

    <UiCollapsible v-for="[group, items] in groupedControls" :key="group" :title="group">
      <UiSlider
        v-for="control in items"
        :key="control.key"
        :model-value="params[control.key]"
        :label="control.label"
        :display="formatControlValue(control.key, params[control.key])"
        :min="control.min"
        :max="control.max"
        :step="control.step"
        :disabled="!image"
        @update:model-value="setParam(control.key, $event)"
      />
    </UiCollapsible>
  </div>
</template>

<style scoped>
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-3);
  font-weight: var(--weight-semibold);
}
</style>
