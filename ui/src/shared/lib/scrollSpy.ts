/// Quelle section est « en cours » dans un panneau qui défile : la dernière dont le haut a dépassé le
/// repère (`offset`, mesuré depuis le haut du panneau). Tout en bas, la dernière l'emporte même si sa
/// tête n'a pas atteint le repère, sinon une section courte ne serait jamais celle de la fin.
/// `tops` : le haut de chaque section par rapport à celui du panneau, `null` si elle est absente.
export function activeSection(tops: (number | null)[], offset: number, atEnd: boolean): number {
  const present = tops.flatMap((top, index) => (top === null ? [] : [index]));
  const last = present.at(-1);
  if (last === undefined) return -1;
  if (atEnd) return last;

  const reached = present.filter((index) => (tops[index] ?? Infinity) <= offset);
  return reached.at(-1) ?? present[0] ?? -1;
}

/// Le plus proche ancêtre qui défile, ou `null`.
export function scrollParent(element: HTMLElement | null): HTMLElement | null {
  for (let node = element?.parentElement ?? null; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === "auto" || overflowY === "scroll") return node;
  }
  return null;
}
