import { Crop, Frame, FolderOpen, Type } from "lucide-vue-next";

import { t } from "@/shared/i18n";
import { openPanels } from "@/shared/lib/panelState";
import { useFrame } from "@/features/frames/useFrame";
import { useGeometry } from "@/features/geometry";

/// Les pages du cadre pour la rampe d'icônes de l'hôte : leurs noms, leurs points « modifié ».
const { frame, caption } = useFrame();
const { modified: cropped } = useGeometry();

export const frameRailItems = () => [
  {
    id: "crop",
    label: t("geometry.title"),
    icon: Crop,
    mark: cropped.value ? t("common.modified") : undefined,
  },
  {
    id: "frame",
    label: t("frames.title"),
    icon: Frame,
    mark: frame.id !== "none" ? t("common.modified") : undefined,
  },
  {
    id: "caption",
    label: t("frames.caption"),
    icon: Type,
    mark: caption.text.trim() ? t("common.modified") : undefined,
  },
  { id: "library", label: t("frames.myFrames"), icon: FolderOpen },
];

/// Choisir la page du cadre déplie ses sections : on veut voir leur contenu. Les autres pages n'en ont pas.
export function unfoldFramePage(id: string) {
  if (id === "frame") openPanels(["frame-shape"]);
}
