import { afterEach, describe, expect, it, vi } from "vitest";

import { fresh } from "@/test/fresh";

async function setup() {
  vi.useFakeTimers();
  const { useNotice } = await fresh(() => import("@/shared/lib/useNotice"));
  return useNotice();
}

describe("useNotice", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a message, then clears it by itself", async () => {
    const { notice, show } = await setup();

    show("Export terminé");
    expect(notice.value).toBe("Export terminé");

    vi.advanceTimersByTime(2999);
    expect(notice.value).toBe("Export terminé");
    vi.advanceTimersByTime(1);
    expect(notice.value).toBe("");
  });

  it("a new message replaces the old one and restarts the delay", async () => {
    const { notice, show } = await setup();

    show("Premier");
    vi.advanceTimersByTime(2000);
    show("Second");
    vi.advanceTimersByTime(2000);

    expect(notice.value).toBe("Second");
    vi.advanceTimersByTime(1000);
    expect(notice.value).toBe("");
  });
});
