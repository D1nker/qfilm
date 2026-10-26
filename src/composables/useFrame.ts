import { computed, reactive, ref } from "vue";
import { getCurrentWebview } from "@tauri-apps/api/webview";

import {
  importFrame,
  listFrames,
  openFramesFolder,
  pickFrameArchive,
  pickFrameFolder,
  reloadFrames,
  removeFrame,
  type Caption,
  type FrameCatalog,
  type FrameInfo,
  type FrameIssue,
  type FrameSelection,
  type ParamDef,
  type ParamValue,
} from "@/lib/api";
import { DEFAULT_CAPTION } from "@/lib/defaults";
import {
  NONE_FRAME,
  captionDefaultsOf,
  coerce,
  isVisible,
  optionSets,
  selectionFor,
  type ParamValues,
} from "@/lib/frameParams";
import { useEditor } from "@/composables/useEditor";

const { error } = useEditor();

const frames = ref<FrameInfo[]>([]);
const issues = ref<FrameIssue[]>([]);
const directory = ref("");

const frame = reactive<FrameSelection>({ id: NONE_FRAME, params: {} });
const caption = reactive<Caption>({ ...DEFAULT_CAPTION });

/// Les valeurs choisies pour les réglages « persistants » (la pellicule, le numéro de vue) :
/// elles survivent à un détour par un cadre qui ne les a pas.
const memory = reactive<ParamValues>({});

const current = computed(() => frames.value.find((info) => info.id === frame.id));
const hasMargin = computed(() => frame.id !== NONE_FRAME);

function receive(catalog: FrameCatalog) {
  frames.value = catalog.frames;
  issues.value = catalog.issues;
  directory.value = catalog.directory;

  if (!catalog.frames.some((info) => info.id === frame.id)) applyFrame(NONE_FRAME);
}

async function init() {
  try {
    receive(await listFrames());
  } catch (e) {
    error.value = String(e);
  }

  await getCurrentWebview().onDragDropEvent((event) => {
    if (event.payload.type !== "drop") return;

    for (const path of event.payload.paths) {
      if (path.toLowerCase().endsWith(".zip")) void importFrom(path);
    }
  });
}

function applyFrame(id: string) {
  const info = frames.value.find((item) => item.id === id);
  if (!info) return;

  const selection = selectionFor(info, memory);
  frame.id = selection.id;
  frame.params = selection.params;

  Object.assign(caption, captionDefaultsOf(info));
}

function setParam(def: ParamDef, value: ParamValue) {
  const clean = coerce(def, value);
  frame.params[def.id] = clean;
  if (def.persist) memory[def.id] = clean;

  Object.assign(frame.params, optionSets(def, clean));
}

function labelFromLook(presetId: string, presetName: string) {
  if (presetId === "neutral") return;

  const def = current.value?.params.find((param) => param.fromLook);
  if (def?.type !== "text" || !isVisible(def, frame.params)) return;

  frame.params[def.id] = coerce(def, presetName.toUpperCase());
}

function recenterCaption() {
  caption.x = null;
  caption.y = null;
}

function resetFrame() {
  for (const key of Object.keys(memory)) delete memory[key];
  frame.id = NONE_FRAME;
  frame.params = {};
  Object.assign(caption, DEFAULT_CAPTION);
}

const isPristine = computed(
  () =>
    frame.id === NONE_FRAME &&
    (Object.keys(DEFAULT_CAPTION) as (keyof Caption)[]).every(
      (key) => caption[key] === DEFAULT_CAPTION[key],
    ),
);

async function importFrom(path: string) {
  try {
    receive(await importFrame(path));
  } catch (e) {
    error.value = String(e);
  }
}

async function importArchive() {
  const path = await pickFrameArchive();
  if (path) await importFrom(path);
}

async function importFolder() {
  const path = await pickFrameFolder();
  if (path) await importFrom(path);
}

async function remove(id: string) {
  try {
    receive(await removeFrame(id));
  } catch (e) {
    error.value = String(e);
  }
}

async function reload() {
  try {
    receive(await reloadFrames());
  } catch (e) {
    error.value = String(e);
  }
}

async function showFolder() {
  try {
    await openFramesFolder();
  } catch (e) {
    error.value = String(e);
  }
}

export interface FrameSnapshot {
  frame: FrameSelection;
  caption: Caption;
  memory: ParamValues;
}

function snapshot(): FrameSnapshot {
  return {
    frame: { id: frame.id, params: { ...frame.params } },
    caption: { ...caption },
    memory: { ...memory },
  };
}

function restore(state: FrameSnapshot) {
  frame.id = state.frame.id;
  frame.params = { ...state.frame.params };
  Object.assign(caption, state.caption);
  for (const key of Object.keys(memory)) delete memory[key];
  Object.assign(memory, state.memory);
}

export function useFrame() {
  return {
    frames,
    issues,
    directory,
    frame,
    caption,
    memory,
    current,
    hasMargin,
    isPristine,
    init,
    applyFrame,
    setParam,
    labelFromLook,
    recenterCaption,
    resetFrame,
    importArchive,
    importFolder,
    remove,
    reload,
    showFolder,
    snapshot,
    restore,
  };
}
