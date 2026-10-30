import { afterEach, describe, expect, it, vi } from "vitest";

import { fresh } from "@/test/fresh";

const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15";
const WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0";
const LINUX = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0";

/// `MOD` se lit une fois, à l'import : on règle le système avant de charger le module.
async function groupsOn(userAgent: string) {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent);
  const { shortcutGroups } = await fresh(() => import("@/app/shortcuts"));
  return shortcutGroups();
}

const keysOf = (groups: Awaited<ReturnType<typeof groupsOn>>, label: string) =>
  groups.flatMap((group) => group.shortcuts).find((shortcut) => shortcut.label === label)?.keys;

describe("shortcutGroups", () => {
  afterEach(() => vi.restoreAllMocks());

  it("writes ⌘ on a Mac and Ctrl on Windows and Linux", async () => {
    for (const [system, modifier] of [
      [MAC, "⌘"],
      [WINDOWS, "Ctrl"],
      [LINUX, "Ctrl"],
    ] as const) {
      const groups = await groupsOn(system);

      expect(keysOf(groups, "Annuler"), system).toEqual([modifier, "Z"]);
      expect(keysOf(groups, "Ouvrir une photo"), system).toEqual([modifier, "O"]);
      expect(keysOf(groups, "Exporter"), system).toEqual([modifier, "⇧", "E"]);
      expect(keysOf(groups, "Préférences (thème, langue)"), system).toEqual([modifier, ","]);
    }
  });

  it("lists the zoom toggle without a modifier, since ⌘Z is undo", async () => {
    const groups = await groupsOn(MAC);

    expect(keysOf(groups, "Basculer entre ajusté et 100 %")).toEqual(["Z"]);
  });

  it("has no empty group and no two shortcuts on the same keys", async () => {
    const groups = await groupsOn(MAC);
    const all = groups.flatMap((group) =>
      group.shortcuts.map((shortcut) => shortcut.keys.join("+")),
    );

    for (const group of groups) expect(group.shortcuts.length).toBeGreaterThan(0);
    expect(new Set(all).size).toBe(all.length);
  });
});
