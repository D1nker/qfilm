<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { ImagePlus } from "lucide-vue-next";

import type { TextZone } from "@/lib/api";
import { useCaptionLayer } from "@/composables/useCaptionLayer";
import { useEditor } from "@/composables/useEditor";
import { useFrame } from "@/composables/useFrame";
import { useInspector } from "@/composables/useInspector";
import { useRender } from "@/composables/useRender";
import { useViewportNavigation } from "@/composables/useViewportNavigation";
import CanvasToolbar from "@/components/CanvasToolbar.vue";

const { image, loading, comparing, browse } = useEditor();
const { frame, caption, current, setParam } = useFrame();
const { tab } = useInspector();
const { view } = useRender();

const stage = ref<HTMLElement | null>(null);
const scroller = ref<HTMLElement | null>(null);
const previewImage = ref<HTMLImageElement | null>(null);
const captionCanvas = ref<HTMLCanvasElement | null>(null);
const zoneInput = ref<HTMLInputElement | null>(null);
const editing = ref<string | null>(null);

const {
  measureImage,
  zoneStyle,
  captionZoneStyle,
  captionCanvasStyle,
  startCaptionDrag,
  onCaptionDrag,
  endCaptionDrag,
} = useCaptionLayer({ previewImage, captionCanvas, onCaptionClick: editCaption });

const navigation = useViewportNavigation({ stage, scroller, previewImage });
const {
  zoomPercent,
  atFit,
  pannable,
  panning,
  spaceDown,
  imageStyle,
  zoomIn,
  zoomOut,
  toggleActual,
  onWheel,
  onGestureStart,
  onGestureChange,
  onPointerDown,
  onPointerMove,
  onPointerUp,
} = navigation;

// Sur le défilement plutôt que sur l'image : un déplacement capture le pointeur, ce qui
// redirige le double-clic vers le conteneur.
function onDoubleClick(event: MouseEvent) {
  if (event.target instanceof Element && event.target.closest(".zone, .zone-editor")) return;

  void toggleActual({ x: event.clientX, y: event.clientY });
}

function onImageLoad() {
  navigation.onImageLoad();
  measureImage();
}

const displayed = computed(() => (comparing.value ? image.value?.preview : view.src));

const editable = computed(() => tab.value === "frame" && !comparing.value);

const editorStyle = computed(() => {
  if (!editing.value) return null;
  if (editing.value === "caption") return captionZoneStyle.value;

  const zone = view.zones.find((item) => item.field === editing.value);
  return zone ? zoneStyle(zone) : null;
});

function fieldLabel(field: string | null) {
  if (field === "caption") return "Légende";
  return current.value?.params.find((param) => param.id === field)?.label ?? "";
}

const editingValue = computed({
  get: () => {
    if (editing.value === "caption") return caption.text;
    return String(frame.params[editing.value ?? ""] ?? "");
  },
  set: (value: string) => {
    if (editing.value === "caption") {
      caption.text = value;
      return;
    }

    const def = current.value?.params.find((param) => param.id === editing.value);
    if (def) setParam(def, value);
  },
});

async function focusEditor() {
  await nextTick();
  zoneInput.value?.focus();
  zoneInput.value?.select();
}

function editZone(zone: TextZone) {
  editing.value = zone.field;
  void focusEditor();
}

function editCaption() {
  editing.value = "caption";
  void focusEditor();
}
</script>

<template>
  <main ref="stage">
    <button v-if="!image" type="button" class="dropzone" @click="browse">
      <ImagePlus :size="28" class="icon" />
      <span class="big">Dépose une photo ici</span>
      <span class="hint">JPEG, PNG ou TIFF 16 bits — ou clique pour parcourir</span>
    </button>

    <div
      v-else
      ref="scroller"
      class="scroller"
      :class="{ pannable, panning, 'space-down': spaceDown }"
      @wheel="onWheel"
      @gesturestart="onGestureStart"
      @gesturechange="onGestureChange"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @dblclick="onDoubleClick"
    >
      <div class="content">
        <img
          ref="previewImage"
          :src="displayed"
          :alt="image.fileName"
          :style="imageStyle"
          draggable="false"
          @load="onImageLoad"
        />

        <template v-if="!comparing">
          <canvas ref="captionCanvas" class="caption-layer" :style="captionCanvasStyle" />

          <template v-if="editable">
            <button
              v-for="zone in view.zones"
              :key="zone.field"
              type="button"
              class="zone"
              :class="{ active: editing === zone.field }"
              :style="zoneStyle(zone)"
              :aria-label="`Modifier : ${fieldLabel(zone.field)}`"
              @click="editZone(zone)"
            />

            <button
              type="button"
              class="zone movable"
              :class="{ active: editing === 'caption' }"
              :style="captionZoneStyle"
              aria-label="Modifier la légende (glisser pour la déplacer)"
              @pointerdown="startCaptionDrag"
              @pointermove="onCaptionDrag"
              @pointerup="endCaptionDrag"
            />
          </template>

          <div v-if="editorStyle" class="zone-editor" :style="editorStyle">
            <input
              ref="zoneInput"
              v-model="editingValue"
              type="text"
              :placeholder="fieldLabel(editing)"
              @keydown.enter="editing = null"
              @keydown.esc="editing = null"
              @blur="editing = null"
            />
          </div>
        </template>
      </div>
    </div>

    <CanvasToolbar
      v-if="image"
      :zoom-percent="zoomPercent"
      :at-fit="atFit"
      @zoom-in="zoomIn"
      @zoom-out="zoomOut"
      @toggle-zoom="toggleActual()"
    />

    <div v-if="loading" class="overlay">Décodage…</div>
  </main>
</template>

<style scoped>
main {
  --toolbar-clearance: 40px;

  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--canvas);
}

.scroller {
  position: absolute;
  inset: 0;
  overflow: auto;
}

.scroller.pannable {
  cursor: grab;
}

.scroller.panning {
  cursor: grabbing;
}

.scroller.space-down .zone,
.scroller.space-down .zone-editor {
  pointer-events: none;
}

/* `margin: auto` plutôt que `justify-content: center` : le centrage flex rend la
   partie débordante inaccessible au défilement. */
.content {
  position: relative;
  display: flex;
  width: max-content;
  min-width: 100%;
  min-height: 100%;
  padding: var(--space-8);
  padding-bottom: calc(var(--space-8) + var(--toolbar-clearance));
}

img {
  flex: none;
  margin: auto;
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-lg);
  user-select: none;
  -webkit-user-drag: none;
}

.dropzone {
  position: absolute;
  inset: var(--space-8);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-lg);
  background: transparent;
  cursor: pointer;
  transition:
    border-color var(--duration) var(--ease),
    background var(--duration) var(--ease);
}

.dropzone:hover {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.dropzone:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.icon {
  color: var(--text-faint);
}

.big {
  font-size: var(--text-lg);
}

.hint {
  color: var(--text-muted);
  font-size: var(--text-sm);
}

.overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in oklch, var(--canvas) 70%, transparent);
  color: var(--text-muted);
  font-size: var(--text-sm);
}

.caption-layer {
  position: absolute;
  pointer-events: none;
}

.zone {
  position: absolute;
  padding: 0;
  border: 1px dashed color-mix(in oklch, var(--accent) 45%, transparent);
  border-radius: var(--radius-sm);
  background: transparent;
  cursor: pointer;
  touch-action: none;
}

.zone.movable {
  cursor: grab;
}

.zone.movable:active {
  cursor: grabbing;
}

.zone:hover,
.zone.active {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.zone:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.zone-editor {
  position: absolute;
  display: flex;
  align-items: center;
  min-height: 30px;
}

.zone-editor input {
  width: 100%;
  padding: 5px var(--space-2);
  border: 1px solid var(--accent);
  border-radius: var(--radius-sm);
  background: var(--surface-raised);
  box-shadow: var(--shadow-md);
  color: var(--text);
  font: inherit;
  font-size: var(--text-sm);
}

.zone-editor input:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
</style>
