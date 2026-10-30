import { computed } from "vue";

import { localized, t } from "@/shared/i18n";
import { useEditor } from "@/features/photo";
import { categoryIcon } from "@/features/looks/categoryIcons";
import { useLook } from "@/features/looks/useLook";

/// Les pages des looks (une par catégorie) et celle qu'on voit. `chosen` est la page retenue par
/// l'hôte ; vide ou disparue, la page du look appliqué, à défaut la première.
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
    groupedPresets.value.some((entry) => entry.key === chosen()) ? chosen() : automatic.value,
  );

  const items = () =>
    groupedPresets.value.map(({ key, title, items: presets }) => ({
      id: key,
      label: localized(title),
      icon: categoryIcon(key),
      // Le look appliqué vit dans cette catégorie : un point le dit, même depuis une autre page.
      mark: presets.some((preset) => preset.id === activePreset.value)
        ? t("looks.applied")
        : undefined,
    }));

  return { page, items };
}
