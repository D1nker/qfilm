import { Blend } from "lucide-vue-next";

import { t } from "@/shared/i18n";
import { openPanels } from "@/shared/lib/panelState";
import { MASKS_PAGE, useMasks } from "@/features/masks/useMasks";

const { active } = useMasks();

/// La page des masques pour la rampe d'icônes de l'hôte : un point dès qu'un masque change quelque chose.
export const maskRailItems = () => [
  {
    id: MASKS_PAGE,
    label: t("masks.title"),
    icon: Blend,
    mark: active.value ? t("common.modified") : undefined,
  },
];

/// Choisir la page déplie ses sections : on veut voir les curseurs du masque.
export function unfoldMasksPage() {
  openPanels(["mask-light", "mask-color"]);
}
