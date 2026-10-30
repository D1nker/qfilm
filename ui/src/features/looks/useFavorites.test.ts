import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Preset } from "@/shared/api/api";
import { NEUTRAL_PARAMS } from "@/test/fixtures";
import { fresh } from "@/test/fresh";

const look = (id: string): Preset => ({
  id,
  name: id,
  category: "Négatif",
  description: "",
  params: { ...NEUTRAL_PARAMS },
});

const PRESETS = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"].map(look);

async function setup() {
  vi.doMock("@/features/photo", () => ({
    useEditor: () => ({
      groupedPresets: { value: [{ key: "negative", title: "Négatif", items: PRESETS }] },
    }),
  }));
  const { useFavorites, MAX_RECENT } = await fresh(() => import("@/features/looks/useFavorites"));
  return { ...useFavorites(), MAX_RECENT };
}

const ids = (presets: Preset[]) => presets.map((preset) => preset.id);

describe("useFavorites", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  describe("favourites", () => {
    it("adds a look, keeps the order it was added in, and removes it again", async () => {
      const { favoritePresets, isFavorite, toggleFavorite } = await setup();

      toggleFavorite("c");
      toggleFavorite("a");
      expect(ids(favoritePresets.value)).toEqual(["c", "a"]);
      expect(isFavorite("c")).toBe(true);

      toggleFavorite("c");
      expect(ids(favoritePresets.value)).toEqual(["a"]);
      expect(isFavorite("c")).toBe(false);
    });

    it("remembers them from one session to the next", async () => {
      const first = await setup();
      first.toggleFavorite("b");

      const second = await setup();

      expect(ids(second.favoritePresets.value)).toEqual(["b"]);
    });

    it("ignores a look that no longer exists, without forgetting it", async () => {
      localStorage.setItem("qfilm-favorite-looks", JSON.stringify(["gone", "a"]));
      const { favoritePresets, toggleFavorite } = await setup();

      expect(ids(favoritePresets.value)).toEqual(["a"]);

      toggleFavorite("b");
      expect(JSON.parse(localStorage.getItem("qfilm-favorite-looks") ?? "[]")).toEqual([
        "gone",
        "a",
        "b",
      ]);
    });

    it("starts empty when the stored list is not a list of ids", async () => {
      localStorage.setItem("qfilm-favorite-looks", "{not json");
      expect(ids((await setup()).favoritePresets.value)).toEqual([]);

      localStorage.setItem("qfilm-favorite-looks", JSON.stringify({ a: 1 }));
      expect(ids((await setup()).favoritePresets.value)).toEqual([]);

      localStorage.setItem("qfilm-favorite-looks", JSON.stringify(["a", 3, null]));
      expect(ids((await setup()).favoritePresets.value)).toEqual(["a"]);
    });
  });

  describe("recent looks", () => {
    it("puts the look just applied first, once", async () => {
      const { recentPresets, noteUsed } = await setup();

      noteUsed(look("a"));
      noteUsed(look("b"));
      noteUsed(look("a"));

      expect(ids(recentPresets.value)).toEqual(["a", "b"]);
    });

    it("keeps only the latest few", async () => {
      const { recentPresets, noteUsed, MAX_RECENT } = await setup();

      for (const preset of PRESETS) noteUsed(preset);

      expect(recentPresets.value).toHaveLength(MAX_RECENT);
      expect(ids(recentPresets.value)[0]).toBe("j");
      expect(ids(recentPresets.value)).not.toContain("a");
    });

    it("remembers them from one session to the next", async () => {
      const first = await setup();
      first.noteUsed(look("d"));

      expect(ids((await setup()).recentPresets.value)).toEqual(["d"]);
    });
  });
});
