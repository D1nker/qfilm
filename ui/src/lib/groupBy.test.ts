import { describe, expect, it } from "vitest";

import { groupBy } from "@/lib/groupBy";

describe("groupBy", () => {
  it("groups items and keeps the order in which keys first appear", () => {
    const items = [
      { name: "a", group: "z" },
      { name: "b", group: "y" },
      { name: "c", group: "z" },
    ];

    expect(groupBy(items, (item) => item.group)).toEqual([
      ["z", [items[0], items[2]]],
      ["y", [items[1]]],
    ]);
  });

  it("returns nothing for nothing", () => {
    expect(groupBy([], () => "x")).toEqual([]);
  });
});
