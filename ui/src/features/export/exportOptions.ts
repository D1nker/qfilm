import type { ExportFormat } from "@/shared/api/api";
import { t } from "@/shared/i18n";

export const formatOptions = (): { value: ExportFormat; label: string }[] => [
  { value: "jpeg", label: "JPEG" },
  { value: "png", label: "PNG" },
  { value: "tiff", label: t("export.tiff") },
];

export const FILE_EXTENSIONS: Record<ExportFormat, string> = {
  jpeg: "jpg",
  png: "png",
  tiff: "tiff",
};

export type ExportSize = "original" | "4096" | "2048" | "1080";

export const sizeOptions = (): { value: ExportSize; label: string }[] => [
  { value: "original", label: t("export.sizeOriginal") },
  { value: "4096", label: "4096 px" },
  { value: "2048", label: "2048 px" },
  { value: "1080", label: "1080 px" },
];

export const SIZE_EDGES: Record<ExportSize, number | null> = {
  original: null,
  "4096": 4096,
  "2048": 2048,
  "1080": 1080,
};
