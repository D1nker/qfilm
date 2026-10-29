/// La géométrie de la roue d'étalonnage. La teinte est l'angle, en degrés dans le sens horaire à
/// partir du haut (comme un `conic-gradient`) ; la saturation est la distance au centre, de 0 au
/// bord. Les points vont de -1 à 1, l'axe vertical vers le bas, comme à l'écran.

export interface WheelPoint {
  x: number;
  y: number;
}

export interface HueSaturation {
  hue: number;
  saturation: number;
}

export function pointFor({ hue, saturation }: HueSaturation): WheelPoint {
  const angle = (hue * Math.PI) / 180;
  return { x: Math.sin(angle) * saturation, y: -Math.cos(angle) * saturation };
}

export function fromPoint({ x, y }: WheelPoint): HueSaturation {
  const saturation = Math.min(1, Math.hypot(x, y));
  const degrees = (Math.atan2(x, -y) * 180) / Math.PI;
  return { hue: (degrees + 360) % 360, saturation };
}

/// Autour du centre, la teinte n'a plus de sens : on garde celle qu'on avait. Le rayon est assez
/// grand (environ 7 px) pour que l'imprécision du pointeur, à un pixel près, ne fasse pas sauter la
/// teinte quand on ramène la pastille vers le milieu.
export const HUE_DEAD_ZONE = 0.08;

export function moveTo(point: WheelPoint, current: HueSaturation): HueSaturation {
  const next = fromPoint(point);
  return next.saturation < HUE_DEAD_ZONE ? { hue: current.hue, saturation: next.saturation } : next;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/// Un pas au clavier : gauche/droite tournent la teinte, haut/bas règlent la saturation.
export function nudge(current: HueSaturation, key: string, fine: boolean): HueSaturation | null {
  const hueStep = fine ? 1 : 10;
  const saturationStep = fine ? 0.01 : 0.1;

  switch (key) {
    case "ArrowRight":
      return { ...current, hue: (current.hue + hueStep + 360) % 360 };
    case "ArrowLeft":
      return { ...current, hue: (current.hue - hueStep + 360) % 360 };
    case "ArrowUp":
      return { ...current, saturation: clamp(current.saturation + saturationStep, 0, 1) };
    case "ArrowDown":
      return { ...current, saturation: clamp(current.saturation - saturationStep, 0, 1) };
    default:
      return null;
  }
}
