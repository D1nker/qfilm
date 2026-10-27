import type { Caption, FrameInfo, FrameSelection, ParamDef, ParamValue } from "@/shared/api/api";

export const NONE_FRAME = "none";

export type ParamValues = Record<string, ParamValue>;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function defaultParams(frame: FrameInfo): ParamValues {
  return Object.fromEntries(frame.params.map((def) => [def.id, def.default]));
}

/// Reflète la validation de Rust : type erroné, hors bornes, couleur mal formée ou choix inconnu
/// retombent sur la valeur par défaut.
export function coerce(def: ParamDef, value: ParamValue | undefined): ParamValue {
  if (value === undefined) return def.default;

  switch (def.type) {
    case "number":
      return typeof value === "number" && Number.isFinite(value)
        ? Math.min(Math.max(value, def.min), def.max)
        : def.default;
    case "color":
      return typeof value === "string" && HEX_COLOR.test(value) ? value.toLowerCase() : def.default;
    case "bool":
      return typeof value === "boolean" ? value : def.default;
    case "text":
      return typeof value === "string" ? [...value].slice(0, def.maxLength).join("") : def.default;
    case "choice":
      return typeof value === "string" && def.options.some((option) => option.id === value)
        ? value
        : def.default;
  }
}

export function optionSets(def: ParamDef, value: ParamValue | undefined): ParamValues {
  if (def.type !== "choice") return {};
  return def.options.find((option) => option.id === value)?.sets ?? {};
}

export function selectionFor(frame: FrameInfo, memory: ParamValues): FrameSelection {
  const params = defaultParams(frame);

  for (const def of frame.params) {
    if (def.persist && memory[def.id] !== undefined) {
      params[def.id] = coerce(def, memory[def.id]);
    }
  }
  for (const def of frame.params) {
    if (def.type === "choice") Object.assign(params, optionSets(def, params[def.id]));
  }

  return { id: frame.id, params };
}

export function isVisible(def: ParamDef, params: ParamValues): boolean {
  if (def.hidden) return false;

  const condition = def.visibleIf;
  if (!condition) return true;

  const value = params[condition.param];
  if (condition.equals !== undefined && value !== condition.equals) return false;
  if (condition.notEquals !== undefined && value === condition.notEquals) return false;
  return true;
}

export const DEFAULT_SECTION = "Réglages";

export function sectionsOf(frame: FrameInfo, params: ParamValues): [string, ParamDef[]][] {
  const sections = new Map<string, ParamDef[]>();
  for (const def of frame.params) {
    if (!isVisible(def, params)) continue;

    const title = def.section ?? DEFAULT_SECTION;
    sections.set(title, [...(sections.get(title) ?? []), def]);
  }
  return [...sections.entries()];
}

export function decimalsOf(step: number): number {
  const text = String(step);
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : text.length - dot - 1;
}

export function captionDefaultsOf(frame: FrameInfo): Partial<Caption> {
  return frame.captionDefaults;
}
