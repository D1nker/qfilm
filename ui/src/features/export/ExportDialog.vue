<template>
  <UiDialog
    v-model:open="exportOpen"
    size="md"
    :title="t('export.title')"
    :description="t('export.description')"
  >
    <UiField :label="t('export.format')">
      <UiSelect v-model="format" :options="formatOptions()" />
    </UiField>

    <UiSlider
      v-if="format === 'jpeg'"
      v-model="quality"
      :label="t('export.quality')"
      :display="`${quality} %`"
      :min="60"
      :max="100"
      :step="1"
    />

    <UiField :label="t('export.size')">
      <UiSelect v-model="size" :options="sizeOptions()" />
    </UiField>

    <template #footer>
      <UiButton variant="ghost" @click="exportOpen = false">
        {{ t("common.cancel") }}
      </UiButton>
      <UiButton variant="primary" :disabled="exporting" @click="saveExport">
        {{ exporting ? t("export.saving") : t("export.save") }}
      </UiButton>
    </template>
  </UiDialog>
</template>

<script setup lang="ts">
import { t } from "@/shared/i18n";
import { formatOptions, sizeOptions } from "@/features/export/exportOptions";
import { useExport } from "@/features/export/useExport";
import UiButton from "@/shared/ui/UiButton.vue";
import UiDialog from "@/shared/ui/UiDialog.vue";
import UiField from "@/shared/ui/UiField.vue";
import UiSelect from "@/shared/ui/UiSelect.vue";
import UiSlider from "@/shared/ui/UiSlider.vue";

const { exportOpen, exporting, format, quality, size, saveExport } = useExport();
</script>
