import { describe, expect, it } from "vitest";

import { fresh } from "@/test/fresh";

async function setup() {
  return fresh(() => import("@/shared/lib/useInteraction"));
}

describe("useInteraction", () => {
  it("is idle until a gesture starts, and idle again once it ends", async () => {
    const { beginDrag, useInteraction } = await setup();
    const { dragging } = useInteraction();
    expect(dragging.value).toBe(false);

    const end = beginDrag();
    expect(dragging.value).toBe(true);

    end();
    expect(dragging.value).toBe(false);
  });

  it("stays busy until every overlapping gesture has ended", async () => {
    const { beginDrag, useInteraction } = await setup();
    const { dragging } = useInteraction();

    const first = beginDrag();
    const second = beginDrag();
    first();
    expect(dragging.value).toBe(true);

    second();
    expect(dragging.value).toBe(false);
  });

  it("ignores a gesture ended twice, which must not end another one", async () => {
    const { beginDrag, useInteraction } = await setup();
    const { dragging } = useInteraction();

    const first = beginDrag();
    const second = beginDrag();
    first();
    first();

    expect(dragging.value).toBe(true);
    second();
    expect(dragging.value).toBe(false);
  });
});
