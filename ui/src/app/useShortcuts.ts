import { onMounted, onUnmounted } from "vue";

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
  const { comparing } = useEditor();
  const { toggle } = useInspector();
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
