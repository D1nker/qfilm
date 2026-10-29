/// Le nombre de décimales qu'un pas d'incrément affiche (0,01 → 2).
export function decimalsOf(step: number): number {
  const text = String(Number(step.toPrecision(6)));
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : text.length - dot - 1;
}

/// La valeur d'un curseur telle qu'on la saisit. `scale` convertit l'unité interne vers celle qui
/// est affichée (une intensité stockée de 0 à 1 s'affiche et se saisit de 0 à 100).
export function toEditText(value: number, step: number, scale = 1): string {
  return (value * scale).toFixed(decimalsOf(step * scale));
}

/// Ce que l'on a saisi, ramené dans l'unité interne et borné au curseur ; `null` si ce n'est pas un
/// nombre. La virgule décimale et un reste d'unité collé avec la valeur (« 15° », « 0,5 EV »)
/// sont acceptés.
export function fromEditText(text: string, min: number, max: number, scale = 1): number | null {
  const typed = Number.parseFloat(text.trim().replace(",", "."));
  if (!Number.isFinite(typed)) return null;

  return Math.min(Math.max(typed / scale, min), max);
}
