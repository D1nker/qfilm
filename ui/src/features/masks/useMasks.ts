import { computed, ref } from "vue";

import type { Mask, MaskShape } from "@/shared/api/api";
import { useInspector } from "@/features/inspector";
import { isIdle, newMask, type MaskAdjustKey, type MaskKind } from "@/features/masks/maskShapes";

/// La page des masques dans le panneau de retouche : tant qu'elle est affichée, la photo se montre nue
/// (sans cadre) pour y poser les poignées, comme pendant le recadrage.
export const MASKS_PAGE = "masks";

const { tab, group } = useInspector();

/// Les masques d'une photo, de l'état d'édition au même titre que les curseurs : annuler les rejoue.
/// Ils ne font pas partie du look (un preset n'y touche pas) et sont rendus après le recadrage.
/// Des données simples : un aller-retour JSON les copie, là où `structuredClone` refuse les proxys de Vue.
const copy = (mask: Mask): Mask => JSON.parse(JSON.stringify(mask)) as Mask;

const masks = ref<Mask[]>([]);
const selectedId = ref<string | null>(null);

const selected = computed(() => masks.value.find((mask) => mask.id === selectedId.value) ?? null);

/// Vrai pendant que la page des masques est affichée.
const editing = computed(() => tab.value === "adjust" && group.adjust === MASKS_PAGE);

/// Au moins un masque qui change quelque chose.
const active = computed(() => masks.value.some((mask) => !isIdle(mask.adjust)));

/// Ce qu'on envoie au moteur : des copies simples, et seulement les masques qui changent quelque chose
/// (ajouter un masque neutre ou déplacer ses poignées ne relance donc aucun rendu).
const forRender = computed(() => masks.value.filter((mask) => !isIdle(mask.adjust)).map(copy));

/// Le même contenu en texte : un observateur qui s'y abonne ne se réveille que si le contenu change, là où
/// le tableau ci-dessus est un objet neuf à chaque recalcul, même identique.
const renderKey = computed(() => JSON.stringify(forRender.value));

let counter = 0;
const nextId = () => `mask-${Date.now().toString(36)}-${counter++}`;

function add(kind: MaskKind) {
  const mask = newMask(kind, nextId());
  masks.value = [...masks.value, mask];
  selectedId.value = mask.id;
}

function remove(id: string) {
  const index = masks.value.findIndex((mask) => mask.id === id);
  if (index === -1) return;

  masks.value = masks.value.filter((mask) => mask.id !== id);
  if (selectedId.value === id) {
    // Le voisin prend la place : on enchaîne les suppressions sans repartir de zéro.
    selectedId.value = (masks.value[index] ?? masks.value[index - 1])?.id ?? null;
  }
}

function select(id: string) {
  if (masks.value.some((mask) => mask.id === id)) selectedId.value = id;
}

/// Remplace un masque par sa version modifiée : de nouveaux objets, que les observateurs voient.
function update(id: string, change: (mask: Mask) => Mask) {
  masks.value = masks.value.map((mask) => (mask.id === id ? change(mask) : mask));
}

function setShape(id: string, shape: MaskShape) {
  update(id, (mask) => ({ ...mask, shape }));
}

function setAdjust(id: string, key: MaskAdjustKey, value: number) {
  update(id, (mask) => ({ ...mask, adjust: { ...mask.adjust, [key]: value } }));
}

function setInvert(id: string, invert: boolean) {
  update(id, (mask) => ({ ...mask, invert }));
}

function reset() {
  masks.value = [];
  selectedId.value = null;
}

/// Les masques seuls : choisir lequel on regarde n'est pas une retouche, cliquer sur l'un d'eux ne doit
/// pas devenir une étape à annuler.
export interface MasksSnapshot {
  masks: Mask[];
}

function snapshot(): MasksSnapshot {
  return { masks: masks.value.map(copy) };
}

function restore(state: MasksSnapshot) {
  masks.value = state.masks.map(copy);
  // Annuler la suppression du masque choisi, ou celle d'un autre : la sélection garde un masque qui existe.
  if (!masks.value.some((mask) => mask.id === selectedId.value)) {
    selectedId.value = masks.value.at(-1)?.id ?? null;
  }
}

export function useMasks() {
  return {
    masks,
    selected,
    selectedId,
    editing,
    active,
    forRender,
    renderKey,
    add,
    remove,
    select,
    setShape,
    setAdjust,
    setInvert,
    reset,
    snapshot,
    restore,
  };
}
