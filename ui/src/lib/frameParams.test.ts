import { describe, expect, it } from "vitest";

import type { ParamDef } from "@/lib/api";
import {
  coerce,
  decimalsOf,
  defaultParams,
  isVisible,
  optionSets,
  sectionsOf,
  selectionFor,
} from "@/lib/frameParams";
import { film35, noFrame, solid } from "@/test/fixtures";

const def = (id: string, frame = film35): ParamDef => {
  const found = frame.params.find((param) => param.id === id);
  if (!found) throw new Error(`réglage de test inconnu : ${id}`);
  return found;
};

describe("coerce", () => {
  it("clamps numbers to their bounds", () => {
    expect(coerce(def("width"), 999)).toBe(30);
    expect(coerce(def("width"), -5)).toBe(1);
    expect(coerce(def("width"), 12.5)).toBe(12.5);
  });

  it("falls back to the default for the wrong type", () => {
    expect(coerce(def("width"), "12")).toBe(14);
    expect(coerce(def("width"), Number.NaN)).toBe(14);
    expect(coerce(def("width"), Number.POSITIVE_INFINITY)).toBe(14);
    expect(coerce(def("sprockets"), "true")).toBe(true);
    expect(coerce(def("text"), 5)).toBe("PORTRAIT 400");
  });

  it("accepts #rrggbb colors, lowercased, and rejects anything else", () => {
    expect(coerce(def("color"), "#AABBCC")).toBe("#aabbcc");
    expect(coerce(def("color"), "red")).toBe("#120f0c");
    expect(coerce(def("color"), '"/><script>')).toBe("#120f0c");
    expect(coerce(def("color"), "#abc")).toBe("#120f0c");
  });

  it("truncates text to maxLength by characters, not UTF-16 units", () => {
    expect(coerce(def("frameNumber"), "x".repeat(40))).toBe("x".repeat(12));
    // « 🎞 » est un caractère hors du plan de base : 2 unités UTF-16, 1 caractère.
    const truncated = String(coerce(def("frameNumber"), "🎞".repeat(20)));
    expect([...truncated]).toHaveLength(12);
  });

  it("only accepts a declared choice", () => {
    expect(coerce(def("stock"), "green")).toBe("green");
    expect(coerce(def("stock"), "discontinued")).toBe("amber");
    expect(coerce(def("stock"), 3)).toBe("amber");
  });

  it("uses the default when there is no value", () => {
    expect(coerce(def("width"), undefined)).toBe(14);
  });
});

describe("optionSets", () => {
  it("returns what the chosen option imposes on other settings", () => {
    expect(optionSets(def("stock"), "green")).toEqual({
      color: "#0d1210",
      ink: "#6fce8a",
      text: "VERT VIF 400",
    });
  });

  it("is empty for an unknown option or a non-choice setting", () => {
    expect(optionSets(def("stock"), "nope")).toEqual({});
    expect(optionSets(def("width"), 5)).toEqual({});
  });
});

describe("selectionFor", () => {
  it("starts from the manifest defaults", () => {
    expect(selectionFor(solid, {})).toEqual({
      id: "solid",
      params: { width: 4, color: "#ffffff" },
    });
    expect(selectionFor(noFrame, {})).toEqual({ id: "none", params: {} });
  });

  it("restores persistent settings from memory, then applies what their choice imposes", () => {
    const { params } = selectionFor(film35, { stock: "green", frameNumber: "31B" });

    expect(params.stock).toBe("green");
    expect(params.frameNumber).toBe("31B");
    expect(params.color).toBe("#0d1210");
    expect(params.text).toBe("VERT VIF 400");
  });

  it("ignores memory for settings that do not persist", () => {
    expect(selectionFor(film35, { width: 3 }).params.width).toBe(14);
  });

  it("does not trust a stale or invalid remembered value", () => {
    const { params } = selectionFor(film35, { stock: "discontinued", frameNumber: 7 });

    expect(params.stock).toBe("amber");
    expect(params.frameNumber).toBe("24A");
  });
});

describe("isVisible and sectionsOf", () => {
  it("hides hidden settings", () => {
    expect(isVisible(def("sprockets"), defaultParams(film35))).toBe(false);
  });

  it("evaluates equals and notEquals conditions", () => {
    expect(isVisible(def("ink"), { stock: "amber" })).toBe(true);
    expect(isVisible(def("ink"), { stock: "plain" })).toBe(false);
    expect(
      isVisible(
        { ...def("ink"), visibleIf: { param: "stock", equals: "green" } },
        { stock: "amber" },
      ),
    ).toBe(false);
  });

  it("groups visible settings by section, in manifest order, with a default section", () => {
    const sections = sectionsOf(film35, defaultParams(film35));

    expect(sections.map(([title]) => title)).toEqual(["Pellicule", "Réglages"]);
    expect(sections[1]?.[1].map((param) => param.id)).toEqual([
      "width",
      "color",
      "ink",
      "text",
      "frameNumber",
    ]);
  });

  it("drops conditional settings from their section when the condition fails", () => {
    const sections = sectionsOf(film35, { ...defaultParams(film35), stock: "plain" });

    expect(sections[1]?.[1].map((param) => param.id)).toEqual(["width", "color"]);
  });
});

describe("decimalsOf", () => {
  it.each([
    [1, 0],
    [0.5, 1],
    [0.01, 2],
    [0.25, 2],
  ])("step %s shows %s decimals", (step, decimals) => {
    expect(decimalsOf(step)).toBe(decimals);
  });
});
