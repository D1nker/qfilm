import { describe, expect, it } from "vitest";

import { fromPoint, HUE_DEAD_ZONE, moveTo, nudge, pointFor } from "@/features/looks/wheel";

const near = (a: number, b: number, tolerance = 1e-6) => Math.abs(a - b) < tolerance;

describe("pointFor", () => {
  it("puts the hues round the wheel, clockwise from the top", () => {
    const top = pointFor({ hue: 0, saturation: 1 });
    expect(near(top.x, 0) && near(top.y, -1)).toBe(true);

    const right = pointFor({ hue: 90, saturation: 1 });
    expect(near(right.x, 1) && near(right.y, 0)).toBe(true);

    const bottom = pointFor({ hue: 180, saturation: 1 });
    expect(near(bottom.x, 0) && near(bottom.y, 1)).toBe(true);

    const left = pointFor({ hue: 270, saturation: 1 });
    expect(near(left.x, -1) && near(left.y, 0)).toBe(true);
  });

  it("puts any hue at the centre when the saturation is zero", () => {
    for (const hue of [0, 45, 200, 359]) {
      const point = pointFor({ hue, saturation: 0 });
      expect(near(point.x, 0) && near(point.y, 0)).toBe(true);
    }
  });

  it("scales the distance with the saturation", () => {
    const point = pointFor({ hue: 90, saturation: 0.4 });

    expect(near(point.x, 0.4)).toBe(true);
  });
});

describe("fromPoint", () => {
  it("reads the angle as a hue, and the distance as a saturation", () => {
    expect(fromPoint({ x: 0, y: -0.5 })).toEqual({ hue: 0, saturation: 0.5 });
    const right = fromPoint({ x: 1, y: 0 });
    expect(near(right.hue, 90) && near(right.saturation, 1)).toBe(true);
    const bottom = fromPoint({ x: 0, y: 0.25 });
    expect(near(bottom.hue, 180) && near(bottom.saturation, 0.25)).toBe(true);
    const left = fromPoint({ x: -0.6, y: 0 });
    expect(near(left.hue, 270) && near(left.saturation, 0.6)).toBe(true);
  });

  it("never returns a hue outside 0 to 360", () => {
    for (let x = -1; x <= 1; x += 0.1) {
      for (let y = -1; y <= 1; y += 0.1) {
        const { hue } = fromPoint({ x, y });
        expect(hue).toBeGreaterThanOrEqual(0);
        expect(hue).toBeLessThan(360);
      }
    }
  });

  it("stops at the edge of the wheel", () => {
    expect(fromPoint({ x: 3, y: 4 }).saturation).toBe(1);
  });

  it("is the inverse of pointFor", () => {
    for (const hue of [0, 17, 90, 133, 180, 271, 359]) {
      for (const saturation of [0.1, 0.5, 1]) {
        const back = fromPoint(pointFor({ hue, saturation }));
        expect(near(back.hue, hue, 1e-4), `${hue}°`).toBe(true);
        expect(near(back.saturation, saturation, 1e-6)).toBe(true);
      }
    }
  });
});

describe("moveTo", () => {
  it("follows the pointer", () => {
    const moved = moveTo({ x: 0.5, y: 0 }, { hue: 10, saturation: 0.1 });

    expect(near(moved.hue, 90)).toBe(true);
    expect(near(moved.saturation, 0.5)).toBe(true);
  });

  it("keeps the hue when the pointer is at the very centre, where the hue means nothing", () => {
    const moved = moveTo(
      { x: HUE_DEAD_ZONE / 4, y: HUE_DEAD_ZONE / 4 },
      { hue: 200, saturation: 0.6 },
    );

    expect(moved.hue).toBe(200);
    expect(moved.saturation).toBeLessThan(HUE_DEAD_ZONE);
  });
});

describe("nudge", () => {
  const start = { hue: 100, saturation: 0.5 };

  it("turns the hue with left and right, in coarse or fine steps", () => {
    expect(nudge(start, "ArrowRight", false)?.hue).toBe(110);
    expect(nudge(start, "ArrowLeft", false)?.hue).toBe(90);
    expect(nudge(start, "ArrowRight", true)?.hue).toBe(101);
  });

  it("goes round the wheel instead of stopping at its ends", () => {
    expect(nudge({ hue: 355, saturation: 0.5 }, "ArrowRight", false)?.hue).toBe(5);
    expect(nudge({ hue: 3, saturation: 0.5 }, "ArrowLeft", false)?.hue).toBe(353);
  });

  it("sets the saturation with up and down, within 0 to 1", () => {
    expect(nudge(start, "ArrowUp", false)?.saturation).toBeCloseTo(0.6);
    expect(nudge(start, "ArrowDown", true)?.saturation).toBeCloseTo(0.49);
    expect(nudge({ hue: 0, saturation: 0.98 }, "ArrowUp", false)?.saturation).toBe(1);
    expect(nudge({ hue: 0, saturation: 0.02 }, "ArrowDown", false)?.saturation).toBe(0);
  });

  it("ignores every other key", () => {
    expect(nudge(start, "a", false)).toBeNull();
    expect(nudge(start, "Enter", false)).toBeNull();
  });
});
