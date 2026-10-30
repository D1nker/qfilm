import { describe, expect, it } from "vitest";

import { fresh } from "@/test/fresh";

async function setup() {
  const { useMasks } = await fresh(() => import("@/features/masks/useMasks"));
  const { useInspector } = await import("@/features/inspector");
  return { masks: useMasks(), inspector: useInspector() };
}

describe("useMasks", () => {
  it("starts with nothing", async () => {
    const { masks } = await setup();

    expect(masks.masks.value).toEqual([]);
    expect(masks.selected.value).toBeNull();
    expect(masks.active.value).toBe(false);
  });

  it("adds a mask and selects it, each one with its own id", async () => {
    const { masks } = await setup();

    masks.add("linear");
    masks.add("radial");

    expect(masks.masks.value.map((mask) => mask.shape.kind)).toEqual(["linear", "radial"]);
    expect(new Set(masks.masks.value.map((mask) => mask.id)).size).toBe(2);
    expect(masks.selected.value?.shape.kind).toBe("radial");
  });

  it("is not active until a slider has moved, so a fresh mask costs nothing", async () => {
    const { masks } = await setup();
    masks.add("linear");
    expect(masks.active.value).toBe(false);

    masks.setAdjust(masks.selectedId.value ?? "", "exposure", -0.5);

    expect(masks.active.value).toBe(true);
  });

  it("changes one setting without touching the others or the other masks", async () => {
    const { masks } = await setup();
    masks.add("linear");
    masks.add("radial");
    const [first, second] = masks.masks.value;

    masks.setAdjust(first?.id ?? "", "saturation", 0.4);
    masks.setInvert(first?.id ?? "", true);

    expect(masks.masks.value[0]?.adjust).toMatchObject({ saturation: 0.4, exposure: 0 });
    expect(masks.masks.value[0]?.invert).toBe(true);
    expect(masks.masks.value[1]).toEqual(second);
  });

  it("replaces the shape of a mask", async () => {
    const { masks } = await setup();
    masks.add("linear");
    const id = masks.selectedId.value ?? "";

    masks.setShape(id, { kind: "linear", from: [0, 0], to: [1, 1] });

    expect(masks.selected.value?.shape).toEqual({ kind: "linear", from: [0, 0], to: [1, 1] });
  });

  it("selects another mask, and ignores an id that does not exist", async () => {
    const { masks } = await setup();
    masks.add("linear");
    masks.add("radial");
    const first = masks.masks.value[0]?.id ?? "";

    masks.select(first);
    expect(masks.selectedId.value).toBe(first);

    masks.select("nope");
    expect(masks.selectedId.value).toBe(first);
  });

  describe("removing", () => {
    it("selects the next mask in its place, or the previous one at the end", async () => {
      const { masks } = await setup();
      for (const kind of ["linear", "radial", "linear"] as const) masks.add(kind);
      const [a, b, c] = masks.masks.value.map((mask) => mask.id);

      masks.select(b ?? "");
      masks.remove(b ?? "");
      expect(masks.selectedId.value).toBe(c);

      masks.remove(c ?? "");
      expect(masks.selectedId.value).toBe(a);

      masks.remove(a ?? "");
      expect(masks.selectedId.value).toBeNull();
      expect(masks.masks.value).toEqual([]);
    });

    it("keeps the selection when another mask goes", async () => {
      const { masks } = await setup();
      masks.add("linear");
      masks.add("radial");
      const [first, second] = masks.masks.value.map((mask) => mask.id);

      masks.remove(first ?? "");

      expect(masks.selectedId.value).toBe(second);
    });
  });

  it("resets to nothing", async () => {
    const { masks } = await setup();
    masks.add("linear");

    masks.reset();

    expect(masks.masks.value).toEqual([]);
    expect(masks.selected.value).toBeNull();
  });

  describe("undo snapshots", () => {
    it("are independent copies, in both directions", async () => {
      const { masks } = await setup();
      masks.add("radial");
      const id = masks.selectedId.value ?? "";
      masks.setAdjust(id, "exposure", 0.5);

      const snapshot = masks.snapshot();
      masks.setAdjust(id, "exposure", -1);
      expect(snapshot.masks[0]?.adjust.exposure).toBe(0.5);

      masks.restore(snapshot);
      expect(masks.selected.value?.adjust.exposure).toBe(0.5);

      masks.setAdjust(id, "exposure", 1);
      expect(snapshot.masks[0]?.adjust.exposure).toBe(0.5);
    });

    it("leave out which mask is selected: choosing one is not an edit to undo", async () => {
      const { masks } = await setup();
      masks.add("linear");
      masks.add("radial");
      const before = JSON.stringify(masks.snapshot());

      masks.select(masks.masks.value[0]?.id ?? "");

      expect(JSON.stringify(masks.snapshot())).toBe(before);
    });

    it("keep the selection on a mask that still exists, and fall back to the last one", async () => {
      const { masks } = await setup();
      masks.add("linear");
      const one = masks.snapshot();
      masks.add("radial");
      const two = masks.snapshot();
      const [first, second] = masks.masks.value.map((mask) => mask.id);

      masks.select(first ?? "");
      masks.restore(two);
      expect(masks.selectedId.value).toBe(first);

      masks.select(second ?? "");
      masks.restore(one);
      expect(masks.selectedId.value).toBe(first);
    });

    it("bring back a deleted mask", async () => {
      const { masks } = await setup();
      masks.add("linear");
      const before = masks.snapshot();

      masks.remove(masks.selectedId.value ?? "");
      expect(masks.masks.value).toEqual([]);

      masks.restore(before);
      expect(masks.masks.value).toHaveLength(1);
      expect(masks.selected.value).not.toBeNull();
    });
  });

  it("is editing only while the masks page of the Retouche section is shown", async () => {
    const { masks, inspector } = await setup();
    expect(masks.editing.value).toBe(false);

    inspector.tab.value = "adjust";
    inspector.group.adjust = "masks";
    expect(masks.editing.value).toBe(true);

    inspector.group.adjust = "tone";
    expect(masks.editing.value).toBe(false);

    inspector.group.adjust = "masks";
    inspector.tab.value = "frame";
    expect(masks.editing.value).toBe(false);
  });
});
