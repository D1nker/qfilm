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
    title: t("shortcuts.editing"),
    shortcuts: [
      { label: t("shortcuts.undo"), keys: [MOD, "Z"] },
      { label: t("shortcuts.redo"), keys: [MOD, "⇧", "Z"] },
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
      { label: t("shortcuts.wheelZoom"), keys: [MOD, t("shortcuts.wheel")] },
      { label: t("shortcuts.pan"), keys: [t("shortcuts.space"), t("shortcuts.drag")] },
    ],
  },
];
