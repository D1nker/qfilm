import { t } from "@/shared/i18n";
import { ref } from "vue";

import { exportImage, pickDestination, type ExportFormat } from "@/shared/api/api";
import { FILE_EXTENSIONS, SIZE_EDGES, type ExportSize } from "@/features/export/exportOptions";
import { useEditor } from "@/features/photo";
import { useNotice } from "@/shared/lib/useNotice";
import { useFrame } from "@/features/frames";
import { useLook } from "@/features/looks";

const { image, error } = useEditor();
const { show } = useNotice();
const { params, activePreset } = useLook();
const { frame, caption } = useFrame();

const exportOpen = ref(false);
const exporting = ref(false);
const format = ref<ExportFormat>("jpeg");
const quality = ref(92);
const size = ref<ExportSize>("original");
const keepMetadata = ref(true);

function openExport() {
  if (image.value) exportOpen.value = true;
}

async function saveExport() {
  const current = image.value;
  if (!current) return;

  const base = current.fileName.replace(/\.[^.]+$/, "");
  const name = `${base}-${activePreset.value}.${FILE_EXTENSIONS[format.value]}`;
  const destination = await pickDestination(name, format.value);
  if (!destination) return;

  exporting.value = true;
  error.value = "";
  try {
    await exportImage(
      current.id,
      { ...params.value },
      { id: frame.id, params: { ...frame.params } },
      { ...caption },
      destination,
      {
        format: format.value,
        quality: quality.value,
        maxEdge: SIZE_EDGES[size.value],
        keepMetadata: keepMetadata.value,
      },
    );
    show(t("export.done"));
    exportOpen.value = false;
  } catch (e) {
    error.value = String(e);
  } finally {
    exporting.value = false;
  }
}

export function useExport() {
  return { exportOpen, exporting, format, quality, size, keepMetadata, openExport, saveExport };
}
