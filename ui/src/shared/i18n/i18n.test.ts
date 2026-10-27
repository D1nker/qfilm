import { beforeEach, describe, expect, it } from "vitest";

import { en } from "@/shared/i18n/en";
import { fr } from "@/shared/i18n/fr";
import { fresh } from "@/test/fresh";

function systemLanguage(language: string) {
  Object.defineProperty(navigator, "language", { value: language, configurable: true });
}

async function setup() {
  return fresh(() => import("@/shared/i18n"));
}

function leaves(messages: object, prefix = ""): [string, string][] {
  return Object.entries(messages).flatMap(([key, value]) =>
    typeof value === "string"
      ? [[`${prefix}${key}`, value] as [string, string]]
      : leaves(value as object, `${prefix}${key}.`),
  );
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("language", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("lang");
  });

  it("follows a French system", async () => {
    systemLanguage("fr-FR");
    const { useLocale, t } = await setup();

    expect(useLocale().locale.value).toBe("fr");
    expect(t("tabs.adjust")).toBe("Retouche");
    expect(document.documentElement.lang).toBe("fr");
  });

  it("falls back to English for any other system language", async () => {
    systemLanguage("de-DE");
    const { useLocale, t } = await setup();

    expect(useLocale().locale.value).toBe("en");
    expect(t("tabs.adjust")).toBe("Edit");
  });

  it("lets the user override the system language and remembers it", async () => {
    systemLanguage("fr-FR");
    const first = await setup();
    first.useLocale().set("en");

    expect(first.t("tabs.frame")).toBe("Frame");
    expect(document.documentElement.lang).toBe("en");
    expect(localStorage.getItem("qfilm-locale")).toBe("en");

    const second = await setup();
    expect(second.useLocale().locale.value).toBe("en");
  });

  it("ignores a stored value that is not a known language", async () => {
    systemLanguage("fr-FR");
    localStorage.setItem("qfilm-locale", "klingon");
    const { useLocale } = await setup();

    expect(useLocale().locale.value).toBe("fr");
  });

  it("fills the {placeholders} of a message", async () => {
    systemLanguage("en-US");
    const { t } = await setup();

    expect(t("frames.library.removeNamed", { name: "Mine" })).toBe("Delete the frame Mine");
  });
});

describe("texts that come from the data", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const text = { fr: "Cadre", en: "Frame" };

  it("shows the current language, and follows a language change", async () => {
    systemLanguage("fr-FR");
    const { localized, useLocale } = await setup();

    expect(localized(text)).toBe("Cadre");
    useLocale().set("en");
    expect(localized(text)).toBe("Frame");
  });

  it("shows a plain string in every language", async () => {
    systemLanguage("en-US");
    const { localized } = await setup();

    expect(localized("35 mm")).toBe("35 mm");
  });

  it("falls back to English, then French, then anything, then nothing", async () => {
    systemLanguage("en-US");
    const { localized, useLocale } = await setup();
    useLocale().set("fr");

    expect(localized({ en: "Frame" })).toBe("Frame");
    expect(localized({ fr: "Cadre" })).toBe("Cadre");
    expect(localized({ de: "Rahmen" })).toBe("Rahmen");
    expect(localized({})).toBe("");
    expect(localized(undefined)).toBe("");
  });

  it("identifies a text the same way in every language", async () => {
    systemLanguage("fr-FR");
    const { textKey, useLocale } = await setup();
    const before = textKey(text);
    useLocale().set("en");

    expect(textKey(text)).toBe(before);
    expect(textKey("Base")).toBe("Base");
  });
});

describe("catalogues", () => {
  it("have the same keys, none of them empty", () => {
    const french = leaves(fr);
    const english = leaves(en);

    expect(english.map(([key]) => key)).toEqual(french.map(([key]) => key));
    for (const [key, value] of [...french, ...english]) expect(value, key).not.toBe("");
  });

  it("use the same {placeholders} in both languages", () => {
    const english = new Map(leaves(en));
    for (const [key, value] of leaves(fr)) {
      expect(placeholders(english.get(key) ?? ""), key).toEqual(placeholders(value));
    }
  });
});
