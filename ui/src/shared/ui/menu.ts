import type { Component } from "vue";

export interface MenuAction {
  kind: "item";
  label: string;
  icon?: Component;
  onSelect: () => void;
}

export interface MenuSeparator {
  kind: "separator";
}

export type MenuEntry = MenuAction | MenuSeparator;
