import { open, save } from "@tauri-apps/plugin-dialog";

import { commands } from "@/shared/api/bindings";
import type { ExportFormat } from "@/shared/api/bindings";

export type {
  ExportFormat,
  FontChoice,
  ImageMeta,
  ParamValue,
  PresetThumbnail,
  PreviewResult,
  TextZone,
} from "@/shared/api/bindings";
export type {
  Caption_Serialize as Caption,
  ChoiceOption_Serialize as ChoiceOption,
  Condition_Serialize as ParamCondition,
  ExportOptions_Serialize as ExportOptions,
  FrameCatalog_Serialize as FrameCatalog,
  FrameInfo_Serialize as FrameInfo,
  FrameSelection_Serialize as FrameSelection,
  LoadIssue as FrameIssue,
  ParamDef_Serialize as ParamDef,
  Preset_Serialize as Preset,
  RenderParams_Serialize as RenderParams,
} from "@/shared/api/bindings";

export const {
  listPresets,
  openImage,
  renderPreview,
  closeImage,
  presetThumbnails,
  frameThumbnails,
  exportImage,
  listFrames,
  reloadFrames,
  importFrame,
  removeFrame,
  openFramesFolder,
} = commands;

async function imageFilters() {
  const extensions = await commands.supportedExtensions();
  return [{ name: "Images", extensions }];
}

export async function pickImage(): Promise<string | null> {
  const selected = await open({ multiple: false, filters: await imageFilters() });
  return typeof selected === "string" ? selected : null;
}

const EXPORT_FILTERS: Record<ExportFormat, { name: string; extensions: string[] }> = {
  jpeg: { name: "JPEG", extensions: ["jpg"] },
  png: { name: "PNG", extensions: ["png"] },
  tiff: { name: "TIFF 16 bits", extensions: ["tiff"] },
};

export function pickDestination(suggestedName: string, format: ExportFormat) {
  return save({ defaultPath: suggestedName, filters: [EXPORT_FILTERS[format]] });
}

export async function pickFrameArchive(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    filters: [{ name: "Cadre (.zip)", extensions: ["zip"] }],
  });
  return typeof selected === "string" ? selected : null;
}

export async function pickFrameFolder(): Promise<string | null> {
  const selected = await open({ multiple: false, directory: true });
  return typeof selected === "string" ? selected : null;
}
