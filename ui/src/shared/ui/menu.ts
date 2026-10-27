import type { Component } from "vue";

export interface MenuAction {
  kind: "item";
  label: string;
  icon?: Component;
  onSelect: () => void;
}

export interface MenuChoice {
  kind: "choice";
  label: string;
  value: string;
  options: { value: string; label: string; icon?: Component }[];
  onChange: (value: string) => void;
}

export interface MenuSeparator {
  kind: "separator";
}

export type MenuEntry = MenuAction | MenuChoice | MenuSeparator;
