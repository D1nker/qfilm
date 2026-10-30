import { computed, ref, watch } from "vue";

import { useEditor } from "@/features/photo";
import { useFrame, type FrameSnapshot } from "@/features/frames";
import { useGeometry, type GeometrySnapshot } from "@/features/geometry";
import { useLook, type LookSnapshot } from "@/features/looks";
import { useMasks, type MasksSnapshot } from "@/features/masks";

const COMMIT_DELAY = 300;
const MAX_DEPTH = 100;

interface Snapshot {
  look: LookSnapshot;
  frame: FrameSnapshot;
  geometry: GeometrySnapshot;
  masks: MasksSnapshot;
}

const { image } = useEditor();
const look = useLook();
const frame = useFrame();
const geometry = useGeometry();
const masks = useMasks();

const serialize = () =>
  JSON.stringify({
    look: look.snapshot(),
    frame: frame.snapshot(),
    geometry: geometry.snapshot(),
    masks: masks.snapshot(),
  });

/// Lu dans un `computed` pour que Vue suive chacun des champs qu'il parcourt.
const current = computed(serialize);

const past = ref<string[]>([]);
const future = ref<string[]>([]);
const pending = ref(false);

let committed = current.value;
let timer: number | undefined;

function commit() {
  clearTimeout(timer);
  pending.value = false;
  if (current.value === committed) return;

  past.value.push(committed);
  if (past.value.length > MAX_DEPTH) past.value.shift();
  future.value = [];
  committed = current.value;
}

function restore(serialized: string) {
  const state = JSON.parse(serialized) as Snapshot;
  look.restore(state.look);
  frame.restore(state.frame);
  geometry.restore(state.geometry);
  masks.restore(state.masks);
}

function undo() {
  // Valide d'abord la retouche en cours : annuler doit toujours défaire ce qu'on voit.
  commit();

  const previous = past.value.pop();
  if (previous === undefined) return;

  future.value.push(committed);
  committed = previous;
  restore(previous);
}

function redo() {
  const next = future.value.pop();
  if (next === undefined) return;

  past.value.push(committed);
  committed = next;
  restore(next);
}

watch(current, (value) => {
  clearTimeout(timer);
  pending.value = value !== committed;
  if (pending.value) timer = window.setTimeout(commit, COMMIT_DELAY);
});

watch(image, () => {
  clearTimeout(timer);
  past.value = [];
  future.value = [];
  pending.value = false;
  committed = current.value;
});

const canUndo = computed(() => past.value.length > 0 || pending.value);
const canRedo = computed(() => future.value.length > 0);

export function useHistory() {
  return { canUndo, canRedo, undo, redo };
}
