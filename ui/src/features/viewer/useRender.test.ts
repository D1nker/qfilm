import { describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";

import type { ImageMeta, PreviewResult } from "@/shared/api/api";
import { catalog } from "@/test/fixtures";
import { fresh } from "@/test/fresh";

vi.mock("@/shared/api/api", async () => (await import("@/test/apiMock")).apiMock());
vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({ onDragDropEvent: vi.fn() }),
}));

const image = (id: string): ImageMeta => ({
  id,
  fileName: `${id}.jpg`,
  width: 100,
  height: 80,
  preview: `raw-${id}`,
});

const result = (label: string): PreviewResult => ({
  image: `render-${label}`,
  width: 120,
  height: 100,
  zones: [{ field: "text", x: 1, y: 2, width: 3, height: 4 }],
  captionCenter: [0.25, 0.75],
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}

async function setup() {
  const { useRender } = await fresh(() => import("@/features/viewer/useRender"));
  const { useEditor } = await import("@/features/photo");
  const { useLook } = await import("@/features/looks");
  const { useFrame } = await import("@/features/frames");
  const api = vi.mocked(await import("@/shared/api/api"));
  api.listFrames.mockResolvedValue(catalog);
  api.renderPreview.mockResolvedValue(result("default"));

  const frame = useFrame();
  await frame.init();
  return { render: useRender(), editor: useEditor(), look: useLook(), frame, api };
}

describe("useRender", () => {
  it("shows the raw photo immediately, then the rendered one", async () => {
    const { api, render, editor } = await setup();
    const pending = deferred<PreviewResult>();
    api.renderPreview.mockReturnValue(pending.promise);

    editor.image.value = image("a");
    await nextTick();
    expect(render.view.src).toBe("raw-a");

    pending.resolve(result("default"));
    await vi.waitFor(() => expect(render.view.src).toBe("render-default"));
    expect(render.view).toMatchObject({ width: 120, height: 100, captionX: 0.25, captionY: 0.75 });
    expect(render.view.zones).toHaveLength(1);
  });

  it("renders with the effective look and the chosen frame", async () => {
    const { api, editor, look, frame } = await setup();
    editor.image.value = image("a");
    look.setParam("exposure", 1.5);
    frame.applyFrame("film35");

    await vi.waitFor(() => expect(api.renderPreview).toHaveBeenCalled());
    await vi.waitFor(() => {
      const [id, params, selection] = api.renderPreview.mock.calls.at(-1) ?? [];
      expect(id).toBe("a");
      expect((params as { exposure: number }).exposure).toBeCloseTo(1.5);
      expect(selection).toMatchObject({ id: "film35", params: { stock: "amber" } });
    });
  });

  it("renders again when the look or the frame settings change", async () => {
    const { api, editor, look, frame } = await setup();
    editor.image.value = image("a");
    await vi.waitFor(() => expect(api.renderPreview).toHaveBeenCalledTimes(1));

    look.setParam("contrast", 0.4);
    await vi.waitFor(() => expect(api.renderPreview).toHaveBeenCalledTimes(2));

    frame.applyFrame("solid");
    await vi.waitFor(() => expect(api.renderPreview).toHaveBeenCalledTimes(3));
  });

  it("does not render again when only the caption changes", async () => {
    const { api, editor, frame } = await setup();
    editor.image.value = image("a");
    await vi.waitFor(() => expect(api.renderPreview).toHaveBeenCalledTimes(1));

    frame.caption.text = "Salut";
    frame.caption.size = 9;
    frame.caption.x = 0.3;
    await nextTick();
    await Promise.resolve();

    expect(api.renderPreview).toHaveBeenCalledTimes(1);
  });

  it("does nothing without a photo", async () => {
    const { api, look } = await setup();
    look.setParam("exposure", 1);
    await nextTick();

    expect(api.renderPreview).not.toHaveBeenCalled();
  });

  it("ignores a render that finishes after the photo has changed", async () => {
    const { api, render, editor } = await setup();
    const slow = deferred<PreviewResult>();
    const next = deferred<PreviewResult>();
    api.renderPreview.mockReturnValueOnce(slow.promise).mockReturnValueOnce(next.promise);

    editor.image.value = image("a");
    await vi.waitFor(() => expect(api.renderPreview).toHaveBeenCalledTimes(1));
    editor.image.value = image("b");

    slow.resolve(result("stale"));
    await vi.waitFor(() => expect(api.renderPreview).toHaveBeenCalledTimes(2));
    // Entre-temps, on voit la photo brute de b : jamais le rendu de a, même un instant.
    expect(render.view.src).toBe("raw-b");

    next.resolve(result("b"));
    await vi.waitFor(() => expect(render.view.src).toBe("render-b"));
  });

  it("merges a burst of changes instead of queueing one render per change", async () => {
    const { api, editor, look } = await setup();
    const gate = deferred<PreviewResult>();
    editor.image.value = image("a");
    await vi.waitFor(() => expect(api.renderPreview).toHaveBeenCalledTimes(1));
    api.renderPreview.mockReset();
    api.renderPreview.mockReturnValueOnce(gate.promise).mockResolvedValue(result("last"));

    for (let value = 1; value <= 10; value++) {
      look.setParam("exposure", value / 10);
      await nextTick();
    }
    gate.resolve(result("first"));

    await vi.waitFor(() => expect(api.renderPreview.mock.calls.length).toBeGreaterThanOrEqual(1));
    await vi.waitFor(() => expect(api.renderPreview.mock.calls.length).toBeLessThanOrEqual(2));
  });

  it("reports a failed render", async () => {
    const { api, editor } = await setup();
    api.renderPreview.mockRejectedValue("cadre « x » introuvable");
    editor.image.value = image("a");

    await vi.waitFor(() => expect(editor.error.value).toBe("cadre « x » introuvable"));
  });
});
