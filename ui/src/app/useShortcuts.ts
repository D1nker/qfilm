import { onMounted, onUnmounted } from "vue";

import { useExport } from "@/features/export";
import { useGeometry } from "@/features/geometry";
import { useEditor } from "@/features/photo";
import { useHistory } from "@/features/history";
import { useInspector } from "@/features/inspector";
import { useHelp } from "@/app/useHelp";
import { usePreferences } from "@/app/usePreferences";

function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

export function useShortcuts() {
  const { comparing, image, browse } = useEditor();
  const { exportOpen, openExport } = useExport();
  const { shortcutsOpen } = useHelp();
  const { preferencesOpen } = usePreferences();
  const { toggle, tab, group } = useInspector();
  const { cropping, toggleCropping, stopCropping, swapOrientation } = useGeometry();
  const { undo, redo } = useHistory();

  /// Les raccourcis de l'application, qui marchent même dans un champ de texte (aucun n'y a de sens propre) :
  /// ouvrir, exporter, préférences. Renvoie vrai quand la touche était l'un d'eux. Pendant une boîte de
  /// dialogue, ouvrir et exporter se taisent : la fenêtre du dessous n'est pas celle qu'on regarde.
  function onAppShortcut(event: KeyboardEvent) {
    const key = event.key.toLowerCase();
    const modal = exportOpen.value || shortcutsOpen.value;

    if (key === "o" && !event.shiftKey) {
      event.preventDefault();
      if (!modal) void browse();
    } else if (key === "e" && event.shiftKey) {
      event.preventDefault();
      if (!modal) openExport();
    } else if (key === ",") {
      event.preventDefault();
      preferencesOpen.value = !preferencesOpen.value;
    } else {
      return false;
    }
    return true;
  }

  function onKeydown(event: KeyboardEvent) {
    // ⌘ sur Mac, Ctrl ailleurs : on accepte l'un ou l'autre, quel que soit le système.
    const command = event.metaKey || event.ctrlKey;

    if (command && !event.altKey && onAppShortcut(event)) return;

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
