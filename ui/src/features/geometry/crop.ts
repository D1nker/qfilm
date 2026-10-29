/// La géométrie du recadrage, en fonctions pures. Le cadre est un rectangle exprimé en fractions de la
/// toile (la photo après les quarts de tour) ; la photo, redressée, tourne dans cette toile, et le
/// cadre doit rester dans la partie qu'elle couvre : jamais de coin vide dans l'image finale.

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export const WHOLE: Rect = { x: 0, y: 0, width: 1, height: 1 };

/// Le plus petit côté d'un cadre, en fraction de la toile.
export const MIN_SIDE = 0.04;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const isWhole = (rect: Rect) =>
  rect.x < 1e-4 && rect.y < 1e-4 && rect.width > 1 - 1e-4 && rect.height > 1 - 1e-4;

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

const lerpRect = (from: Rect, to: Rect, t: number): Rect => ({
  x: lerp(from.x, to.x, t),
  y: lerp(from.y, to.y, t),
  width: lerp(from.width, to.width, t),
  height: lerp(from.height, to.height, t),
});

/// Le cadre est dans la toile et ne sort pas de la photo redressée. La rotation est la même que celle
/// du moteur : on cherche d'où vient chaque coin dans la photo, qui doit s'y trouver.
export function fits(rect: Rect, canvas: Size, angle: number): boolean {
  const tolerance = 1e-6;
  if (
    rect.x < -tolerance ||
    rect.y < -tolerance ||
    rect.x + rect.width > 1 + tolerance ||
    rect.y + rect.height > 1 + tolerance
  ) {
    return false;
  }

  const radians = (angle * Math.PI) / 180;
  const [sin, cos] = [Math.sin(radians), Math.cos(radians)];
  const [halfWidth, halfHeight] = [canvas.width / 2, canvas.height / 2];
  const slack = tolerance * Math.max(canvas.width, canvas.height);

  for (const fx of [rect.x, rect.x + rect.width]) {
    for (const fy of [rect.y, rect.y + rect.height]) {
      const dx = fx * canvas.width - halfWidth;
      const dy = fy * canvas.height - halfHeight;
      const sx = dx * cos + dy * sin;
      const sy = -dx * sin + dy * cos;
      if (Math.abs(sx) > halfWidth + slack || Math.abs(sy) > halfHeight + slack) return false;
    }
  }
  return true;
}

/// Va de `from` (un cadre valide) vers `to` aussi loin que `ok` le permet. L'ensemble des cadres
/// valides est convexe le long de ce trajet (les coins varient linéairement), donc une dichotomie suffit.
function furthest(from: Rect, to: Rect, ok: (rect: Rect) => boolean): Rect {
  if (ok(to)) return to;

  let [low, high] = [0, 1];
  for (let step = 0; step < 30; step++) {
    const middle = (low + high) / 2;
    if (ok(lerpRect(from, to, middle))) low = middle;
    else high = middle;
  }
  return lerpRect(from, to, low);
}

interface Context {
  canvas: Size;
  angle: number;
  /// Largeur / hauteur du cadre en pixels, ou `null` s'il est libre.
  ratio: number | null;
}

const around = (centerX: number, centerY: number, width: number, height: number): Rect => ({
  x: centerX - width / 2,
  y: centerY - height / 2,
  width,
  height,
});

/// Garde le rapport imposé en suivant le pointeur : le côté qui a le plus bougé décide.
function lockRatio(next: Rect, handle: Handle, previous: Rect, { canvas, ratio }: Context): Rect {
  if (ratio === null) return next;

  const widthPx = next.width * canvas.width;
  const heightPx = next.height * canvas.height;
  const isEdge = handle.length === 1;

  if (isEdge) {
    const centerX = previous.x + previous.width / 2;
    const centerY = previous.y + previous.height / 2;
    if (handle === "n" || handle === "s") {
      const room = 2 * Math.min(centerX, 1 - centerX);
      const width = Math.min((heightPx * ratio) / canvas.width, room);
      const height = (width * canvas.width) / ratio / canvas.height;
      const top = handle === "n" ? previous.y + previous.height - height : previous.y;
      return { ...around(centerX, 0, width, height), y: top };
    }

    const room = 2 * Math.min(centerY, 1 - centerY);
    const height = Math.min(widthPx / ratio / canvas.height, room);
    const width = (height * canvas.height * ratio) / canvas.width;
    const left = handle === "w" ? previous.x + previous.width - width : previous.x;
    return { ...around(0, centerY, width, height), x: left };
  }

  const anchorX = handle.includes("w") ? previous.x + previous.width : previous.x;
  const anchorY = handle.includes("n") ? previous.y + previous.height : previous.y;
  const roomX = handle.includes("w") ? anchorX : 1 - anchorX;
  const roomY = handle.includes("n") ? anchorY : 1 - anchorY;

  const grown = Math.max(widthPx, heightPx * ratio);
  let width = grown / canvas.width;
  let height = grown / ratio / canvas.height;
  const shrink = Math.min(1, roomX / width, roomY / height);
  width *= shrink;
  height *= shrink;

  return {
    x: handle.includes("w") ? anchorX - width : anchorX,
    y: handle.includes("n") ? anchorY - height : anchorY,
    width,
    height,
  };
}

/// Tire une poignée jusqu'au pointeur (en fraction de la toile), sans sortir de la photo.
export function resize(
  rect: Rect,
  handle: Handle,
  pointer: { x: number; y: number },
  context: Context,
): Rect {
  const [pointerX, pointerY] = [clamp(pointer.x, 0, 1), clamp(pointer.y, 0, 1)];
  let [left, right] = [rect.x, rect.x + rect.width];
  let [top, bottom] = [rect.y, rect.y + rect.height];

  if (handle.includes("w")) left = Math.min(pointerX, right - MIN_SIDE);
  if (handle.includes("e")) right = Math.max(pointerX, left + MIN_SIDE);
  if (handle.includes("n")) top = Math.min(pointerY, bottom - MIN_SIDE);
  if (handle.includes("s")) bottom = Math.max(pointerY, top + MIN_SIDE);

  const next = lockRatio(
    { x: left, y: top, width: right - left, height: bottom - top },
    handle,
    rect,
    context,
  );
  return furthest(rect, next, (candidate) => fits(candidate, context.canvas, context.angle));
}

/// Déplace le cadre de `dx`, `dy` (fractions de la toile) ; contre un bord de la photo il glisse.
export function move(rect: Rect, dx: number, dy: number, context: Context): Rect {
  const ok = (candidate: Rect) => fits(candidate, context.canvas, context.angle);

  const sideways = { ...rect, x: clamp(rect.x + dx, 0, 1 - rect.width) };
  const afterX = furthest(rect, sideways, ok);
  const vertical = { ...afterX, y: clamp(rect.y + dy, 0, 1 - rect.height) };
  return furthest(afterX, vertical, ok);
}

/// Rétrécit le cadre autour de son centre jusqu'à ce qu'il rentre : quand l'angle change, la photo
/// tourne sous le cadre et ses coins avancent. Si le centre lui-même sort, on le ramène vers le milieu.
export function fitInside(rect: Rect, canvas: Size, angle: number): Rect {
  const ok = (candidate: Rect) => fits(candidate, canvas, angle);
  if (ok(rect)) return rect;

  let [centerX, centerY] = [rect.x + rect.width / 2, rect.y + rect.height / 2];
  const scaled = (scale: number) =>
    around(centerX, centerY, rect.width * scale, rect.height * scale);

  for (let attempt = 0; attempt < 40 && !ok(scaled(1e-3)); attempt++) {
    centerX = lerp(centerX, 0.5, 0.5);
    centerY = lerp(centerY, 0.5, 0.5);
  }

  let [low, high] = [0, 1];
  for (let step = 0; step < 30; step++) {
    const middle = (low + high) / 2;
    if (ok(scaled(middle))) low = middle;
    else high = middle;
  }
  return scaled(low);
}

/// Le plus grand cadre de ce rapport (libre : la photo entière), centré sur `center`, qui rentre.
export function largestRect(
  ratio: number | null,
  center: { x: number; y: number },
  canvas: Size,
  angle: number,
): Rect {
  const ok = (candidate: Rect) => fits(candidate, canvas, angle);
  if (ratio === null) return fitInside(WHOLE, canvas, angle);

  // Un cadre du bon rapport dont la hauteur vaut `scale` fois celle de la toile.
  const shaped = (scale: number) =>
    around(center.x, center.y, (scale * canvas.height * ratio) / canvas.width, scale);

  let [low, high] = [0, 2];
  for (let step = 0; step < 40; step++) {
    const middle = (low + high) / 2;
    if (ok(shaped(middle))) low = middle;
    else high = middle;
  }
  return shaped(low);
}

/// Les quarts de tour et les miroirs emportent le cadre avec la photo.
export const rotateClockwise = ({ x, y, width, height }: Rect): Rect => ({
  x: 1 - y - height,
  y: x,
  width: height,
  height: width,
});

export const rotateCounterClockwise = ({ x, y, width, height }: Rect): Rect => ({
  x: y,
  y: 1 - x - width,
  width: height,
  height: width,
});

export const mirrorHorizontally = (rect: Rect): Rect => ({ ...rect, x: 1 - rect.x - rect.width });

export const mirrorVertically = (rect: Rect): Rect => ({ ...rect, y: 1 - rect.y - rect.height });

/// Les formats proposés, dans le sens paysage ; « original » prend celui de la photo, « libre » aucun.
export const ASPECTS = ["original", "free", "1:1", "5:4", "4:3", "3:2", "16:9", "2:1"] as const;

export type AspectId = (typeof ASPECTS)[number];

const FIXED: Record<string, number> = {
  "1:1": 1,
  "5:4": 5 / 4,
  "4:3": 4 / 3,
  "3:2": 3 / 2,
  "16:9": 16 / 9,
  "2:1": 2,
};

/// Largeur / hauteur du cadre pour un format, `portrait` le couchant sur la tranche.
export function aspectRatio(id: AspectId, canvas: Size, portrait: boolean): number | null {
  if (id === "free") return null;
  if (id === "original") return canvas.width / canvas.height;

  const landscape = FIXED[id] ?? 1;
  return portrait ? 1 / landscape : landscape;
}
