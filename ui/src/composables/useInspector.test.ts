import { describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";

import type { ImageMeta } from "@/lib/api";
import { fresh } from "@/test/fresh";

vi.mock("@/lib/api", async () => (await import("@/test/apiMock")).apiMock());
vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({ onDragDropEvent: vi.fn() }),
}));

const meta = (id: string): ImageMeta => ({
  id,
  fileName: `${id}.jpg`,
  width: 6000,
  height: 4000,
  preview: `data:${id}`,
});

async function setup() {
  const { useInspector } = await fresh(() => import("@/composables/useInspector"));
  const { useEditor } = await import("@/composables/useEditor");
  const api = vi.mocked(await import("@/lib/api"));
  api.presetThumbnails.mockResolvedValue([]);
  return { api, inspector: useInspector(), editor: useEditor() };
}

describe("useInspector", () => {
  it("starts folded while there is no photo", async () => {
    const { inspector } = await setup();

    expect(inspector.open.value).toBe(false);
  });

  it("unfolds when the first photo opens", async () => {
    const { api, inspector, editor } = await setup();
    api.openImage.mockResolvedValue(meta("a"));

    await editor.load("/a.jpg");
    await nextTick();

    expect(inspector.open.value).toBe(true);
  });

  it("leaves a panel the user folded alone when another photo replaces the first", async () => {
    const { api, inspector, editor } = await setup();
    api.openImage.mockResolvedValueOnce(meta("a")).mockResolvedValueOnce(meta("b"));
    await editor.load("/a.jpg");
    await nextTick();

    inspector.toggle();
    await editor.load("/b.jpg");
    await nextTick();

    expect(inspector.open.value).toBe(false);
  });

  it("lets the user unfold it before any photo is open", async () => {
    const { inspector } = await setup();

    inspector.toggle();

    expect(inspector.open.value).toBe(true);
  });
});
