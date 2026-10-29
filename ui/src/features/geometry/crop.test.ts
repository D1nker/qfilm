import { describe, expect, it } from "vitest";

import {
  MIN_SIDE,
  WHOLE,
  aspectRatio,
  fitInside,
  fits,
  isWhole,
  largestRect,
  mirrorHorizontally,
  mirrorVertically,
  move,
  resize,
  rotateClockwise,
  rotateCounterClockwise,
  type Rect,
} from "@/features/geometry/crop";

const canvas = { width: 300, height: 200 };
const free = { canvas, angle: 0, ratio: null };

const centered = (width: number, height: number): Rect => ({
  x: (1 - width) / 2,
  y: (1 - height) / 2,
  width,
  height,
});

const pixels = (rect: Rect) => ({
  width: rect.width * canvas.width,
  height: rect.height * canvas.height,
});

describe("fits", () => {
  it("accepts the whole canvas when the photo is level, and nothing beyond it", () => {
    expect(fits(WHOLE, canvas, 0)).toBe(true);
    expect(fits({ ...WHOLE, width: 1.1 }, canvas, 0)).toBe(false);
    expect(fits({ ...WHOLE, x: -0.1 }, canvas, 0)).toBe(false);
  });

  it("refuses the whole canvas once the photo is tilted: its corners would be empty", () => {
    expect(fits(WHOLE, canvas, 5)).toBe(false);
    expect(fits(WHOLE, canvas, -5)).toBe(false);
  });

  it("accepts a small cadre at the centre whatever the tilt", () => {
    expect(fits(centered(0.3, 0.3), canvas, 30)).toBe(true);
    expect(fits(centered(0.3, 0.3), canvas, -45)).toBe(true);
  });

  it("is symmetric: a cadre that fits at +a fits at -a", () => {
    const rect = centered(0.7, 0.7);

    expect(fits(rect, canvas, 12)).toBe(fits(rect, canvas, -12));
  });
});

describe("fitInside", () => {
  it("leaves a cadre that already fits alone", () => {
    const rect = centered(0.4, 0.4);

    expect(fitInside(rect, canvas, 8)).toEqual(rect);
  });

  it("shrinks the cadre around its centre, keeping its shape, as far as needed and no further", () => {
    const fitted = fitInside(WHOLE, canvas, 8);

    expect(fits(fitted, canvas, 8)).toBe(true);
    expect(fitted.width / fitted.height).toBeCloseTo(1, 6);
    expect(fitted.x + fitted.width / 2).toBeCloseTo(0.5, 6);
    expect(fits(centered(fitted.width * 1.02, fitted.height * 1.02), canvas, 8)).toBe(false);
  });

  it("brings a cadre pushed against the edge back towards the middle when it cannot fit there", () => {
    const corner: Rect = { x: 0.8, y: 0.8, width: 0.2, height: 0.2 };

    const fitted = fitInside(corner, canvas, 40);

    expect(fits(fitted, canvas, 40)).toBe(true);
    expect(fitted.width).toBeGreaterThan(0);
  });
});

describe("resize", () => {
  const rect: Rect = { x: 0.2, y: 0.2, width: 0.5, height: 0.5 };

  it("drags a corner to the pointer, the opposite corner staying put", () => {
    const next = resize(rect, "se", { x: 0.9, y: 0.8 }, free);

    expect(next).toMatchObject({ x: 0.2, y: 0.2 });
    expect(next.width).toBeCloseTo(0.7);
    expect(next.height).toBeCloseTo(0.6);
  });

  it("moves a single edge for an edge handle", () => {
    const next = resize(rect, "w", { x: 0.1, y: 0.9 }, free);

    expect(next.x).toBeCloseTo(0.1);
    expect(next.width).toBeCloseTo(0.6);
    expect(next.y).toBeCloseTo(0.2);
    expect(next.height).toBeCloseTo(0.5);
  });

  it("stops at the canvas and at the minimum size, and never turns inside out", () => {
    expect(resize(rect, "se", { x: 3, y: 3 }, free)).toMatchObject({ width: 0.8, height: 0.8 });

    const squashed = resize(rect, "se", { x: 0, y: 0 }, free);
    expect(squashed.width).toBeCloseTo(MIN_SIDE);
    expect(squashed.height).toBeCloseTo(MIN_SIDE);
  });

  it("keeps the ratio in pixels when it is locked, from a corner", () => {
    const next = resize(rect, "se", { x: 0.9, y: 0.5 }, { ...free, ratio: 1 });

    const size = pixels(next);
    expect(size.width / size.height).toBeCloseTo(1, 5);
    expect(next).toMatchObject({ x: 0.2, y: 0.2 });
  });

  it("keeps the ratio from an edge too, growing the other side around the middle", () => {
    const next = resize(rect, "e", { x: 0.8, y: 0.4 }, { ...free, ratio: 3 / 2 });

    const size = pixels(next);
    expect(size.width / size.height).toBeCloseTo(3 / 2, 5);
    expect(next.y + next.height / 2).toBeCloseTo(0.45, 5);
  });

  it("never leaves the tilted photo", () => {
    const start = fitInside(WHOLE, canvas, 20);

    for (const handle of ["nw", "ne", "se", "sw", "n", "e", "s", "w"] as const) {
      const next = resize(start, handle, { x: 5, y: -5 }, { ...free, angle: 20 });
      expect(fits(next, canvas, 20), handle).toBe(true);
    }
  });
});

describe("move", () => {
  it("shifts the cadre", () => {
    const next = move(centered(0.4, 0.4), 0.1, -0.1, free);

    expect(next.x).toBeCloseTo(0.4);
    expect(next.y).toBeCloseTo(0.2);
  });

  it("slides along an edge instead of sticking to it", () => {
    const atRight: Rect = { x: 0.6, y: 0.2, width: 0.4, height: 0.4 };

    const next = move(atRight, 0.3, 0.2, free);

    expect(next.x).toBeCloseTo(0.6);
    expect(next.y).toBeCloseTo(0.4);
  });

  it("stays inside a tilted photo", () => {
    const start = fitInside(centered(0.5, 0.5), canvas, 15);

    const next = move(start, 0.5, 0.5, { ...free, angle: 15 });

    expect(fits(next, canvas, 15)).toBe(true);
    expect(next.x).toBeGreaterThan(start.x);
  });
});

describe("largestRect", () => {
  it("is the whole photo for a free cadre on a level photo", () => {
    expect(isWhole(largestRect(null, { x: 0.5, y: 0.5 }, canvas, 0))).toBe(true);
  });

  it("is the largest square, centred, on a level 3:2 photo", () => {
    const square = largestRect(1, { x: 0.5, y: 0.5 }, canvas, 0);

    expect(square.height).toBeCloseTo(1, 5);
    expect(square.width).toBeCloseTo(2 / 3, 5);
    expect(square.x).toBeCloseTo(1 / 6, 5);
  });

  it("is smaller on a tilted photo, and still fits", () => {
    const level = largestRect(3 / 2, { x: 0.5, y: 0.5 }, canvas, 0);
    const tilted = largestRect(3 / 2, { x: 0.5, y: 0.5 }, canvas, 10);

    expect(tilted.width).toBeLessThan(level.width);
    expect(fits(tilted, canvas, 10)).toBe(true);
    const size = pixels(tilted);
    expect(size.width / size.height).toBeCloseTo(3 / 2, 4);
  });
});

describe("turning and mirroring the cadre with the photo", () => {
  const rect: Rect = { x: 0.1, y: 0.2, width: 0.3, height: 0.5 };

  it("turns it clockwise: its top-left corner goes to the top-right", () => {
    const turned = rotateClockwise(rect);
    expect([turned.x, turned.y, turned.width, turned.height]).toEqual([
      expect.closeTo(0.3),
      expect.closeTo(0.1),
      expect.closeTo(0.5),
      expect.closeTo(0.3),
    ]);
  });

  it("undoes a turn with the opposite one, and four turns make none", () => {
    const back = rotateCounterClockwise(rotateClockwise(rect));
    expect(back.x).toBeCloseTo(rect.x);
    expect(back.y).toBeCloseTo(rect.y);
    expect(back.width).toBeCloseTo(rect.width);

    const full = [1, 2, 3, 4].reduce((current) => rotateClockwise(current), rect);
    expect(full.x).toBeCloseTo(rect.x);
    expect(full.y).toBeCloseTo(rect.y);
    expect(full.height).toBeCloseTo(rect.height);
  });

  it("mirrors it, twice being the identity", () => {
    expect(mirrorHorizontally(rect).x).toBeCloseTo(0.6);
    expect(mirrorVertically(rect).y).toBeCloseTo(0.3);
    expect(mirrorHorizontally(mirrorHorizontally(rect)).x).toBeCloseTo(rect.x);
  });
});

describe("aspectRatio", () => {
  it("follows the photo for « original », and nothing for « free »", () => {
    expect(aspectRatio("original", canvas, false)).toBeCloseTo(1.5);
    expect(aspectRatio("free", canvas, false)).toBeNull();
  });

  it("gives the fixed formats in landscape, or on their side", () => {
    expect(aspectRatio("16:9", canvas, false)).toBeCloseTo(16 / 9);
    expect(aspectRatio("16:9", canvas, true)).toBeCloseTo(9 / 16);
    expect(aspectRatio("1:1", canvas, true)).toBe(1);
  });
});
