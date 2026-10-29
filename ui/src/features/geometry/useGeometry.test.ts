import { describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";

import type { ImageMeta } from "@/shared/api/api";
import { fits, isWhole } from "@/features/geometry/crop";
import { fresh } from "@/test/fresh";

vi.mock("@/shared/api/api", async () => (await import("@/test/apiMock")).apiMock());
vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({ onDragDropEvent: vi.fn() }),
}));

const photo = (id: string, width = 300, height = 200): ImageMeta => ({
  id,
  fileName: `${id}.jpg`,
  width,
  height,
  preview: `raw-${id}`,
});

async function setup() {
  const { useGeometry } = await fresh(() => import("@/features/geometry/useGeometry"));
  const { useEditor } = await import("@/features/photo");
  const { useInspector } = await import("@/features/inspector");
  const editor = useEditor();
  editor.image.value = photo("a");
  await nextTick();
  return { geometry: useGeometry(), editor, inspector: useInspector() };
}

describe("useGeometry", () => {
  it("starts untouched, and sends nothing to crop", async () => {
    const { geometry } = await setup();

    expect(geometry.modified.value).toBe(false);
    expect(geometry.geometry.value).toEqual({
      quarterTurns: 0,
      flipHorizontal: false,
      flipVertical: false,
      angle: 0,
      crop: { x: 0, y: 0, width: 1, height: 1 },
    });
  });

  it("shows the whole photo while the cadre is being set, and the real cadre otherwise", async () => {
    const { geometry } = await setup();
    geometry.setCrop({ x: 0.1, y: 0.1, width: 0.5, height: 0.5 });

    geometry.startCropping();
    expect(isWhole(geometry.previewGeometry.value.crop)).toBe(true);
    expect(geometry.geometry.value.crop.width).toBe(0.5);

    geometry.stopCropping();
    expect(geometry.previewGeometry.value.crop.width).toBe(0.5);
  });

  it("any geometry control switches to cropping", async () => {
    for (const touch of [
      (g: Awaited<ReturnType<typeof setup>>["geometry"]) => g.rotate(true),
      (g: Awaited<ReturnType<typeof setup>>["geometry"]) => g.flip("horizontal"),
      (g: Awaited<ReturnType<typeof setup>>["geometry"]) => g.setAngle(2),
      (g: Awaited<ReturnType<typeof setup>>["geometry"]) => g.setAspect("1:1"),
    ]) {
      const { geometry } = await setup();
      touch(geometry);

      expect(geometry.cropping.value).toBe(true);
    }
  });

  describe("quarter turns", () => {
    it("swap the canvas and carry the cadre with the photo", async () => {
      const { geometry } = await setup();
      geometry.setCrop({ x: 0.1, y: 0.2, width: 0.3, height: 0.5 });

      geometry.rotate(true);

      expect(geometry.canvas.value).toEqual({ width: 200, height: 300 });
      expect(geometry.geometry.value.quarterTurns).toBe(1);
      expect(geometry.crop.x).toBeCloseTo(0.3);
      expect(geometry.crop.y).toBeCloseTo(0.1);
      expect(geometry.crop.width).toBeCloseTo(0.5);
    });

    it("come back with the opposite turn, and four make none", async () => {
      const { geometry } = await setup();

      geometry.rotate(false);
      expect(geometry.geometry.value.quarterTurns).toBe(3);
      geometry.rotate(true);
      expect(geometry.geometry.value.quarterTurns).toBe(0);

      for (let turn = 0; turn < 4; turn++) geometry.rotate(true);
      expect(geometry.geometry.value.quarterTurns).toBe(0);
      expect(geometry.canvas.value).toEqual({ width: 300, height: 200 });
    });
  });

  describe("flips", () => {
    it("mirror the cadre and the tilt, as seen on screen", async () => {
      const { geometry } = await setup();
      geometry.setAngle(3);
      geometry.setCrop({ x: 0.1, y: 0.1, width: 0.3, height: 0.3 });

      geometry.flip("horizontal");

      expect(geometry.geometry.value.flipHorizontal).toBe(true);
      expect(geometry.crop.x).toBeCloseTo(0.6);
      expect(geometry.angle.value).toBe(-3);
    });

    it("act on the other axis of the source once the photo is on its side", async () => {
      const { geometry } = await setup();
      geometry.rotate(true);

      geometry.flip("horizontal");

      expect(geometry.geometry.value).toMatchObject({ flipHorizontal: false, flipVertical: true });

      geometry.flip("vertical");
      expect(geometry.geometry.value).toMatchObject({ flipHorizontal: true, flipVertical: true });
    });
  });

  describe("straightening", () => {
    it("keeps the cadre inside the photo as the angle grows", async () => {
      const { geometry } = await setup();

      geometry.setAngle(12);

      expect(fits(geometry.crop, geometry.canvas.value, 12)).toBe(true);
      expect(isWhole(geometry.crop)).toBe(false);
    });

    it("is limited to 45 degrees each way", async () => {
      const { geometry } = await setup();

      geometry.setAngle(99);
      expect(geometry.angle.value).toBe(45);
      geometry.setAngle(-99);
      expect(geometry.angle.value).toBe(-45);
    });

    it("gives back the room when the photo is levelled again", async () => {
      const { geometry } = await setup();
      geometry.setAngle(12);
      geometry.setAngle(0);

      // Le cadre ne regrossit pas tout seul : il reste là où l'a laissé le dernier angle.
      expect(fits(geometry.crop, geometry.canvas.value, 0)).toBe(true);
    });
  });

  describe("aspect ratio", () => {
    it("fills the photo with the largest cadre of that shape", async () => {
      const { geometry } = await setup();

      geometry.setAspect("1:1");

      expect(geometry.crop.height).toBeCloseTo(1, 4);
      expect(geometry.crop.width * 300).toBeCloseTo(200, 3);
    });

    it("lies down or stands up with the orientation swap", async () => {
      const { geometry } = await setup();
      geometry.setAspect("3:2");
      expect(geometry.ratio.value).toBeCloseTo(3 / 2);

      geometry.swapOrientation();

      expect(geometry.ratio.value).toBeCloseTo(2 / 3);
      expect((geometry.crop.width * 300) / (geometry.crop.height * 200)).toBeCloseTo(2 / 3, 3);
    });

    it("follows a quarter turn: 3:2 becomes 2:3 with the photo", async () => {
      const { geometry } = await setup();
      geometry.setAspect("3:2");

      geometry.rotate(true);

      expect(geometry.ratio.value).toBeCloseTo(2 / 3);
      const { width, height } = geometry.canvas.value;
      expect((geometry.crop.width * width) / (geometry.crop.height * height)).toBeCloseTo(2 / 3, 3);
    });

    it("stands the cadre up when the current one is already upright", async () => {
      const { geometry } = await setup();
      geometry.setCrop({ x: 0.3, y: 0, width: 0.3, height: 1 });

      geometry.setAspect("4:3");

      expect(geometry.ratio.value).toBeCloseTo(3 / 4);
    });
  });

  it("resets everything", async () => {
    const { geometry } = await setup();
    geometry.rotate(true);
    geometry.setAngle(5);
    geometry.setAspect("1:1");

    geometry.reset();

    expect(geometry.modified.value).toBe(false);
    expect(geometry.aspect.value).toBe("free");
    expect(geometry.canvas.value).toEqual({ width: 300, height: 200 });
  });

  it("travels with undo snapshots, as an independent copy", async () => {
    const { geometry } = await setup();
    geometry.rotate(true);
    geometry.setAngle(4);
    const snapshot = geometry.snapshot();

    geometry.reset();
    geometry.restore(snapshot);

    expect(geometry.geometry.value.quarterTurns).toBe(1);
    expect(geometry.angle.value).toBe(4);

    snapshot.crop.width = 0.1;
    expect(geometry.crop.width).not.toBe(0.1);
  });

  it("starts afresh with another photo", async () => {
    const { geometry, editor } = await setup();
    geometry.rotate(true);
    geometry.setAngle(5);

    editor.image.value = photo("b");
    await nextTick();

    expect(geometry.modified.value).toBe(false);
    expect(geometry.cropping.value).toBe(false);
  });

  it("stops cropping when the Frame tab is left", async () => {
    const { geometry, inspector } = await setup();
    inspector.tab.value = "frame";
    geometry.startCropping();

    inspector.tab.value = "adjust";
    await nextTick();

    expect(geometry.cropping.value).toBe(false);
  });
});
