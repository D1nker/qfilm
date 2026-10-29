import { onMounted, onUnmounted } from "vue";

import { useGeometry } from "@/features/geometry";
import { useEditor } from "@/features/photo";
import { useHistory } from "@/features/history";
import { useInspector } from "@/features/inspector";

function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

export function useShortcuts() {
  const { comparing, image } = useEditor();
  const { toggle, tab, group } = useInspector();
  const { cropping, toggleCropping, stopCropping, swapOrientation } = useGeometry();
  const { undo, redo } = useHistory();

  function onKeydown(event: KeyboardEvent) {
    const command = event.metaKey || event.ctrlKey;

    // Dans un champ de texte, ⌘Z reste l'annulation de la frappe.
    if (command && !event.altKey && !isTyping(event.target)) {
      const key = event.key.toLowerCase();
      if (key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (key === "y" && event.ctrlKey) {
        event.preventDefault();
        redo();
      }
      return;
    }

    if (command || event.altKey) return;

    if (isTyping(event.target)) return;

    const key = event.key.toLowerCase();
    if (key === "c" && !event.repeat) comparing.value = true;
    else if (key === "f" && !event.repeat) toggle();
    else if (key === "r" && !event.repeat && image.value) {
      // Le recadrage est dans l'onglet Cadre : on y va, comme le fait Lightroom pour son module.
      tab.value = "frame";
      group.frame = "crop";
      toggleCropping();
    } else if (cropping.value && key === "x" && !event.repeat) swapOrientation();
    else if (cropping.value && (key === "enter" || key === "escape")) stopCropping();
  }

  function onKeyup(event: KeyboardEvent) {
    if (event.key.toLowerCase() === "c") comparing.value = false;
  }

  const release = () => (comparing.value = false);

  onMounted(() => {
    window.addEventListener("keydown", onKeydown);
    window.addEventListener("keyup", onKeyup);
    window.addEventListener("blur", release);
  });

  onUnmounted(() => {
    window.removeEventListener("keydown", onKeydown);
    window.removeEventListener("keyup", onKeyup);
    window.removeEventListener("blur", release);
  });
}
