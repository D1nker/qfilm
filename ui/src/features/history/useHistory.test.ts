import { afterEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";

import { catalog } from "@/test/fixtures";
import { fresh } from "@/test/fresh";

vi.mock("@/shared/api/api", async () => (await import("@/test/apiMock")).apiMock());
vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({ onDragDropEvent: vi.fn() }),
}));

async function setup() {
  vi.useFakeTimers();
  const { useHistory } = await fresh(() => import("@/features/history/useHistory"));
  const { useLook } = await import("@/features/looks");
  const { useFrame } = await import("@/features/frames");
  const { useEditor } = await import("@/features/photo");
  const api = vi.mocked(await import("@/shared/api/api"));
  api.listFrames.mockResolvedValue(catalog);

  const frame = useFrame();
  await frame.init();
  return { history: useHistory(), look: useLook(), frame, editor: useEditor() };
}

/// Laisse Vue réagir, puis attend la pause qui valide une retouche.
async function settle(ms = 300) {
  await nextTick();
  vi.advanceTimersByTime(ms);
  await nextTick();
}

describe("useHistory", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("has nothing to undo or redo at first", async () => {
    const { history } = await setup();

    expect(history.canUndo.value).toBe(false);
    expect(history.canRedo.value).toBe(false);
  });

  it("undoes and redoes a curve edit", async () => {
    const { history, look } = await setup();

    look.setCurve("rgb", [
      [0, 0],
      [0.5, 0.7],
      [1, 1],
    ]);
    await settle();
    history.undo();
    await settle();
    expect(look.params.value.curves.rgb).toEqual([]);

    history.redo();
    await settle();
    expect(look.params.value.curves.rgb[1]).toEqual([0.5, 0.7]);
  });

  it("collapses a continuous gesture into a single step", async () => {
    const { history, look } = await setup();

    for (let value = 1; value <= 20; value++) {
      look.setParam("exposure", value / 10);
      await settle(50);
    }
    await settle();

    history.undo();
    await settle();

    expect(look.params.value.exposure).toBe(0);
    expect(history.canUndo.value).toBe(false);
  });

  it("undoes and redoes separate steps in order", async () => {
    const { history, look } = await setup();

    look.setParam("exposure", 1);
    await settle();
    look.setParam("contrast", 0.5);
    await settle();

    history.undo();
    await settle();
    expect(look.params.value).toMatchObject({ exposure: 1, contrast: 0 });

    history.undo();
    await settle();
    expect(look.params.value).toMatchObject({ exposure: 0, contrast: 0 });
    expect(history.canRedo.value).toBe(true);

    history.redo();
    await settle();
    expect(look.params.value).toMatchObject({ exposure: 1, contrast: 0 });

    history.redo();
    await settle();
    expect(look.params.value).toMatchObject({ exposure: 1, contrast: 0.5 });
    expect(history.canRedo.value).toBe(false);
  });

  it("undo reverts a change that has not been committed yet", async () => {
    const { history, look } = await setup();

    look.setParam("exposure", 2);
    await nextTick();
    expect(history.canUndo.value).toBe(true);

    history.undo();
    await settle();

    expect(look.params.value.exposure).toBe(0);
    expect(history.canRedo.value).toBe(true);
  });

  it("a new change after an undo clears the redo stack", async () => {
    const { history, look } = await setup();

    look.setParam("exposure", 1);
    await settle();
    history.undo();
    await settle();
    expect(history.canRedo.value).toBe(true);

    look.setParam("contrast", 0.3);
    await settle();

    expect(history.canRedo.value).toBe(false);
  });

  it("covers the frame and the caption as well as the look", async () => {
    const { history, frame } = await setup();

    frame.applyFrame("film35");
    await settle();
    frame.caption.text = "Salut";
    await settle();

    history.undo();
    await settle();
    expect(frame.caption.text).toBe("");
    expect(frame.frame.id).toBe("film35");

    history.undo();
    await settle();
    expect(frame.frame.id).toBe("none");
  });

  it("starts a new history for each photo", async () => {
    const { history, look, editor } = await setup();

    look.setParam("exposure", 1);
    await settle();
    expect(history.canUndo.value).toBe(true);

    editor.image.value = { id: "2", fileName: "b.jpg", width: 10, height: 10, preview: "" };
    await settle();

    expect(history.canUndo.value).toBe(false);
  });

  it("keeps at most 100 steps", async () => {
    const { history, look } = await setup();

    for (let step = 1; step <= 105; step++) {
      look.setParam("exposure", step / 100);
      await settle();
    }

    let undone = 0;
    while (history.canUndo.value && undone < 200) {
      history.undo();
      await settle(0);
      undone += 1;
    }
    expect(undone).toBe(100);
  });
});
