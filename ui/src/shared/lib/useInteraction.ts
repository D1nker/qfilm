import { ref } from "vue";

/// Vrai pendant qu'un geste continu (le déplacement d'un curseur) est en cours : l'aperçu se
/// contente alors d'un brouillon rapide, et le rendu complet suit au relâchement.
const dragging = ref(false);

let active = 0;

/// Marque le début d'un geste et rend la fonction qui le termine (sans effet si on l'appelle deux fois).
export function beginDrag(): () => void {
  active += 1;
  dragging.value = true;

  let ended = false;
  return () => {
    if (ended) return;

    ended = true;
    active = Math.max(0, active - 1);
    dragging.value = active > 0;
  };
}

export function useInteraction() {
  return { dragging };
}
