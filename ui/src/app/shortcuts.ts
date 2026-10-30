import { t } from "@/shared/i18n";

const MOD = /Mac/i.test(navigator.userAgent) ? "⌘" : "Ctrl";

export interface Shortcut {
  label: string;
  keys: string[];
}

export interface ShortcutGroup {
  title: string;
  shortcuts: Shortcut[];
}

export const shortcutGroups = (): ShortcutGroup[] => [
  {
    title: t("shortcuts.file"),
    shortcuts: [
      { label: t("shortcuts.open"), keys: [MOD, "O"] },
      { label: t("shortcuts.export"), keys: [MOD, "⇧", "E"] },
      { label: t("shortcuts.preferences"), keys: [MOD, ","] },
    ],
  },
  {
    title: t("shortcuts.editing"),
    shortcuts: [
      { label: t("shortcuts.undo"), keys: [MOD, "Z"] },
      { label: t("shortcuts.redo"), keys: [MOD, "⇧", "Z"] },
      { label: t("shortcuts.crop"), keys: ["R"] },
      { label: t("shortcuts.cropDone"), keys: ["⏎"] },
      { label: t("shortcuts.cropSwap"), keys: ["X"] },
    ],
  },
  {
    title: t("shortcuts.display"),
    shortcuts: [
      { label: t("shortcuts.original"), keys: ["C"] },
      { label: t("shortcuts.panel"), keys: ["F"] },
      { label: t("shortcuts.zoomIn"), keys: [MOD, "+"] },
      { label: t("shortcuts.zoomOut"), keys: [MOD, "−"] },
      { label: t("shortcuts.fit"), keys: [MOD, "0"] },
      { label: t("shortcuts.zoomToggle"), keys: ["Z"] },
      { label: t("shortcuts.wheelZoom"), keys: [MOD, t("shortcuts.wheel")] },
      { label: t("shortcuts.pan"), keys: [t("shortcuts.space"), t("shortcuts.drag")] },
    ],
  },
];
