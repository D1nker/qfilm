import { computed, reactive } from "vue";

/// Ouvert ou fermé, section par section, pour la session : la rampe d'icônes déplie une page d'un coup,
/// d'où un état partagé plutôt que propre à chaque section. Il n'est pas gardé d'une session à l'autre :
/// choisir une page sur la rampe déplie ses sections, un état mémorisé n'aurait jamais le temps de servir.
const state = reactive<Record<string, boolean>>({});

/// Déplie ces sections d'un coup, quoi qu'on ait choisi avant.
export function openPanels(ids: string[]) {
  for (const id of ids) state[id] = true;
}

/// Ouvert ou fermé, pour une section du panneau. `fallback` vaut tant que l'utilisateur n'a rien choisi.
export function usePanelOpen(id: string, fallback: boolean) {
  return computed({
    get: () => state[id] ?? fallback,
    set: (open: boolean) => {
      state[id] = open;
    },
  });
}
