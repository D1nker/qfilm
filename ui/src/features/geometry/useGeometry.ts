import { computed, reactive, ref, watch } from "vue";

import type { Geometry } from "@/shared/api/api";
import {
  WHOLE,
  aspectRatio,
  fitInside,
  largestRect,
  mirrorHorizontally,
  mirrorVertically,
  rotateClockwise,
  rotateCounterClockwise,
  type AspectId,
  type Rect,
} from "@/features/geometry/crop";
import { useEditor } from "@/features/photo";
import { useInspector } from "@/features/inspector";

/// Redressement maximal, comme dans le moteur.
export const MAX_ANGLE = 45;

const { image } = useEditor();
const { tab } = useInspector();

const quarterTurns = ref(0);
const flipHorizontal = ref(false);
const flipVertical = ref(false);
const angle = ref(0);
const crop = reactive<Rect>({ ...WHOLE });
const aspect = ref<AspectId>("free");
/// Un format fixe se couche sur la tranche (3:2 devient 2:3).
const portrait = ref(false);
/// Vrai pendant que l'on règle le cadre sur la photo entière : l'aperçu est alors la toile redressée,
/// sans cadre autour, avec la grille de recadrage par-dessus.
const cropping = ref(false);

/// La toile : la photo après les quarts de tour.
const canvas = computed(() => {
  const size = { width: image.value?.width ?? 1, height: image.value?.height ?? 1 };
  return quarterTurns.value % 2 === 1 ? { width: size.height, height: size.width } : size;
});

const ratio = computed(() => aspectRatio(aspect.value, canvas.value, portrait.value));

const context = computed(() => ({ canvas: canvas.value, angle: angle.value, ratio: ratio.value }));

const base = () => ({
  quarterTurns: quarterTurns.value,
  flipHorizontal: flipHorizontal.value,
  flipVertical: flipVertical.value,
  angle: angle.value,
});

/// La géométrie telle qu'elle sera exportée.
const geometry = computed<Geometry>(() => ({ ...base(), crop: { ...crop } }));

/// Celle de l'aperçu : pendant le réglage du cadre, la photo entière.
const previewGeometry = computed<Geometry>(() => ({
  ...base(),
  crop: cropping.value ? { ...WHOLE } : { ...crop },
}));

const modified = computed(
  () =>
    quarterTurns.value !== 0 ||
    flipHorizontal.value ||
    flipVertical.value ||
    Math.abs(angle.value) > 1e-4 ||
    crop.x > 1e-4 ||
    crop.y > 1e-4 ||
    crop.width < 1 - 1e-4 ||
    crop.height < 1 - 1e-4,
);

const center = () => ({ x: crop.x + crop.width / 2, y: crop.y + crop.height / 2 });

function setCrop(rect: Rect) {
  Object.assign(crop, rect);
}

/// Toucher à un réglage de géométrie passe en mode recadrage : on les règle sur la photo entière.
const edit = () => {
  cropping.value = true;
};

function rotate(clockwise: boolean) {
  edit();
  quarterTurns.value = (quarterTurns.value + (clockwise ? 1 : 3)) % 4;
  setCrop(clockwise ? rotateClockwise(crop) : rotateCounterClockwise(crop));
  portrait.value = !portrait.value;
}

/// Un miroir à l'écran : après un quart de tour, l'axe de la photo d'origine n'est plus le même.
function flip(axis: "horizontal" | "vertical") {
  edit();
  const sideways = quarterTurns.value % 2 === 1;
  const onSourceHorizontal = (axis === "horizontal") !== sideways;

  if (onSourceHorizontal) flipHorizontal.value = !flipHorizontal.value;
  else flipVertical.value = !flipVertical.value;

  setCrop(axis === "horizontal" ? mirrorHorizontally(crop) : mirrorVertically(crop));
  // Une photo retournée penche dans l'autre sens.
  angle.value = -angle.value;
}

function setAngle(value: number) {
  edit();
  angle.value = Math.min(Math.max(value, -MAX_ANGLE), MAX_ANGLE);
  setCrop(fitInside(crop, canvas.value, angle.value));
}

function setAspect(id: AspectId) {
  edit();
  aspect.value = id;
  if (id === "free") return;

  portrait.value =
    id !== "original" && crop.width * canvas.value.width < crop.height * canvas.value.height;
  setCrop(largestRect(ratio.value, center(), canvas.value, angle.value));
}

/// Couche ou redresse le cadre (3:2 devient 2:3), en gardant son centre.
function swapOrientation() {
  edit();
  if (aspect.value !== "free") {
    if (aspect.value === "original") return;

    portrait.value = !portrait.value;
    setCrop(largestRect(ratio.value, center(), canvas.value, angle.value));
    return;
  }

  const { x, y } = center();
  const width = (crop.height * canvas.value.height) / canvas.value.width;
  const height = (crop.width * canvas.value.width) / canvas.value.height;
  setCrop(
    fitInside({ x: x - width / 2, y: y - height / 2, width, height }, canvas.value, angle.value),
  );
}

function reset() {
  quarterTurns.value = 0;
  flipHorizontal.value = false;
  flipVertical.value = false;
  angle.value = 0;
  setCrop(WHOLE);
  aspect.value = "free";
  portrait.value = false;
}

export interface GeometrySnapshot {
  quarterTurns: number;
  flipHorizontal: boolean;
  flipVertical: boolean;
  angle: number;
  crop: Rect;
  aspect: AspectId;
  portrait: boolean;
}

function snapshot(): GeometrySnapshot {
  return {
    quarterTurns: quarterTurns.value,
    flipHorizontal: flipHorizontal.value,
    flipVertical: flipVertical.value,
    angle: angle.value,
    crop: { ...crop },
    aspect: aspect.value,
    portrait: portrait.value,
  };
}

function restore(state: GeometrySnapshot) {
  quarterTurns.value = state.quarterTurns;
  flipHorizontal.value = state.flipHorizontal;
  flipVertical.value = state.flipVertical;
  angle.value = state.angle;
  setCrop(state.crop);
  aspect.value = state.aspect;
  portrait.value = state.portrait;
}

// Une autre photo repart d'un cadrage vierge.
watch(
  () => image.value?.id,
  () => {
    reset();
    cropping.value = false;
  },
);

// Le recadrage est un mode de l'onglet Cadre : en sortir le termine.
watch(tab, (current) => {
  if (current !== "frame") cropping.value = false;
});

export function useGeometry() {
  return {
    cropping,
    quarterTurns,
    angle,
    crop,
    aspect,
    ratio,
    portrait,
    canvas,
    context,
    geometry,
    previewGeometry,
    modified,
    setCrop,
    rotate,
    flip,
    setAngle,
    setAspect,
    swapOrientation,
    reset,
    snapshot,
    restore,
    startCropping: edit,
    stopCropping: () => {
      cropping.value = false;
    },
    toggleCropping: () => {
      cropping.value = !cropping.value;
    },
  };
}
