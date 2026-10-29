import { describe, expect, it } from "vitest";

import { NEUTRAL } from "@/features/looks/neutral";
import {
  hueTrack,
  lightnessTrack,
  saturationTrack,
  shiftTrack,
  temperatureTrack,
  tintTrack,
  trackFor,
} from "@/features/looks/tracks";

const hues = (track: string) => [...track.matchAll(/hsl\((-?\d+) /g)].map((m) => Number(m[1]));

describe("gradient tracks", () => {
  it("are left-to-right CSS gradients", () => {
    for (const track of [hueTrack(), temperatureTrack(), tintTrack(), saturationTrack(40)]) {
      expect(track).toMatch(/^linear-gradient\(to right, hsl\(/);
    }
  });

  it("the hue track goes once around the wheel, back to where it started", () => {
    const stops = hues(hueTrack());

    expect(stops[0]).toBe(0);
    expect(stops.at(-1)).toBe(360);
    expect([...stops].sort((a, b) => a - b)).toEqual(stops);
  });

  it("the temperature track goes from blue to yellow, and the tint from green to magenta", () => {
    const temperature = hues(temperatureTrack());
    expect(temperature[0]).toBeGreaterThan(180);
    expect(temperature[0]).toBeLessThan(260);
    expect(temperature.at(-1)).toBeGreaterThan(30);
    expect(temperature.at(-1)).toBeLessThan(70);

    const tint = hues(tintTrack());
    expect(tint[0]).toBeGreaterThan(90);
    expect(tint[0]).toBeLessThan(170);
    expect(tint.at(-1)).toBeGreaterThan(290);
    expect(tint.at(-1)).toBeLessThan(340);
  });

  it("a saturation track runs from grey to the colour of its hue", () => {
    const track = saturationTrack(200);

    expect(track).toContain("hsl(0 0% ");
    expect(hues(track).at(-1)).toBe(200);
  });

  it("a shift track is centred on its hue", () => {
    expect(hues(shiftTrack(120, 30))).toEqual([90, 120, 150]);
  });

  it("a lightness track goes from dark to light through the colour", () => {
    const lightness = [...lightnessTrack(10).matchAll(/ (\d+)%\)/g)].map((m) => Number(m[1]));

    expect(lightness[0]).toBeLessThan(lightness[1] ?? 0);
    expect(lightness[1]).toBeLessThan(lightness[2] ?? 0);
  });
});

describe("trackFor", () => {
  it("colours the temperature, the tint and the grading hues", () => {
    for (const key of [
      "temperature",
      "tint",
      "shadowsHue",
      "midtonesHue",
      "highlightsHue",
    ] as const) {
      expect(trackFor(key, NEUTRAL), key).toMatch(/^linear-gradient/);
    }
  });

  it("leaves ordinary settings with the plain track", () => {
    for (const key of [
      "exposure",
      "contrast",
      "saturation",
      "grain",
      "sharpening",
      "redHue",
    ] as const) {
      expect(trackFor(key, NEUTRAL), key).toBeUndefined();
    }
  });

  it("makes a grading saturation follow the hue chosen for its zone", () => {
    const warm = trackFor("shadowsSaturation", { ...NEUTRAL, shadowsHue: 30 });
    const cool = trackFor("shadowsSaturation", { ...NEUTRAL, shadowsHue: 210 });

    expect(hues(warm ?? "").at(-1)).toBe(30);
    expect(hues(cool ?? "").at(-1)).toBe(210);
    expect(trackFor("midtonesSaturation", { ...NEUTRAL, shadowsHue: 210 })).toContain("hsl(0 85%");
  });
});
