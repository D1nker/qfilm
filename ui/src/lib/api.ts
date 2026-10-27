import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

export interface RenderParams {
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
  saturation: number;
  vibrance: number;
  temperature: number;
  tint: number;
  clarity: number;
  lift: number;
  halation: number;
  grain: number;
  grainSize: number;
  vignette: number;
}

export interface Preset {
  id: string;
  name: string;
  category: string;
  description: string;
  params: RenderParams;
}

export type FontChoice = "condensed" | "typewriter" | "handwritten";

export interface Caption {
  text: string;
  font: FontChoice;
  /// En % du petit côté de l'image finale.
  size: number;
  color: string;
  /// Centre de la légende en fractions de l'image ; `null` = position par défaut.
  x: number | null;
  y: number | null;
}

export type ParamValue = number | string | boolean;

export interface FrameSelection {
  id: string;
  params: Record<string, ParamValue>;
}

export interface ParamCondition {
  param: string;
  equals?: ParamValue;
  notEquals?: ParamValue;
}

export interface ChoiceOption {
  id: string;
  label: string;
  /// Valeurs que ce choix impose à d'autres réglages.
  sets: Record<string, ParamValue>;
}

interface ParamBase {
  id: string;
  label: string;
  section?: string;
  visibleIf?: ParamCondition;
  hidden?: boolean;
  /// Garde la valeur d'un cadre à l'autre.
  persist?: boolean;
  /// Reçoit le nom du look appliqué.
  fromLook?: boolean;
}

export type ParamDef = ParamBase &
  (
    | { type: "number"; min: number; max: number; step: number; unit: string; default: number }
    | { type: "color"; default: string }
    | { type: "bool"; default: boolean }
    | { type: "text"; default: string; maxLength: number }
    | { type: "choice"; default: string; options: ChoiceOption[]; display: "menu" | "list" }
  );

export interface FrameInfo {
  id: string;
  name: string;
  description: string;
  author: string;
  rotatePortrait: boolean;
  captionDefaults: Partial<Pick<Caption, "color" | "font" | "size">>;
  params: ParamDef[];
  builtin: boolean;
}

export interface FrameIssue {
  folder: string;
  message: string;
}

export interface FrameCatalog {
  frames: FrameInfo[];
  issues: FrameIssue[];
  directory: string;
}

export interface TextZone {
  /// L'identifiant du réglage texte que cette zone modifie.
  field: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PreviewResult {
  image: string;
  width: number;
  height: number;
  zones: TextZone[];
  captionCenter: [number, number];
}

export interface ImageMeta {
  id: string;
  fileName: string;
  width: number;
  height: number;
  preview: string;
}

export interface PresetThumbnail {
  id: string;
  image: string;
}

export type ExportFormat = "jpeg" | "png" | "tiff";

export interface ExportOptions {
  format: ExportFormat;
  /// 1..=100, ignoré hors JPEG.
  quality: number;
  /// Plus grand côté en pixels ; `null` = taille d'origine.
  maxEdge: number | null;
}

export const listPresets = () => invoke<Preset[]>("list_presets");

export const openImage = (path: string) => invoke<ImageMeta>("open_image", { path });

export const renderPreview = (id: string, params: RenderParams, frame: FrameSelection) =>
  invoke<PreviewResult>("render_preview", { id, params, frame });

export const closeImage = (id: string) => invoke<void>("close_image", { id });

export const presetThumbnails = (id: string) =>
  invoke<PresetThumbnail[]>("preset_thumbnails", { id });

export const frameThumbnails = (id: string, params: RenderParams, frames: FrameSelection[]) =>
  invoke<string[]>("frame_thumbnails", { id, params, frames });

export const exportImage = (
  id: string,
  params: RenderParams,
  frame: FrameSelection,
  caption: Caption,
  destination: string,
  options: ExportOptions,
) => invoke<void>("export_image", { id, params, frame, caption, destination, options });

export const listFrames = () => invoke<FrameCatalog>("list_frames");
export const reloadFrames = () => invoke<FrameCatalog>("reload_frames");
export const importFrame = (path: string) => invoke<FrameCatalog>("import_frame", { path });
export const removeFrame = (id: string) => invoke<FrameCatalog>("remove_frame", { id });
export const openFramesFolder = () => invoke<void>("open_frames_folder");

async function imageFilters() {
  const extensions = await invoke<string[]>("supported_extensions");
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
