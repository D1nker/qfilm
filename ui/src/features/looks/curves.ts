import type { RenderParams } from "@/shared/api/api";

/// Les courbes de tons : quatre listes de points [x, y] dans [0, 1] (valeurs encodées, comme à l'écran).
/// Une liste vide est la courbe neutre. Les helpers sont purs ; le moteur (`curve.rs`) fait foi pour
/// le rendu, et `evalCurve` n'en est que le miroir, pour dessiner la courbe.

export type CurvePoint = [number, number];
export type Curves = RenderParams["curves"];

export const CURVE_IDS = ["rgb", "red", "green", "blue"] as const;
export type CurveId = (typeof CURVE_IDS)[number];

/// Mêmes bornes que le moteur, qui les impose de toute façon.
export const MAX_POINTS = 16;
/// Plus large que l'écart minimal du moteur : deux points plus proches que cela ne se saisissent pas.
export const MIN_GAP = 0.02;

const DIAGONAL: CurvePoint[] = [
  [0, 0],
  [1, 1],
];

export const flatCurves = (): Curves => ({ rgb: [], red: [], green: [], blue: [] });

/// Les points à afficher et à modifier : la diagonale quand la courbe est neutre.
export const pointsOf = (curve: CurvePoint[]): CurvePoint[] =>
  (curve.length >= 2 ? curve : DIAGONAL).map(([x, y]) => [x, y]);

export const isFlat = (curve: CurvePoint[]) =>
  curve.length < 2 || curve.every(([x, y]) => Math.abs(x - y) < 1e-4);

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/// L'indice est toujours valide ici (les listes ont au moins deux points) : ces accès évitent seulement
/// de répandre des `!` pour `noUncheckedIndexedAccess`.
const pt = (points: CurvePoint[], i: number): CurvePoint => points[i] ?? [0, 0];
const nth = (values: number[], i: number) => values[i] ?? 0;
const tidy = (value: number) => Math.round(value * 10000) / 10000;

/// Déplace un point. Il reste entre ses voisins (l'ordre ne change jamais) ; les deux extrémités
/// ne glissent que verticalement.
export function movePoint(points: CurvePoint[], index: number, x: number, y: number): CurvePoint[] {
  const last = points.length - 1;
  const fixed = index === 0 || index === last;
  const nextX = fixed
    ? pt(points, index)[0]
    : clamp(x, pt(points, index - 1)[0] + MIN_GAP, pt(points, index + 1)[0] - MIN_GAP);

  return points.map((point, i): CurvePoint =>
    i === index ? [tidy(nextX), tidy(clamp(y, 0, 1))] : point,
  );
}

/// Insère un point, sauf si la courbe est pleine ou si l'endroit est trop près d'un autre.
export function addPoint(
  points: CurvePoint[],
  x: number,
  y: number,
): { points: CurvePoint[]; index: number } | null {
  if (points.length >= MAX_POINTS) return null;

  const index = points.findIndex(([px]) => px > x);
  if (index < 1) return null;
  if (x - pt(points, index - 1)[0] < MIN_GAP || pt(points, index)[0] - x < MIN_GAP) return null;

  const next = [...points];
  next.splice(index, 0, [tidy(x), tidy(clamp(y, 0, 1))]);
  return { points: next, index };
}

/// Les extrémités ne s'enlèvent pas.
export function removePoint(points: CurvePoint[], index: number): CurvePoint[] | null {
  if (index <= 0 || index >= points.length - 1) return null;
  return points.filter((_, i) => i !== index);
}

/// Un pas au clavier : les flèches déplacent le point, Maj pour un grand pas.
export function nudgePoint(
  points: CurvePoint[],
  index: number,
  key: string,
  fine: boolean,
): CurvePoint[] | null {
  const step = fine ? 0.01 : 0.05;
  const [x, y] = pt(points, index);

  switch (key) {
    case "ArrowRight":
      return movePoint(points, index, x + step, y);
    case "ArrowLeft":
      return movePoint(points, index, x - step, y);
    case "ArrowUp":
      return movePoint(points, index, x, y + step);
    case "ArrowDown":
      return movePoint(points, index, x, y - step);
    default:
      return null;
  }
}

/// La courbe passe par ses points sans jamais les dépasser (interpolation de Fritsch-Butland),
/// exactement comme dans le moteur : voir les valeurs de référence de `curves.test.ts`.
export function evalCurve(points: CurvePoint[], x: number): number {
  const n = points.length;
  if (n < 2) return clamp(x, 0, 1);

  const secants = points.slice(1).map(([px, py], i) => {
    const [x0, y0] = pt(points, i);
    return (py - y0) / (px - x0);
  });
  const slopes = points.map((_, k) => {
    if (k === 0) return nth(secants, 0);
    if (k === n - 1) return nth(secants, n - 2);

    const [before, after] = [nth(secants, k - 1), nth(secants, k)];
    if (before * after <= 0) return 0;

    const h0 = pt(points, k)[0] - pt(points, k - 1)[0];
    const h1 = pt(points, k + 1)[0] - pt(points, k)[0];
    const [w0, w1] = [2 * h1 + h0, h1 + 2 * h0];
    return (w0 + w1) / (w0 / before + w1 / after);
  });

  const at = clamp(x, 0, 1);
  const found = points.slice(1).findIndex(([px]) => at <= px);
  const k = found === -1 ? n - 2 : found;
  const [p0, p1] = [pt(points, k), pt(points, k + 1)];
  const h = p1[0] - p0[0];
  const t = (at - p0[0]) / h;
  const [t2, t3] = [t * t, t * t * t];

  return (
    (2 * t3 - 3 * t2 + 1) * p0[1] +
    (t3 - 2 * t2 + t) * h * nth(slopes, k) +
    (-2 * t3 + 3 * t2) * p1[1] +
    (t3 - t2) * h * nth(slopes, k + 1)
  );
}

/// Des points d'échantillonnage pour tracer la courbe, bornés à [0, 1] comme le moteur.
export function sampleCurve(points: CurvePoint[], steps = 48): CurvePoint[] {
  return Array.from({ length: steps + 1 }, (_, i): CurvePoint => {
    const x = i / steps;
    return [x, clamp(evalCurve(points, x), 0, 1)];
  });
}

/// L'intensité d'un preset ramène sa courbe vers la diagonale : à 0 elle est neutre, à 1 entière.
export function scaleCurve(curve: CurvePoint[], amount: number): CurvePoint[] {
  if (curve.length < 2) return [];
  return curve.map(([x, y]): CurvePoint => [x, tidy(x + (y - x) * amount)]);
}
