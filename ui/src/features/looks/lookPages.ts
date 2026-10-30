import { computed } from "vue";
import { Clock, Star } from "lucide-vue-next";

import { localized, t } from "@/shared/i18n";
import { useEditor } from "@/features/photo";
import { categoryIcon } from "@/features/looks/categoryIcons";
import { useLook } from "@/features/looks/useLook";

/// Les raccourcis, avant les catégories : les looks gardés, puis ceux qu'on vient d'essayer.
export const FAVORITES_PAGE = "favorites";
export const RECENT_PAGE = "recent";

/// Les pages des looks (deux raccourcis, puis une par catégorie) et celle qu'on voit. `chosen` est la
/// page retenue par l'hôte ; vide ou disparue, la page du look appliqué, à défaut la première catégorie
/// (les raccourcis ne s'ouvrent jamais tout seuls : au début ils sont vides).
export function useLookPages(chosen: () => string) {
  const { groupedPresets } = useEditor();
  const { activePreset } = useLook();

  const automatic = computed(() => {
    const groups = groupedPresets.value;
    const active = groups.find((entry) =>
      entry.items.some((preset) => preset.id === activePreset.value),
    );
    return (active ?? groups[0])?.key ?? "";
  });

  const page = computed(() =>
    [FAVORITES_PAGE, RECENT_PAGE].includes(chosen()) ||
    groupedPresets.value.some((entry) => entry.key === chosen())
      ? chosen()
      : automatic.value,
  );

  const items = () => [
    { id: FAVORITES_PAGE, label: t("looks.favorites"), icon: Star },
    { id: RECENT_PAGE, label: t("looks.recent"), icon: Clock },
    ...groupedPresets.value.map(({ key, title, items: presets }) => ({
      id: key,
      label: localized(title),
      icon: categoryIcon(key),
      // Le look appliqué vit dans cette catégorie : un point le dit, même depuis une autre page.
      mark: presets.some((preset) => preset.id === activePreset.value)
        ? t("looks.applied")
        : undefined,
    })),
  ];

  return { page, items };
}
