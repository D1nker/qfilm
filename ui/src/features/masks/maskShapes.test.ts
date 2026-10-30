import { describe, expect, it } from "vitest";

import type { MaskShape } from "@/shared/api/api";
import {
  MASK_KEYS,
  MAX_RADIUS,
  MIN_RADIUS,
  isIdle,
  moveLinear,
  moveLinearHandle,
  moveRadialCenter,
  neutralAdjust,
  newMask,
  ordinalOf,
  radialHandle,
  setRadialRadius,
} from "@/features/masks/maskShapes";

type Linear = Extract<MaskShape, { kind: "linear" }>;
type Radial = Extract<MaskShape, { kind: "radial" }>;

const linear = (from: [number, number], to: [number, number]): Linear => ({
  kind: "linear",
  from,
  to,
});
const radial = (overrides: Partial<Radial> = {}): Radial => ({
  kind: "radial",
  center: [0.5, 0.5],
  radius: [0.3, 0.2],
  angle: 0,
  feather: 0.5,
  ...overrides,
});

describe("a new mask", () => {
  it("starts neutral, so it changes nothing until a slider moves", () => {
    for (const kind of ["linear", "radial"] as const) {
      const mask = newMask(kind, "a");

      expect(mask.shape.kind).toBe(kind);
      expect(isIdle(mask.adjust)).toBe(true);
      expect(mask.invert).toBe(false);
    }
  });

  it("starts well inside the photo", () => {
    const { shape } = newMask("linear", "a") as { shape: Linear };
    const mask = newMask("radial", "b").shape as Radial;

    for (const value of [...shape.from, ...shape.to, ...mask.center]) {
      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("covers the ten settings of the engine's MaskAdjust", () => {
    expect(Object.keys(neutralAdjust()).sort()).toEqual([...MASK_KEYS].sort());
  });
});

describe("isIdle", () => {
  it("sees a moved slider, in either direction", () => {
    expect(isIdle({ ...neutralAdjust(), exposure: 0.2 })).toBe(false);
    expect(isIdle({ ...neutralAdjust(), tint: -0.2 })).toBe(false);
    expect(isIdle({ ...neutralAdjust(), exposure: 0.0004 })).toBe(true);
    expect(isIdle(neutralAdjust())).toBe(true);
  });
});

describe("a linear gradient", () => {
  it("moves a handle, which cannot leave the photo", () => {
    const shape = linear([0.5, 0.2], [0.5, 0.6]);

    expect(moveLinearHandle(shape, "to", { x: 0.3, y: 0.9 })).toMatchObject({ to: [0.3, 0.9] });
    expect(moveLinearHandle(shape, "from", { x: -1, y: 4 })).toMatchObject({ from: [0, 1] });
  });

  it("leaves the other handle where it was", () => {
    const shape = linear([0.5, 0.2], [0.5, 0.6]);

    expect(moveLinearHandle(shape, "to", { x: 0.1, y: 0.1 })).toMatchObject({ from: [0.5, 0.2] });
  });

  it("moves as a whole, and stops when a handle reaches the edge", () => {
    const shape = linear([0.4, 0.2], [0.6, 0.6]);

    expect(moveLinear(shape, 0.1, 0.1)).toMatchObject({ from: [0.5, 0.3], to: [0.7, 0.7] });

    const stopped = moveLinear(shape, 0.9, 0.9) as Linear;
    expect(stopped.to).toEqual([1, 1]);
    expect(stopped.to[0] - stopped.from[0]).toBeCloseTo(0.2);
    expect(stopped.to[1] - stopped.from[1]).toBeCloseTo(0.4);
  });
});

describe("a radial mask", () => {
  it("moves its centre, which cannot leave the photo", () => {
    expect(moveRadialCenter(radial(), { x: 0.2, y: 0.7 })).toMatchObject({ center: [0.2, 0.7] });
    expect(moveRadialCenter(radial(), { x: 2, y: -2 })).toMatchObject({ center: [1, 0] });
  });

  it("puts its handles on the ends of its axes, square photo", () => {
    const shape = radial({ radius: [0.3, 0.2] });

    expect(radialHandle(shape, 0, 1)).toEqual({ x: 0.8, y: 0.5 });
    expect(radialHandle(shape, 1, 1)).toEqual({ x: 0.5, y: 0.7 });
  });

  it("measures the vertical in heights: on a wide photo the same radius is a shorter fraction", () => {
    // Photo 3:2 : une hauteur vaut 2/3 de largeur, donc 0,2 largeur = 0,3 hauteur.
    const shape = radial({ radius: [0.3, 0.2] });

    expect(radialHandle(shape, 1, 2 / 3).y).toBeCloseTo(0.5 + 0.2 / (2 / 3));
  });

  it("follows the rotation of the ellipse", () => {
    const upright = radial({ angle: 90, radius: [0.3, 0.2] });

    const long = radialHandle(upright, 0, 1);
    expect(long.x).toBeCloseTo(0.5);
    expect(long.y).toBeCloseTo(0.8);
  });

  it("gives back the radius when a handle is dragged onto its own position, whatever the angle and photo shape", () => {
    for (const angle of [0, 30, -75, 90, 180]) {
      for (const aspect of [1, 2 / 3, 1.5]) {
        for (const axis of [0, 1] as const) {
          const shape = radial({ angle, radius: [0.25, 0.15], center: [0.45, 0.5] });
          const handle = radialHandle(shape, axis, aspect);

          const back = setRadialRadius(shape, axis, handle, aspect) as Radial;

          expect(back.radius[axis]).toBeCloseTo(shape.radius[axis], 3);
          expect(back.radius[axis === 0 ? 1 : 0]).toBe(shape.radius[axis === 0 ? 1 : 0]);
        }
      }
    }
  });

  it("grows when its handle is pulled away, and never below a thread or above the photo", () => {
    const shape = radial();

    const grown = setRadialRadius(shape, 0, { x: 0.95, y: 0.5 }, 1) as Radial;
    expect(grown.radius[0]).toBeCloseTo(0.45);

    const crushed = setRadialRadius(shape, 0, { x: 0.2, y: 0.5 }, 1) as Radial;
    expect(crushed.radius[0]).toBe(MIN_RADIUS);

    const huge = setRadialRadius(shape, 0, { x: 40, y: 0.5 }, 1) as Radial;
    expect(huge.radius[0]).toBe(MAX_RADIUS);
  });
});

describe("ordinalOf", () => {
  it("counts masks of the same shape only", () => {
    const [a, b, c] = [newMask("linear", "a"), newMask("radial", "b"), newMask("linear", "c")];
    const all = [a, b, c];

    expect([a, b, c].map((mask) => ordinalOf(all, mask))).toEqual([1, 1, 2]);
  });
});
