import type { Preset } from "@/shared/api/api";
import { useLook } from "@/features/looks/useLook";

/// Un survol qui ne fait que passer (la souris traverse la grille) ne doit pas lancer un rendu.
export const ENTER_DELAY_MS = 120;
/// Passer d'une vignette à l'autre ne repasse pas par l'original : l'aperçu ne se retire qu'après ce délai.
export const LEAVE_DELAY_MS = 80;

/// Survoler un look l'essaie sur la photo, le quitter la rend telle qu'elle était.
export function usePresetPreview() {
  const { previewPreset } = useLook();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const later = (delay: number, preset: Preset | null) => {
    clearTimeout(timer);
    timer = setTimeout(() => previewPreset(preset), delay);
  };

  const enter = (preset: Preset) => later(ENTER_DELAY_MS, preset);
  const leave = () => later(LEAVE_DELAY_MS, null);

  /// Sans délai : un clic applique le look, un changement de page cache la vignette sans `pointerleave`,
  /// et le panneau qui disparaît ne doit rien laisser derrière lui.
  const stop = () => {
    clearTimeout(timer);
    previewPreset(null);
  };

  return { enter, leave, stop };
}
