import type { Mask, MaskAdjust, MaskShape } from "@/shared/api/api";

/// Les formes des masques, en fonctions pures. Les coordonnées sont des fractions de la photo recadrée,
/// comme dans le moteur (`mask.rs`), dont la rotation et les unités du rayon sont reprises ici : voir le
/// commentaire de `MaskShape`.

export type MaskKind = MaskShape["kind"];
export type MaskAdjustKey = keyof MaskAdjust;
export interface Point {
  x: number;
  y: number;
}

/// Les dix réglages d'un masque : ceux de la lumière et de la couleur.
export const MASK_KEYS = [
  "exposure",
  "contrast",
  "highlights",
  "shadows",
  "whites",
  "blacks",
  "temperature",
  "tint",
  "saturation",
  "vibrance",
] as const satisfies readonly MaskAdjustKey[];

export const neutralAdjust = (): Required<MaskAdjust> => ({
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  temperature: 0,
  tint: 0,
  saturation: 0,
  vibrance: 0,
});

/// Un masque qui ne change rien (tous ses réglages au neutre) est ignoré par le moteur.
export const isIdle = (adjust: MaskAdjust) =>
  MASK_KEYS.every((key) => Math.abs(adjust[key]) <= 0.001);

/// Plus petit rayon d'une ellipse, en fraction de la largeur : au-dessous elle ne se saisit plus.
export const MIN_RADIUS = 0.02;
export const MAX_RADIUS = 1;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const clamp01 = (value: number) => clamp(value, 0, 1);
const tidy = (value: number) => Math.round(value * 10000) / 10000;

export function newMask(kind: MaskKind, id: string): Mask {
  const shape: MaskShape =
    kind === "linear"
      ? { kind, from: [0.5, 0.15], to: [0.5, 0.55] }
      : { kind, center: [0.5, 0.5], radius: [0.3, 0.2], angle: 0, feather: 0.5 };

  return { id, shape, invert: false, adjust: neutralAdjust() };
}

/// Une poignée du dégradé linéaire va où l'on veut, sans quitter la photo.
export function moveLinearHandle(
  shape: Extract<MaskShape, { kind: "linear" }>,
  handle: "from" | "to",
  point: Point,
): MaskShape {
  const next: [number, number] = [tidy(clamp01(point.x)), tidy(clamp01(point.y))];
  return { ...shape, [handle]: next };
}

/// Déplace tout le dégradé d'un bloc : il s'arrête quand l'une de ses poignées touche le bord.
export function moveLinear(
  shape: Extract<MaskShape, { kind: "linear" }>,
  dx: number,
  dy: number,
): MaskShape {
  const [fromX, fromY] = shape.from;
  const [toX, toY] = shape.to;
  const x = clamp(dx, -Math.min(fromX, toX), 1 - Math.max(fromX, toX));
  const y = clamp(dy, -Math.min(fromY, toY), 1 - Math.max(fromY, toY));

  return {
    ...shape,
    from: [tidy(fromX + x), tidy(fromY + y)],
    to: [tidy(toX + x), tidy(toY + y)],
  };
}

export function moveRadialCenter(
  shape: Extract<MaskShape, { kind: "radial" }>,
  point: Point,
): MaskShape {
  return { ...shape, center: [tidy(clamp01(point.x)), tidy(clamp01(point.y))] };
}

/// Les deux axes de l'ellipse tournée, en vecteurs unitaires dans l'espace de la largeur (x et y
/// mesurés tous deux en largeurs de photo) : le grand axe d'abord, puis le petit.
function axes(angle: number): [[number, number], [number, number]] {
  const radians = (angle * Math.PI) / 180;
  const [sin, cos] = [Math.sin(radians), Math.cos(radians)];
  return [
    [cos, sin],
    [-sin, cos],
  ];
}

/// Où sont les poignées d'un rayon, en fractions de la photo. `aspect` est hauteur / largeur : les
/// rayons se mesurent en largeurs, la verticale doit donc être ramenée à des hauteurs.
export function radialHandle(
  shape: Extract<MaskShape, { kind: "radial" }>,
  axis: 0 | 1,
  aspect: number,
): Point {
  const [ux, uy] = axes(shape.angle)[axis];
  const radius = shape.radius[axis];
  return {
    x: shape.center[0] + radius * ux,
    y: shape.center[1] + (radius * uy) / aspect,
  };
}

/// Tire la poignée d'un rayon jusqu'au pointeur : le rayon devient la distance, projetée sur l'axe.
export function setRadialRadius(
  shape: Extract<MaskShape, { kind: "radial" }>,
  axis: 0 | 1,
  point: Point,
  aspect: number,
): MaskShape {
  const [ux, uy] = axes(shape.angle)[axis];
  const dx = point.x - shape.center[0];
  const dy = (point.y - shape.center[1]) * aspect;
  const radius = tidy(clamp(dx * ux + dy * uy, MIN_RADIUS, MAX_RADIUS));

  const next: [number, number] = [...shape.radius];
  next[axis] = radius;
  return { ...shape, radius: next };
}

/// Un nom qui se lit (« Dégradé linéaire 2 ») : le rang parmi les masques de la même forme.
export function ordinalOf(masks: Mask[], mask: Mask): number {
  return masks.filter((entry) => entry.shape.kind === mask.shape.kind).indexOf(mask) + 1;
}
