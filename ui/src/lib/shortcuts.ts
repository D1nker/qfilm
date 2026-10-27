const MOD = /Mac/i.test(navigator.userAgent) ? "⌘" : "Ctrl";

export interface Shortcut {
  label: string;
  keys: string[];
}

export const SHORTCUT_GROUPS: { title: string; shortcuts: Shortcut[] }[] = [
  {
    title: "Édition",
    shortcuts: [
      { label: "Annuler", keys: [MOD, "Z"] },
      { label: "Rétablir", keys: [MOD, "⇧", "Z"] },
    ],
  },
  {
    title: "Affichage",
    shortcuts: [
      { label: "Voir l'original (maintenir)", keys: ["C"] },
      { label: "Masquer ou afficher le panneau", keys: ["F"] },
      { label: "Zoomer", keys: [MOD, "+"] },
      { label: "Dézoomer", keys: [MOD, "−"] },
      { label: "Ajuster à la fenêtre", keys: [MOD, "0"] },
      { label: "Zoomer à la molette", keys: [MOD, "molette"] },
      { label: "Déplacer la photo", keys: ["Espace", "glisser"] },
    ],
  },
];
