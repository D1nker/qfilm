import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Preset } from "@/shared/api/api";
import { NEUTRAL_PARAMS } from "@/test/fixtures";
import { fresh } from "@/test/fresh";

const look = (id: string, exposure: number): Preset => ({
  id,
  name: id,
  category: "Négatif",
  description: "",
  params: { ...NEUTRAL_PARAMS, exposure },
});

async function setup() {
  const { useLook } = await fresh(() => import("@/features/looks/useLook"));
  const preview = await import("@/features/looks/usePresetPreview");
  return { ...preview, state: useLook(), ...preview.usePresetPreview() };
}

describe("usePresetPreview", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("waits a moment before trying a look, so a passing pointer renders nothing", async () => {
    const { enter, leave, state, ENTER_DELAY_MS } = await setup();

    enter(look("a", 1));
    vi.advanceTimersByTime(ENTER_DELAY_MS - 1);
    expect(state.shown.value.exposure).toBe(0);

    vi.advanceTimersByTime(1);
    expect(state.shown.value.exposure).toBe(1);

    leave();
  });

  it("does not render a look the pointer has already left", async () => {
    const { enter, leave, state, ENTER_DELAY_MS } = await setup();

    enter(look("a", 1));
    leave();
    vi.advanceTimersByTime(ENTER_DELAY_MS);

    expect(state.shown.value.exposure).toBe(0);
  });

  it("goes from one look to the next without showing the original in between", async () => {
    const { enter, leave, state, ENTER_DELAY_MS } = await setup();
    enter(look("a", 1));
    vi.advanceTimersByTime(ENTER_DELAY_MS);

    leave();
    enter(look("b", 2));
    vi.advanceTimersByTime(ENTER_DELAY_MS - 1);

    expect(state.shown.value.exposure).toBe(1);
    vi.advanceTimersByTime(1);
    expect(state.shown.value.exposure).toBe(2);
  });

  it("gives the photo back shortly after the pointer leaves", async () => {
    const { enter, leave, state, ENTER_DELAY_MS, LEAVE_DELAY_MS } = await setup();
    enter(look("a", 1));
    vi.advanceTimersByTime(ENTER_DELAY_MS);

    leave();
    vi.advanceTimersByTime(LEAVE_DELAY_MS);

    expect(state.shown.value.exposure).toBe(0);
  });

  it("stops at once, and cancels what was pending", async () => {
    const { enter, stop, state, ENTER_DELAY_MS } = await setup();
    enter(look("a", 1));
    vi.advanceTimersByTime(ENTER_DELAY_MS);

    enter(look("b", 2));
    stop();
    vi.advanceTimersByTime(ENTER_DELAY_MS);

    expect(state.shown.value.exposure).toBe(0);
  });
});
