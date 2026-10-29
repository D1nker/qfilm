import { describe, expect, it } from "vitest";

import { decimalsOf, fromEditText, toEditText } from "@/shared/lib/sliderValue";

describe("decimalsOf", () => {
  it("counts the decimals a step shows", () => {
    expect(decimalsOf(1)).toBe(0);
    expect(decimalsOf(0.5)).toBe(1);
    expect(decimalsOf(0.01)).toBe(2);
    expect(decimalsOf(0.1)).toBe(1);
    expect(decimalsOf(0.001)).toBe(3);
  });

  it("is not fooled by floating point noise", () => {
    expect(decimalsOf(0.1 + 0.2)).toBeLessThanOrEqual(1);
    expect(decimalsOf(0.07 * 100)).toBe(0);
  });
});

describe("toEditText", () => {
  it("writes the value with the decimals of its step", () => {
    expect(toEditText(0.25, 0.01)).toBe("0.25");
    expect(toEditText(2, 0.1)).toBe("2.0");
    expect(toEditText(-0.5, 0.01)).toBe("-0.50");
    expect(toEditText(40, 1)).toBe("40");
  });

  it("writes it in the displayed unit when there is a scale", () => {
    expect(toEditText(0.5, 0.01, 100)).toBe("50");
    expect(toEditText(0.5, 0.01, 30)).toBe("15.0");
  });
});

describe("fromEditText", () => {
  it("reads a plain number, with a dot or a comma", () => {
    expect(fromEditText("0.35", -3, 3)).toBe(0.35);
    expect(fromEditText("0,35", -3, 3)).toBe(0.35);
    expect(fromEditText("  -1.5 ", -3, 3)).toBe(-1.5);
    expect(fromEditText("+2", -3, 3)).toBe(2);
  });

  it("keeps a value within the slider", () => {
    expect(fromEditText("9", -3, 3)).toBe(3);
    expect(fromEditText("-9", -3, 3)).toBe(-3);
    expect(fromEditText("0.2", 0.5, 3)).toBe(0.5);
  });

  it("accepts a unit pasted with the number", () => {
    expect(fromEditText("15°", -1, 1, 30)).toBe(0.5);
    expect(fromEditText("0,5 EV", -3, 3)).toBe(0.5);
    expect(fromEditText("50 %", 0, 1, 100)).toBe(0.5);
  });

  it("converts from the displayed unit to the stored one", () => {
    expect(fromEditText("50", 0, 1, 100)).toBe(0.5);
    expect(fromEditText("15", -1, 1, 30)).toBe(0.5);
    expect(fromEditText("100", -1, 1, 30)).toBe(1);
  });

  it("refuses what is not a number", () => {
    for (const text of ["", "  ", "abc", "-", ".", "°15"]) {
      expect(fromEditText(text, -3, 3), JSON.stringify(text)).toBeNull();
    }
  });
});
