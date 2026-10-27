import { beforeEach, describe, expect, it, vi } from "vitest";

import { catalog, film120, film35, noFrame, solid } from "@/test/fixtures";
import { fresh } from "@/test/fresh";

vi.mock("@/shared/api/api", async () => (await import("@/test/apiMock")).apiMock());

const webview = vi.hoisted(() => ({ onDragDropEvent: vi.fn() }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => webview }));

async function setup() {
  const { useFrame } = await fresh(() => import("@/features/frames/useFrame"));
  const { useEditor } = await import("@/features/photo");
  const api = vi.mocked(await import("@/shared/api/api"));
  api.listFrames.mockResolvedValue(catalog);

  const frame = useFrame();
  await frame.init();
  return { api, frame, editor: useEditor() };
}

describe("useFrame", () => {
  beforeEach(() => {
    webview.onDragDropEvent.mockReset();
  });

  it("loads the catalog and starts without a frame", async () => {
    const { frame } = await setup();

    expect(frame.frames.value.map((info) => info.id)).toEqual([
      "none",
      "film35",
      "film120",
      "solid",
    ]);
    expect(frame.frame.id).toBe("none");
    expect(frame.hasMargin.value).toBe(false);
    expect(frame.isPristine.value).toBe(true);
  });

  it("choosing a frame applies the manifest defaults", async () => {
    const { frame } = await setup();
    frame.applyFrame("film35");

    expect(frame.frame.id).toBe("film35");
    expect(frame.frame.params).toMatchObject({
      stock: "amber",
      width: 14,
      color: "#120f0c",
      text: "PORTRAIT 400",
      frameNumber: "24A",
    });
    expect(frame.hasMargin.value).toBe(true);
    expect(frame.current.value?.name).toBe("35 mm");
  });

  it("ignores an unknown frame id", async () => {
    const { frame } = await setup();
    frame.applyFrame("ghost");

    expect(frame.frame.id).toBe("none");
  });

  it("applies the caption defaults a frame proposes", async () => {
    const { frame } = await setup();
    frame.caption.color = "#ffffff";
    frame.applyFrame("solid");

    expect(frame.caption.color).toBe("#1a1a1a");
  });

  it("keeps the caption text when the frame changes", async () => {
    const { frame } = await setup();
    frame.caption.text = "Biarritz";
    frame.applyFrame("film35");
    frame.applyFrame("solid");

    expect(frame.caption.text).toBe("Biarritz");
  });

  it("choosing an option applies the values it imposes", async () => {
    const { frame } = await setup();
    frame.applyFrame("film35");
    const stock = film35.params.find((param) => param.id === "stock");
    if (!stock) throw new Error("fixture");

    frame.setParam(stock, "green");

    expect(frame.frame.params).toMatchObject({
      stock: "green",
      color: "#0d1210",
      ink: "#6fce8a",
      text: "VERT VIF 400",
    });
  });

  it("sanitizes values like the backend does", async () => {
    const { frame } = await setup();
    frame.applyFrame("film35");
    const width = film35.params.find((param) => param.id === "width");
    const color = film35.params.find((param) => param.id === "color");
    if (!width || !color) throw new Error("fixture");

    frame.setParam(width, 500);
    frame.setParam(color, "not a color");

    expect(frame.frame.params.width).toBe(30);
    expect(frame.frame.params.color).toBe("#120f0c");
  });

  it("remembers persistent settings across frames, but not the others", async () => {
    const { frame } = await setup();
    frame.applyFrame("film35");
    const stock = film35.params.find((param) => param.id === "stock");
    const width = film35.params.find((param) => param.id === "width");
    if (!stock || !width) throw new Error("fixture");
    frame.setParam(stock, "green");
    frame.setParam(width, 3);

    frame.applyFrame("solid");
    frame.applyFrame("film120");

    expect(frame.frame.params.stock).toBe("green");
    expect(frame.frame.params.color).toBe("#0d1210");
    expect(frame.frame.params.width).toBe(film120.params.find((p) => p.id === "width")?.default);
  });

  it("gives the look's name to the setting that asks for it", async () => {
    const { frame } = await setup();
    frame.applyFrame("film35");
    frame.labelFromLook("portrait", "Portrait 160");

    expect(frame.frame.params.text).toBe("PORTRAIT 160");
  });

  it("does not label from the neutral look, from a frame without such a setting, or when it is hidden", async () => {
    const { frame } = await setup();

    frame.applyFrame("film35");
    frame.labelFromLook("neutral", "Neutre");
    expect(frame.frame.params.text).toBe("PORTRAIT 400");

    const stock = film35.params.find((param) => param.id === "stock");
    if (!stock) throw new Error("fixture");
    frame.setParam(stock, "plain");
    frame.labelFromLook("portrait", "Portrait");
    expect(frame.frame.params.text).toBe("");

    frame.applyFrame("solid");
    expect(() => frame.labelFromLook("portrait", "Portrait")).not.toThrow();
  });

  it("resets to no frame, an empty caption and no memory", async () => {
    const { frame } = await setup();
    frame.applyFrame("film35");
    frame.caption.text = "Hello";
    frame.caption.x = 0.2;
    expect(frame.isPristine.value).toBe(false);

    frame.resetFrame();

    expect(frame.frame.id).toBe("none");
    expect(frame.frame.params).toEqual({});
    expect(frame.caption.text).toBe("");
    expect(frame.caption.x).toBeNull();
    expect(frame.isPristine.value).toBe(true);

    frame.applyFrame("film120");
    expect(frame.frame.params.stock).toBe("amber");
  });

  it("recenters the caption", async () => {
    const { frame } = await setup();
    frame.caption.x = 0.1;
    frame.caption.y = 0.9;
    frame.recenterCaption();

    expect([frame.caption.x, frame.caption.y]).toEqual([null, null]);
  });

  it("restores a snapshot with its memory", async () => {
    const { frame } = await setup();
    frame.applyFrame("film35");
    const stock = film35.params.find((param) => param.id === "stock");
    if (!stock) throw new Error("fixture");
    frame.setParam(stock, "green");
    frame.caption.text = "Salut";
    const snapshot = frame.snapshot();

    frame.resetFrame();
    frame.restore(snapshot);
    frame.applyFrame("film120");

    expect(frame.caption.text).toBe("Salut");
    expect(frame.frame.params.stock).toBe("green");
  });

  it("falls back to no frame when the chosen imported frame is removed", async () => {
    const { api, frame } = await setup();
    frame.applyFrame("solid");
    api.removeFrame.mockResolvedValue({ ...catalog, frames: [noFrame, film35, film120] });

    await frame.remove("solid");

    expect(api.removeFrame).toHaveBeenCalledWith("solid");
    expect(frame.frame.id).toBe("none");
    expect(frame.frames.value.map((info) => info.id)).not.toContain("solid");
  });

  it("imports from an archive and a folder, and reports failures", async () => {
    const { api, frame, editor } = await setup();
    const imported = {
      ...catalog,
      frames: [...catalog.frames, { ...solid, id: "mine", name: "Mine", builtin: false }],
    };
    api.pickFrameArchive.mockResolvedValue("/frames/mine.zip");
    api.importFrame.mockResolvedValueOnce(imported);

    await frame.importArchive();
    expect(api.importFrame).toHaveBeenCalledWith("/frames/mine.zip");
    expect(frame.frames.value.map((info) => info.id)).toContain("mine");

    api.pickFrameFolder.mockResolvedValue("/frames/broken");
    api.importFrame.mockRejectedValueOnce("manifeste invalide : id");
    await frame.importFolder();
    expect(editor.error.value).toBe("manifeste invalide : id");
  });

  it("does nothing when the picker is cancelled", async () => {
    const { api, frame } = await setup();
    api.pickFrameArchive.mockResolvedValue(null);

    await frame.importArchive();

    expect(api.importFrame).not.toHaveBeenCalled();
  });

  it("imports a dropped .zip and ignores other dropped files", async () => {
    const { api, frame } = await setup();
    api.importFrame.mockResolvedValue(catalog);
    const onDrop = webview.onDragDropEvent.mock.calls[0]?.[0] as (event: unknown) => void;

    onDrop({ payload: { type: "drop", paths: ["/a/photo.jpg", "/a/cadre.zip", "/a/autre.ZIP"] } });
    onDrop({ payload: { type: "over", paths: ["/a/hover.zip"] } });

    await vi.waitFor(() => expect(api.importFrame).toHaveBeenCalledTimes(2));
    expect(api.importFrame.mock.calls.map(([path]) => path)).toEqual([
      "/a/cadre.zip",
      "/a/autre.ZIP",
    ]);
    expect(frame.frames.value).toHaveLength(4);
  });

  it("reports a catalog that fails to load without crashing", async () => {
    const { useFrame } = await fresh(() => import("@/features/frames/useFrame"));
    const { useEditor } = await import("@/features/photo");
    const api = vi.mocked(await import("@/shared/api/api"));
    api.listFrames.mockRejectedValue("dossier illisible");

    await useFrame().init();

    expect(useEditor().error.value).toBe("dossier illisible");
  });
});
