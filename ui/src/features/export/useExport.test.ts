import { describe, expect, it, vi } from "vitest";

import type { ImageMeta } from "@/shared/api/api";
import { fresh } from "@/test/fresh";

vi.mock("@/shared/api/api", async () => (await import("@/test/apiMock")).apiMock());
vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({ onDragDropEvent: vi.fn() }),
}));

const meta: ImageMeta = {
  id: "a",
  fileName: "IMG_0001.jpg",
  width: 6000,
  height: 4000,
  preview: "data:a",
};

async function setup() {
  const { useExport } = await fresh(() => import("@/features/export"));
  const { useEditor } = await import("@/features/photo");
  const api = vi.mocked(await import("@/shared/api/api"));
  api.openImage.mockResolvedValue(meta);
  api.presetThumbnails.mockResolvedValue([]);
  api.pickDestination.mockResolvedValue("/out/IMG_0001-neutral.jpg");
  api.exportImage.mockResolvedValue(null);

  const editor = useEditor();
  await editor.load("/photos/IMG_0001.jpg");
  return { api, exporter: useExport() };
}

describe("useExport", () => {
  it("keeps the metadata by default", async () => {
    const { api, exporter } = await setup();

    await exporter.saveExport();

    expect(api.exportImage).toHaveBeenCalledOnce();
    expect(api.exportImage.mock.calls[0]?.[7]).toMatchObject({ keepMetadata: true });
  });

  it("drops the metadata when the user turns it off", async () => {
    const { api, exporter } = await setup();
    exporter.keepMetadata.value = false;

    await exporter.saveExport();

    expect(api.exportImage.mock.calls[0]?.[7]).toMatchObject({
      keepMetadata: false,
      format: "jpeg",
      maxEdge: null,
    });
  });

  it("does nothing when the destination dialog is cancelled", async () => {
    const { api, exporter } = await setup();
    api.pickDestination.mockResolvedValue(null);

    await exporter.saveExport();

    expect(api.exportImage).not.toHaveBeenCalled();
  });
});
