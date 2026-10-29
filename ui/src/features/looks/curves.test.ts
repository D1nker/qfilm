import { describe, expect, it } from "vitest";

import {
  MAX_POINTS,
  MIN_GAP,
  addPoint,
  evalCurve,
  flatCurves,
  isFlat,
  movePoint,
  nudgePoint,
  pointsOf,
  removePoint,
  sampleCurve,
  scaleCurve,
  type CurvePoint,
} from "@/features/looks/curves";

const S: CurvePoint[] = [
  [0, 0],
  [0.25, 0.18],
  [0.75, 0.82],
  [1, 1],
];

describe("pointsOf / isFlat", () => {
  it("shows a neutral curve as the diagonal, as a copy", () => {
    const shown = pointsOf([]);

    expect(shown).toEqual([
      [0, 0],
      [1, 1],
    ]);
    shown[0] = [0, 0.5];
    expect(pointsOf([])[0]).toEqual([0, 0]);
  });

  it("sees an empty list, the diagonal and a diagonal with extra points as flat", () => {
    expect(isFlat([])).toBe(true);
    expect(isFlat(pointsOf([]))).toBe(true);
    expect(
      isFlat([
        [0, 0],
        [0.4, 0.4],
        [1, 1],
      ]),
    ).toBe(true);
    expect(isFlat(S)).toBe(false);
    expect(
      isFlat([
        [0, 0.05],
        [1, 1],
      ]),
    ).toBe(false);
  });

  it("starts with four neutral curves", () => {
    expect(flatCurves()).toEqual({ rgb: [], red: [], green: [], blue: [] });
  });
});

describe("movePoint", () => {
  it("moves an inner point, keeping it between its neighbours", () => {
    expect(movePoint(S, 1, 0.3, 0.2)[1]).toEqual([0.3, 0.2]);
    expect(movePoint(S, 1, 0.9, 0.2)[1]?.[0]).toBeCloseTo(0.75 - MIN_GAP);
    expect(movePoint(S, 2, -1, 0.2)[2]?.[0]).toBeCloseTo(0.25 + MIN_GAP);
  });

  it("keeps the values within the graph", () => {
    expect(movePoint(S, 1, 0.3, 4)[1]?.[1]).toBe(1);
    expect(movePoint(S, 1, 0.3, -4)[1]?.[1]).toBe(0);
  });

  it("only slides the two ends vertically", () => {
    expect(movePoint(S, 0, 0.4, 0.2)[0]).toEqual([0, 0.2]);
    expect(movePoint(S, 3, 0.4, 0.7)[3]).toEqual([1, 0.7]);
  });

  it("does not touch the input", () => {
    const before = JSON.stringify(S);
    movePoint(S, 1, 0.3, 0.3);

    expect(JSON.stringify(S)).toBe(before);
  });
});

describe("addPoint / removePoint", () => {
  it("inserts a point in order and says where", () => {
    const added = addPoint(S, 0.5, 0.5);

    expect(added?.index).toBe(2);
    expect(added?.points.map(([x]) => x)).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });

  it("refuses a spot too close to another point, or beyond the ends", () => {
    expect(addPoint(S, 0.25 + MIN_GAP / 2, 0.5)).toBeNull();
    expect(addPoint(S, 0.75 - MIN_GAP / 2, 0.5)).toBeNull();
    expect(addPoint(S, 0, 0.5)).toBeNull();
    expect(addPoint(S, 1, 0.5)).toBeNull();
    expect(addPoint(S, 1.4, 0.5)).toBeNull();
  });

  it("stops at the maximum number of points", () => {
    const full: CurvePoint[] = Array.from({ length: MAX_POINTS }, (_, i) => [
      i / (MAX_POINTS - 1),
      i / (MAX_POINTS - 1),
    ]);

    expect(addPoint(full, 0.5 / MAX_POINTS, 0.5)).toBeNull();
  });

  it("removes an inner point but never an end", () => {
    expect(removePoint(S, 1)?.map(([x]) => x)).toEqual([0, 0.75, 1]);
    expect(removePoint(S, 0)).toBeNull();
    expect(removePoint(S, 3)).toBeNull();
  });
});

describe("nudgePoint", () => {
  it("moves with the arrows, by a small step, or a big one with Shift", () => {
    expect(nudgePoint(S, 1, "ArrowUp", true)?.[1]).toEqual([0.25, 0.19]);
    expect(nudgePoint(S, 1, "ArrowDown", true)?.[1]).toEqual([0.25, 0.17]);
    expect(nudgePoint(S, 1, "ArrowRight", true)?.[1]).toEqual([0.26, 0.18]);
    expect(nudgePoint(S, 1, "ArrowLeft", false)?.[1]).toEqual([0.2, 0.18]);
  });

  it("ignores other keys", () => {
    expect(nudgePoint(S, 1, "a", true)).toBeNull();
  });
});

describe("evalCurve", () => {
  // Les mêmes valeurs que le test Rust `the_curve_matches_the_reference_values…`, calculées à part.
  it("agrees with the engine", () => {
    const curve: CurvePoint[] = [
      [0, 0.1],
      [0.3, 0.2],
      [0.7, 0.9],
      [1, 0.95],
    ];

    for (const [x, expected] of [
      [0.05, 0.115215],
      [0.15, 0.142159],
      [0.5, 0.56248],
      [0.85, 0.929731],
      [0.95, 0.942543],
    ] as const) {
      expect(evalCurve(curve, x)).toBeCloseTo(expected, 5);
    }
  });

  it("passes through its points", () => {
    for (const [x, y] of S) expect(evalCurve(S, x)).toBeCloseTo(y, 6);
  });

  it("never overshoots a sharp step", () => {
    const step: CurvePoint[] = [
      [0, 0],
      [0.4, 0.05],
      [0.5, 0.95],
      [1, 1],
    ];

    let previous = 0;
    for (const [, y] of sampleCurve(step, 400)) {
      expect(y).toBeGreaterThanOrEqual(previous - 1e-9);
      expect(y).toBeLessThanOrEqual(1);
      previous = y;
    }
  });

  it("is the identity without a real curve", () => {
    expect(evalCurve([], 0.3)).toBeCloseTo(0.3);
  });
});

describe("scaleCurve", () => {
  const preset: CurvePoint[] = [
    [0, 0.1],
    [0.5, 0.7],
    [1, 1],
  ];

  it("brings a preset curve to the diagonal at 0 and keeps it whole at 1", () => {
    expect(scaleCurve(preset, 1)).toEqual(preset);
    expect(isFlat(scaleCurve(preset, 0))).toBe(true);
    expect(scaleCurve(preset, 0.5)[1]).toEqual([0.5, 0.6]);
  });

  it("leaves a neutral curve neutral", () => {
    expect(scaleCurve([], 0.5)).toEqual([]);
  });
});
