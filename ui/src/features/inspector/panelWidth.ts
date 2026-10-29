/// La largeur du panneau latéral : automatique (30 % de la fenêtre, entre deux bornes) tant que
/// l'utilisateur n'a pas tiré sur son bord, puis celle qu'il a choisie, bornée par la fenêtre.

export const MIN_WIDTH = 320;
export const MAX_WIDTH = 720;
/// Le canvas garde toujours au moins cela, pour que le panneau ne puisse pas le manger.
export const MIN_CANVAS = 440;
/// Le liseré entre la carte et le bord de la fenêtre (`--space-3`).
export const GUTTER = 12;

export const AUTO_WIDTH = "clamp(356px, 30vw, 520px)";

export const maxWidthFor = (viewport: number) =>
  Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, viewport - MIN_CANVAS - GUTTER));

export const clampWidth = (width: number, viewport: number) =>
  Math.round(Math.min(Math.max(width, MIN_WIDTH), maxWidthFor(viewport)));

/// La largeur que donne le pointeur : la carte va de lui jusqu'au liseré de droite.
export const widthFromPointer = (clientX: number, viewport: number) =>
  clampWidth(viewport - clientX - GUTTER, viewport);
