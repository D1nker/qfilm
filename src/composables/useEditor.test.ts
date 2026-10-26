import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ImageMeta, PresetThumbnail } from "@/lib/api";
import { fresh } from "@/test/fresh";

vi.mock("@/lib/api", async () => (await import("@/test/apiMock")).apiMock());

const webview = vi.hoisted(() => ({ onDragDropEvent: vi.fn() }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => webview }));

const meta = (id: string): ImageMeta => ({
  id,
  fileName: `${id}.jpg`,
  width: 6000,
  height: 4000,
  preview: `data:${id}`,
});

const thumbnails = (id: string): PresetThumbnail[] => [{ id: "portrait", image: `thumb-${id}` }];

async function setup() {
  const { useEditor } = await fresh(() => import("@/composables/useEditor"));
  return { api: vi.mocked(await import("@/lib/api")), editor: useEditor() };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}

describe("useEditor", () => {
  beforeEach(() => {
    webview.onDragDropEvent.mockReset();
  });

  it("opens a photo, shows its size and loads the look thumbnails afterwards", async () => {
    const { api, editor } = await setup();
    api.openImage.mockResolvedValue(meta("a"));
    api.presetThumbnails.mockResolvedValue(thumbnails("a"));

    await editor.load("/photos/a.jpg");

    expect(editor.image.value?.id).toBe("a");
    expect(editor.status.value).toBe("6000 × 4000 px");
    expect(editor.loading.value).toBe(false);
    await vi.waitFor(() => expect(editor.thumbnails.value).toEqual({ portrait: "thumb-a" }));
  });

  it("closes the previous photo when a new one opens", async () => {
    const { api, editor } = await setup();
    api.openImage.mockResolvedValueOnce(meta("a")).mockResolvedValueOnce(meta("b"));
    api.presetThumbnails.mockResolvedValue([]);

    await editor.load("/a.jpg");
    await editor.load("/b.jpg");

    expect(api.closeImage).toHaveBeenCalledWith("a");
    expect(editor.image.value?.id).toBe("b");
  });

  it("drops thumbnails that arrive after the photo has changed", async () => {
    const { api, editor } = await setup();
    const slow = deferred<PresetThumbnail[]>();
    api.openImage.mockResolvedValueOnce(meta("a")).mockResolvedValueOnce(meta("b"));
    api.presetThumbnails.mockReturnValueOnce(slow.promise).mockResolvedValueOnce(thumbnails("b"));

    await editor.load("/a.jpg");
    await editor.load("/b.jpg");
    await vi.waitFor(() => expect(editor.thumbnails.value).toEqual({ portrait: "thumb-b" }));

    slow.resolve(thumbnails("a"));
    await Promise.resolve();
    expect(editor.thumbnails.value).toEqual({ portrait: "thumb-b" });
  });

  it("reports an unreadable photo and stops loading", async () => {
    const { api, editor } = await setup();
    api.openImage.mockRejectedValue("format non pris en charge : .raw");

    await editor.load("/a.raw");

    expect(editor.error.value).toBe("format non pris en charge : .raw");
    expect(editor.loading.value).toBe(false);
    expect(editor.image.value).toBeNull();
  });

  it("groups the presets by category", async () => {
    const { api, editor } = await setup();
    api.listPresets.mockResolvedValue([
      { id: "a", name: "A", category: "Couleur", description: "", params: {} },
      { id: "b", name: "B", category: "N&B", description: "", params: {} },
      { id: "c", name: "C", category: "Couleur", description: "", params: {} },
    ] as never);

    await editor.init();

    expect(
      editor.groupedPresets.value.map(([category, items]) => [category, items.length]),
    ).toEqual([
      ["Couleur", 2],
      ["N&B", 1],
    ]);
  });

  it("opens a dropped photo but leaves a dropped .zip to the frame importer", async () => {
    const { api, editor } = await setup();
    api.listPresets.mockResolvedValue([]);
    api.openImage.mockResolvedValue(meta("a"));
    api.presetThumbnails.mockResolvedValue([]);

    await editor.init();
    const onDrop = webview.onDragDropEvent.mock.calls[0]?.[0] as (event: unknown) => void;

    onDrop({ payload: { type: "drop", paths: ["/frames/my-frame.ZIP"] } });
    expect(api.openImage).not.toHaveBeenCalled();

    onDrop({ payload: { type: "over", paths: ["/photo.jpg"] } });
    expect(api.openImage).not.toHaveBeenCalled();

    onDrop({ payload: { type: "drop", paths: ["/photo.jpg"] } });
    expect(api.openImage).toHaveBeenCalledWith("/photo.jpg");
  });
});
