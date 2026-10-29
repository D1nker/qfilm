import { describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";

import type { ImageMeta, PreviewResult } from "@/shared/api/api";
import { DRAFT_THRESHOLD_MS } from "@/features/viewer/useRender";
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

const params = (api: Awaited<ReturnType<typeof setup>>["api"]) =>
  (api.renderPreview.mock.calls.at(-1)?.[1] as { exposure: number } | undefined)?.exposure ??
  Number.NaN;

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
  const { useGeometry } = await import("@/features/geometry");
  const api = vi.mocked(await import("@/shared/api/api"));
  api.listFrames.mockResolvedValue(catalog);
  api.renderPreview.mockResolvedValue(result("default"));

  const frame = useFrame();
  await frame.init();
  return {
    render: useRender(),
    editor: useEditor(),
    look: useLook(),
    geometry: useGeometry(),
    frame,
    api,
  };
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
      const [id, params, , selection] = api.renderPreview.mock.calls.at(-1) ?? [];
      expect(id).toBe("a");
      expect((params as { exposure: number }).exposure).toBeCloseTo(1.5);
      expect(selection).toMatchObject({ id: "film35", params: { stock: "amber" } });
    });
  });

  describe("geometry", () => {
    const lastGeometry = (api: Awaited<ReturnType<typeof setup>>["api"]) =>
      api.renderPreview.mock.calls.at(-1)?.[2] as
        { quarterTurns: number; crop: { width: number } } | undefined;
    const lastFrame = (api: Awaited<ReturnType<typeof setup>>["api"]) =>
      api.renderPreview.mock.calls.at(-1)?.[3];

    it("sends the crop, and renders again when it changes", async () => {
      const { api, editor, geometry } = await setup();
      editor.image.value = image("a");
      await vi.waitFor(() => expect(api.renderPreview).toHaveBeenCalledTimes(1));

      geometry.setCrop({ x: 0.1, y: 0.1, width: 0.5, height: 0.5 });
      await vi.waitFor(() => expect(lastGeometry(api)?.crop.width).toBe(0.5));
      expect(api.renderPreview.mock.calls.length).toBeGreaterThan(1);
    });

    it("shows the whole photo without a frame around it while the cadre is being set", async () => {
      const { api, editor, geometry, frame } = await setup();
      editor.image.value = image("a");
      // Une nouvelle photo remet le cadrage à zéro : on règle le cadre une fois la photo ouverte.
      await nextTick();
      frame.applyFrame("film35");
      geometry.setCrop({ x: 0.1, y: 0.1, width: 0.5, height: 0.5 });
      await vi.waitFor(() => expect(lastGeometry(api)?.crop.width).toBe(0.5));
      expect(lastFrame(api)?.id).toBe("film35");

      geometry.startCropping();

      await vi.waitFor(() => expect(lastGeometry(api)?.crop.width).toBe(1));
      expect(lastFrame(api)?.id).toBe("none");

      geometry.stopCropping();

      await vi.waitFor(() => expect(lastGeometry(api)?.crop.width).toBe(0.5));
      expect(lastFrame(api)?.id).toBe("film35");
    });

    it("renders again after a quarter turn", async () => {
      const { api, editor, geometry } = await setup();
      editor.image.value = image("a");
      await vi.waitFor(() => expect(api.renderPreview).toHaveBeenCalledTimes(1));

      geometry.rotate(true);

      await vi.waitFor(() => expect(lastGeometry(api)?.quarterTurns).toBe(1));
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

  /// Chaque rendu fait avancer une horloge fictive de `milliseconds` : la durée mesurée est exacte.
  function withRenderTime(api: Awaited<ReturnType<typeof setup>>["api"]) {
    let clock = 0;
    vi.spyOn(performance, "now").mockImplementation(() => clock);
    return (milliseconds: number) =>
      api.renderPreview.mockImplementation(() => {
        clock += milliseconds;
        return Promise.resolve(result("timed"));
      });
  }

  it("draws a quick draft while dragging once full renders have proved slow, then the full render on release", async () => {
    const { api, editor, look, render } = await setup();
    const { beginDrag } = await import("@/shared/lib/useInteraction");
    const renderTakes = withRenderTime(api);
    renderTakes(DRAFT_THRESHOLD_MS * 3);
    editor.image.value = image("a");
    await vi.waitFor(() => expect(render.view.src).toBe("render-timed"));
    api.renderPreview.mockClear();

    const release = beginDrag();
    look.setParam("exposure", 0.4);
    await vi.waitFor(() => expect(api.renderPreview).toHaveBeenCalled());
    expect(api.renderPreview.mock.calls.at(-1)?.[4]).toBe(true);
    await vi.waitFor(() => expect(render.view.draft).toBe(true));

    release();

    await vi.waitFor(() => expect(api.renderPreview.mock.calls.at(-1)?.[4]).toBe(false));
    await vi.waitFor(() => expect(render.view.draft).toBe(false));
  });

  it("never draws a draft while full renders keep up, so the image does not blur", async () => {
    const { api, editor, look, render } = await setup();
    const { beginDrag } = await import("@/shared/lib/useInteraction");
    const renderTakes = withRenderTime(api);
    renderTakes(DRAFT_THRESHOLD_MS / 2);
    editor.image.value = image("a");
    await vi.waitFor(() => expect(render.view.src).toBe("render-timed"));
    api.renderPreview.mockClear();

    const release = beginDrag();
    for (const value of [0.1, 0.2, 0.3]) {
      look.setParam("exposure", value);
      await vi.waitFor(() => expect(params(api)).toBeCloseTo(value));
    }
    release();

    for (const call of api.renderPreview.mock.calls) expect(call[4]).toBe(false);
    expect(render.view.draft).toBe(false);
  });

  it("goes back to full quality once renders are fast again", async () => {
    const { api, editor, look, render } = await setup();
    const { beginDrag } = await import("@/shared/lib/useInteraction");
    const renderTakes = withRenderTime(api);
    renderTakes(DRAFT_THRESHOLD_MS * 3);
    editor.image.value = image("a");
    await vi.waitFor(() => expect(render.view.src).toBe("render-timed"));

    renderTakes(5);
    for (const value of [0.1, 0.2, 0.3, 0.4]) {
      look.setParam("exposure", value);
      await vi.waitFor(() => expect(params(api)).toBeCloseTo(value));
    }
    api.renderPreview.mockClear();

    const release = beginDrag();
    look.setParam("exposure", 0.5);
    await vi.waitFor(() => expect(api.renderPreview).toHaveBeenCalled());
    release();

    expect(api.renderPreview.mock.calls.at(-1)?.[4]).toBe(false);
  });

  it("renders in full quality when nothing is being dragged", async () => {
    const { api, editor, look } = await setup();
    editor.image.value = image("a");
    look.setParam("exposure", 0.4);

    await vi.waitFor(() => expect(api.renderPreview).toHaveBeenCalled());

    for (const call of api.renderPreview.mock.calls) expect(call[4]).toBe(false);
  });

  it("forgets the draft flag the moment another photo is opened", async () => {
    const { api, editor, look, render } = await setup();
    const { beginDrag } = await import("@/shared/lib/useInteraction");
    const renderTakes = withRenderTime(api);
    renderTakes(DRAFT_THRESHOLD_MS * 3);
    editor.image.value = image("a");
    await vi.waitFor(() => expect(render.view.src).toBe("render-timed"));
    const release = beginDrag();
    look.setParam("exposure", 0.4);
    await vi.waitFor(() => expect(render.view.draft).toBe(true));

    api.renderPreview.mockReturnValue(deferred<PreviewResult>().promise);
    editor.image.value = image("b");
    await nextTick();

    expect(render.view).toMatchObject({ src: "raw-b", draft: false });
    release();
  });
});
