import { describe, expect, it } from "vitest";

import type { Preset } from "@/shared/api/api";
import { NEUTRAL_PARAMS } from "@/test/fixtures";
import { isFlat } from "@/features/looks/curves";
import { fresh } from "@/test/fresh";

const portrait: Preset = {
  id: "portrait",
  name: "Portrait",
  category: "Négatif",
  description: "",
  params: { ...NEUTRAL_PARAMS, exposure: 1, contrast: -0.4, grainSize: 4 },
};

async function setup() {
  const { useLook } = await fresh(() => import("@/features/looks/useLook"));
  return useLook();
}

describe("useLook", () => {
  it("starts neutral", async () => {
    const look = await setup();

    expect(look.params.value).toEqual(NEUTRAL_PARAMS);
    expect(look.activePreset.value).toBe("neutral");
    expect(look.amount.value).toBe(1);
  });

  it("applies a preset at full strength", async () => {
    const look = await setup();
    look.applyPreset(portrait);

    expect(look.params.value).toMatchObject({ exposure: 1, contrast: -0.4, grainSize: 4 });
    expect(look.activePreset.value).toBe("portrait");
  });

  it("scales the preset between neutral and itself with the amount", async () => {
    const look = await setup();
    look.applyPreset(portrait);
    look.amount.value = 0.5;

    expect(look.params.value.exposure).toBeCloseTo(0.5);
    expect(look.params.value.contrast).toBeCloseTo(-0.2);
    // grainSize part de 2 (le neutre), pas de 0 : 2 + (4 − 2) × 0,5.
    expect(look.params.value.grainSize).toBeCloseTo(3);

    look.amount.value = 0;
    expect(look.params.value).toEqual(NEUTRAL_PARAMS);
  });

  it("moving a slider sets the effective value and leaves the preset alone", async () => {
    const look = await setup();
    look.applyPreset(portrait);
    look.setParam("exposure", 1.5);

    expect(look.params.value.exposure).toBeCloseTo(1.5);
    expect(look.params.value.contrast).toBeCloseTo(-0.4);
    expect(look.activePreset.value).toBe("portrait");
  });

  it("keeps manual adjustments when the amount changes", async () => {
    const look = await setup();
    look.applyPreset(portrait);
    look.setParam("exposure", 1.2);
    look.amount.value = 0.5;

    // preset × intensité (0,5) + retouche (+0,2)
    expect(look.params.value.exposure).toBeCloseTo(0.7);
  });

  it("clamps the effective value to the slider range", async () => {
    const look = await setup();
    look.setParam("exposure", 99);
    expect(look.params.value.exposure).toBe(3);

    look.setParam("exposure", -99);
    expect(look.params.value.exposure).toBe(-3);
  });

  it("choosing another preset drops the previous adjustments", async () => {
    const look = await setup();
    look.setParam("exposure", 2);
    look.applyPreset(portrait);

    expect(look.params.value.exposure).toBeCloseTo(1);
    expect(look.amount.value).toBe(1);
  });

  it("resets everything", async () => {
    const look = await setup();
    look.applyPreset(portrait);
    look.amount.value = 0.4;
    look.setParam("contrast", 0.9);
    look.resetLook();

    expect(look.params.value).toEqual(NEUTRAL_PARAMS);
    expect(look.activePreset.value).toBe("neutral");
    expect(look.amount.value).toBe(1);
  });

  describe("isPristine", () => {
    it("is true until something is applied", async () => {
      const look = await setup();

      expect(look.isPristine.value).toBe(true);
    });

    it("sees a preset, a manual adjustment and a curve, each on its own", async () => {
      const preset = await setup();
      preset.applyPreset(portrait);
      expect(preset.isPristine.value).toBe(false);

      const adjusted = await setup();
      adjusted.setParam("exposure", 0.2);
      expect(adjusted.isPristine.value).toBe(false);

      const curved = await setup();
      curved.setCurve("rgb", [
        [0, 0],
        [0.5, 0.6],
        [1, 1],
      ]);
      expect(curved.isPristine.value).toBe(false);
    });

    it("comes back with a reset, and a flat curve edit does not count", async () => {
      const look = await setup();
      look.applyPreset(portrait);
      look.setParam("contrast", 0.3);
      look.resetLook();
      expect(look.isPristine.value).toBe(true);

      look.setCurve("red", []);
      expect(look.isPristine.value).toBe(true);
    });
  });

  it("restores a snapshot exactly, adjustments and amount included", async () => {
    const look = await setup();
    look.applyPreset(portrait);
    look.amount.value = 0.6;
    look.setParam("exposure", 0.9);
    const snapshot = look.snapshot();
    const expected = { ...look.params.value };

    look.resetLook();
    look.restore(snapshot);

    expect(look.params.value).toEqual(expected);
    expect(look.activePreset.value).toBe("portrait");
    expect(look.amount.value).toBe(0.6);
  });

  it("snapshots are independent copies", async () => {
    const look = await setup();
    const snapshot = look.snapshot();
    look.setParam("exposure", 2);

    expect(snapshot.adjustments.exposure).toBe(0);
  });

  describe("tone curves", () => {
    const filmic: Preset = {
      ...portrait,
      params: {
        ...NEUTRAL_PARAMS,
        curves: {
          rgb: [
            [0, 0.1],
            [0.5, 0.7],
            [1, 1],
          ],
          red: [],
          green: [],
          blue: [],
        },
      },
    };

    it("are neutral by default", async () => {
      const look = await setup();

      expect(look.params.value.curves).toEqual({ rgb: [], red: [], green: [], blue: [] });
    });

    it("come with a preset at full strength, and fade to neutral with its intensity", async () => {
      const look = await setup();
      look.applyPreset(filmic);
      expect(look.params.value.curves.rgb).toEqual([
        [0, 0.1],
        [0.5, 0.7],
        [1, 1],
      ]);

      look.amount.value = 0.5;
      expect(look.params.value.curves.rgb[1]).toEqual([0.5, 0.6]);

      look.amount.value = 0;
      expect(isFlat(look.params.value.curves.rgb)).toBe(true);
    });

    it("are replaced, one channel at a time, by a manual edit", async () => {
      const look = await setup();
      look.applyPreset(filmic);
      look.setCurve("red", [
        [0, 0],
        [0.5, 0.4],
        [1, 1],
      ]);

      expect(look.params.value.curves.red).toEqual([
        [0, 0],
        [0.5, 0.4],
        [1, 1],
      ]);
      expect(look.params.value.curves.rgb).toEqual(filmic.params.curves.rgb);
      expect(look.params.value.curves.blue).toEqual([]);
    });

    it("an edit takes the curve over from the preset's intensity", async () => {
      const look = await setup();
      look.applyPreset(filmic);
      look.setCurve("rgb", [
        [0, 0],
        [0.5, 0.55],
        [1, 1],
      ]);
      look.amount.value = 0.2;

      expect(look.params.value.curves.rgb[1]).toEqual([0.5, 0.55]);
    });

    it("an empty edit flattens the curve, even a preset's", async () => {
      const look = await setup();
      look.applyPreset(filmic);
      look.setCurve("rgb", []);

      expect(look.params.value.curves.rgb).toEqual([]);
    });

    it("a new preset or a reset drops the edits", async () => {
      const look = await setup();
      look.setCurve("blue", [
        [0, 0.2],
        [1, 1],
      ]);
      look.applyPreset(portrait);
      expect(look.params.value.curves.blue).toEqual([]);

      look.setCurve("blue", [
        [0, 0.2],
        [1, 1],
      ]);
      look.resetLook();
      expect(look.params.value.curves.blue).toEqual([]);
    });

    it("travel with undo snapshots, as independent copies", async () => {
      const look = await setup();
      look.setCurve("green", [
        [0, 0],
        [0.5, 0.6],
        [1, 1],
      ]);
      const snapshot = look.snapshot();

      look.setCurve("green", [
        [0, 0],
        [0.5, 0.2],
        [1, 1],
      ]);
      look.restore(snapshot);
      expect(look.params.value.curves.green[1]).toEqual([0.5, 0.6]);

      const kept = look.snapshot();
      kept.curveEdits.green?.splice(1, 1);

      expect(look.params.value.curves.green).toHaveLength(3);
      expect(look.snapshot().curveEdits.green).toHaveLength(3);
    });
  });

  describe("preview", () => {
    it("shows the hovered look as a click would apply it, without touching the edit state", async () => {
      const look = await setup();
      look.applyPreset(portrait);
      look.amount.value = 0.5;
      look.setParam("contrast", 0.3);
      const before = look.snapshot();

      look.previewPreset({
        ...portrait,
        id: "other",
        params: { ...portrait.params, exposure: -1 },
      });

      expect(look.shown.value).toMatchObject({ exposure: -1, contrast: -0.4 });
      expect(look.params.value.exposure).toBeCloseTo(0.5);
      expect(look.snapshot()).toEqual(before);
      expect(look.activePreset.value).toBe("portrait");
    });

    it("goes back to the current look when the preview ends", async () => {
      const look = await setup();
      look.setParam("exposure", 0.4);

      look.previewPreset(portrait);
      look.previewPreset(null);

      expect(look.shown.value).toEqual(look.params.value);
    });
  });
});
