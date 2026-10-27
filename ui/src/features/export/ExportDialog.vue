<template>
  <UiDialog
    v-model:open="exportOpen"
    size="md"
    title="Exporter"
    description="Choisis le format, la qualité et la taille de l'image exportée."
  >
    <UiField label="Format">
      <UiSelect v-model="format" :options="FORMAT_OPTIONS" />
    </UiField>

    <UiSlider
      v-if="format === 'jpeg'"
      v-model="quality"
      label="Qualité"
      :display="`${quality} %`"
      :min="60"
      :max="100"
      :step="1"
    />

    <UiField label="Taille">
      <UiSelect v-model="size" :options="SIZE_OPTIONS" />
    </UiField>

    <template #footer>
      <UiButton variant="ghost" @click="exportOpen = false">Annuler</UiButton>
      <UiButton variant="primary" :disabled="exporting" @click="saveExport">
        {{ exporting ? "Export…" : "Enregistrer…" }}
      </UiButton>
    </template>
  </UiDialog>
</template>

<script setup lang="ts">
import { FORMAT_OPTIONS, SIZE_OPTIONS } from "@/features/export/exportOptions";
import { useExport } from "@/features/export/useExport";
import UiButton from "@/shared/ui/UiButton.vue";
import UiDialog from "@/shared/ui/UiDialog.vue";
import UiField from "@/shared/ui/UiField.vue";
import UiSelect from "@/shared/ui/UiSelect.vue";
import UiSlider from "@/shared/ui/UiSlider.vue";

const { exportOpen, exporting, format, quality, size, saveExport } = useExport();
</script>
