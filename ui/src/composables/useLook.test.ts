import { describe, expect, it } from "vitest";

import type { Preset } from "@/lib/api";
import { NEUTRAL_PARAMS } from "@/test/fixtures";
import { fresh } from "@/test/fresh";

const portrait: Preset = {
  id: "portrait",
  name: "Portrait",
  category: "Négatif",
  description: "",
  params: { ...NEUTRAL_PARAMS, exposure: 1, contrast: -0.4, grainSize: 4 },
};

async function setup() {
  const { useLook } = await fresh(() => import("@/composables/useLook"));
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
});
