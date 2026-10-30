import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

/// Le site (`website/`) : deux pages, anglais et français, sans étape de build. On vérifie ce qui casse
/// sans bruit : une image qui ne charge pas, une page qui n'a plus la structure de l'autre, un lien mort.

const SITE = "http://localhost:4000";
const PAGES = [
  { language: "en", path: "/", other: "/fr/" },
  { language: "fr", path: "/fr/", other: "/" },
] as const;

const RELEASE = {
  tag_name: "v0.1.0",
  html_url: "https://github.com/D1nker/qfilm/releases/tag/v0.1.0",
  assets: [
    asset("qFilm_0.1.0_aarch64.dmg", 9_400_000),
    asset("qFilm_0.1.0_x64.dmg", 9_900_000),
    asset("qFilm_0.1.0_x64-setup.exe", 7_300_000),
    asset("qFilm_0.1.0_x64_en-US.msi", 8_100_000),
    asset("qFilm_0.1.0_amd64.AppImage", 85_000_000),
    asset("qFilm_0.1.0_amd64.deb", 8_000_000),
    asset("qFilm.app.tar.gz.sig", 400),
    asset("latest.json", 900),
  ],
};

function asset(name: string, size: number) {
  return {
    name,
    size,
    browser_download_url: `https://github.com/D1nker/qfilm/releases/download/v0.1.0/${name}`,
  };
}

/// La version la plus récente est celle que `page` voit : aucune (le dépôt est privé), ou celle-ci.
async function withRelease(page: Page, release: unknown) {
  await page.route("https://api.github.com/**", (route) =>
    release
      ? route.fulfill({ json: release })
      : route.fulfill({ status: 404, json: { message: "Not Found" } }),
  );
}

/// Les images sous la ligne de flottaison sont paresseuses : on les charge toutes.
async function loadEveryImage(page: Page) {
  await page.evaluate(() => {
    for (const image of document.querySelectorAll("img")) image.loading = "eager";
  });
  await page.waitForFunction(() =>
    [...document.querySelectorAll("img")].every((image) => image.complete),
  );
}

for (const { language, path, other } of PAGES) {
  test.describe(`website (${language})`, () => {
    test.beforeEach(async ({ page }) => {
      await withRelease(page, null);
    });

    test("every image loads, and every informative image has a description", async ({ page }) => {
      await page.goto(SITE + path);
      await loadEveryImage(page);

      const images = await page.evaluate(() =>
        [...document.querySelectorAll("img")].map((image) => ({
          src: image.currentSrc,
          loaded: image.naturalWidth > 0,
          alt: image.getAttribute("alt"),
          decorative: image.getAttribute("aria-hidden") === "true" || image.alt === "",
          width: image.getAttribute("width"),
          height: image.getAttribute("height"),
        })),
      );

      expect(images.length).toBeGreaterThanOrEqual(19);
      for (const image of images) {
        expect(image.loaded, image.src).toBe(true);
        expect(image.alt, image.src).not.toBeNull();
        // Sans largeur et hauteur, la page saute au chargement de chaque image.
        expect(Number(image.width), image.src).toBeGreaterThan(0);
        expect(Number(image.height), image.src).toBeGreaterThan(0);
      }
      const informative = images.filter((image) => !image.decorative);
      expect(informative.length).toBeGreaterThan(15);
    });

    test("has one h1 and headings that never skip a level", async ({ page }) => {
      await page.goto(SITE + path);

      const levels = await page.evaluate(() =>
        [...document.querySelectorAll("h1, h2, h3")].map((heading) => Number(heading.tagName[1])),
      );

      expect(levels.filter((level) => level === 1)).toHaveLength(1);
      expect(levels[0]).toBe(1);
      for (let i = 1; i < levels.length; i++) {
        expect((levels[i] ?? 0) - (levels[i - 1] ?? 0), `titre n° ${i}`).toBeLessThanOrEqual(1);
      }
    });

    test("every in-page link points to something", async ({ page }) => {
      await page.goto(SITE + path);

      const missing = await page.evaluate(() =>
        [...document.querySelectorAll('a[href^="#"]')]
          .map((link) => link.getAttribute("href") ?? "")
          .filter((href) => href.length > 1 && !document.getElementById(href.slice(1))),
      );

      expect(missing).toEqual([]);
    });

    test("declares its language, its twin and a share image that exists", async ({
      page,
      request,
    }) => {
      await page.goto(SITE + path);

      await expect(page.locator("html")).toHaveAttribute("lang", language);
      for (const hreflang of ["en", "fr", "x-default"]) {
        await expect(page.locator(`link[rel="alternate"][hreflang="${hreflang}"]`)).toHaveCount(1);
      }
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /^https:\/\//);

      const share = await page.locator('meta[property="og:image"]').getAttribute("content");
      expect(share).toContain(`og-${language}.jpg`);
      const local = (share ?? "").replace("https://d1nker.github.io/qfilm", SITE);
      expect((await request.get(local)).ok()).toBe(true);

      const description = await page.locator('meta[name="description"]').getAttribute("content");
      expect((description ?? "").length).toBeGreaterThan(80);
      // Au-delà d'environ 160 caractères, les moteurs de recherche coupent la description.
      expect((description ?? "").length).toBeLessThanOrEqual(160);
      const data = JSON.parse(
        (await page.locator("script[type='application/ld+json']").textContent()) ?? "",
      );
      expect(data["@type"]).toBe("SoftwareApplication");
      expect(data.inLanguage).toBe(language);
    });

    test("the language switch goes to the other page and marks the current one", async ({
      page,
    }) => {
      await page.goto(SITE + path);

      await expect(page.locator('.lang [aria-current="true"]')).toHaveAttribute("lang", language);
      await page.locator(".lang a").click();

      await expect(page).toHaveURL(SITE + other);
      await expect(page.locator("html")).not.toHaveAttribute("lang", language);
    });

    test("asks nothing of the network but GitHub's release API", async ({ page }) => {
      const hosts = new Set<string>();
      page.on("request", (request) => hosts.add(new URL(request.url()).host));

      await page.goto(SITE + path);
      await loadEveryImage(page);

      expect([...hosts].filter((host) => host !== "localhost:4000")).toEqual(["api.github.com"]);
    });

    test("raises no script error", async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => message.type() === "error" && errors.push(message.text()));

      await page.goto(SITE + path);
      await page.waitForLoadState("networkidle");

      // Le 404 de l'API des versions est attendu : le navigateur le note dans la console.
      expect(errors.filter((text) => !text.includes("404"))).toEqual([]);
    });

    test("does not scroll sideways on a phone", async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: 360, height: 740 } });
      const page = await context.newPage();
      await withRelease(page, null);

      await page.goto(SITE + path);
      await loadEveryImage(page);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      await context.close();
    });

    test("the skip link is the first thing the keyboard reaches", async ({ page }) => {
      await page.goto(SITE + path);

      await page.keyboard.press("Tab");

      await expect(page.locator(".skip")).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/#main$/);
    });

    test("the compare slider moves its dividing line, with the mouse and the arrows", async ({
      page,
    }) => {
      await page.goto(SITE + path);
      const compare = page.locator("[data-compare]");
      const slider = compare.locator("input");
      await compare.scrollIntoViewIfNeeded();

      await expect(compare).toHaveCSS("--pos", "50%");
      await slider.fill("80");
      await expect(compare).toHaveCSS("--pos", "80%");

      await slider.focus();
      await page.keyboard.press("ArrowLeft");
      await expect(compare).toHaveCSS("--pos", "79%");
    });

    test("the FAQ opens and closes by keyboard", async ({ page }) => {
      await page.goto(SITE + path);
      const first = page.locator(".faq summary").first();

      await first.focus();
      await page.keyboard.press("Enter");
      await expect(page.locator(".faq details").first()).toHaveAttribute("open", "");

      await page.keyboard.press("Enter");
      await expect(page.locator(".faq details").first()).not.toHaveAttribute("open", "");
    });

    test.describe("the download section", () => {
      test("says it is early access while there is no release, and offers nothing to click", async ({
        page,
      }) => {
        await page.goto(SITE + path);
        const section = page.locator("#download");

        await expect(section).toHaveAttribute("data-state", "soon");
        for (const os of ["mac", "windows", "linux"]) {
          const card = section.locator(`.os[data-os="${os}"]`);
          await expect(card.locator(".when-soon")).toBeVisible();
          await expect(card.locator(".when-soon")).toHaveAttribute("aria-disabled", "true");
          await expect(card.locator("[data-get]")).toBeHidden();
        }
        await expect(page.locator("[data-cta]")).toHaveAttribute("href", "#download");
      });

      test("flips to real downloads once a release exists, the visitor's system first", async ({
        browser,
      }) => {
        const context = await browser.newContext({
          userAgent:
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15",
        });
        const page = await context.newPage();
        await withRelease(page, RELEASE);

        await page.goto(SITE + path);
        const section = page.locator("#download");

        await expect(section).toHaveAttribute("data-state", "ready");
        await expect(section.locator("[data-status]")).toContainText("v0.1.0");

        const mac = section.locator('.os[data-os="mac"]');
        await expect(mac).toHaveClass(/recommended/);
        await expect(mac.locator("[data-get]")).toHaveAttribute("href", /aarch64\.dmg$/);
        await expect(mac.locator("[data-get]")).toContainText("9");
        await expect(mac.locator("[data-others] a")).toHaveText(["qFilm_0.1.0_x64.dmg"]);

        const windows = section.locator('.os[data-os="windows"]');
        await expect(windows.locator("[data-get]")).toHaveAttribute("href", /x64-setup\.exe$/);
        await expect(windows.locator("[data-others] a")).toHaveText(["qFilm_0.1.0_x64_en-US.msi"]);

        const linux = section.locator('.os[data-os="linux"]');
        await expect(linux.locator("[data-get]")).toHaveAttribute("href", /amd64\.AppImage$/);

        // Ni les signatures, ni le manifeste de mise à jour ne se téléchargent à la main.
        await expect(section.locator('a[href$=".sig"], a[href$="latest.json"]')).toHaveCount(0);

        const cta = page.locator("[data-cta]");
        await expect(cta).toHaveAttribute("href", /aarch64\.dmg$/);
        await expect(cta).toContainText("macOS");
        await context.close();
      });

      test("keeps a system without a file as 'coming soon' when the release lacks it", async ({
        page,
      }) => {
        await withRelease(page, {
          ...RELEASE,
          assets: RELEASE.assets.filter((file) => file.name.endsWith(".dmg")),
        });

        await page.goto(SITE + path);
        const section = page.locator("#download");

        await expect(section).toHaveAttribute("data-state", "ready");
        const linux = section.locator('.os[data-os="linux"]');
        await expect(linux.locator(".when-soon")).toBeVisible();
        await expect(linux.locator("[data-get]")).toBeHidden();
        await expect(section.locator('.os[data-os="mac"] [data-get]')).toBeVisible();
      });

      test("stays 'coming soon' when a release has no usable file, or the API fails", async ({
        page,
      }) => {
        await withRelease(page, { ...RELEASE, assets: [asset("notes.txt", 10)] });
        await page.goto(SITE + path);
        await expect(page.locator("#download")).toHaveAttribute("data-state", "soon");

        await page.route("https://api.github.com/**", (route) => route.abort());
        await page.reload();
        await expect(page.locator("#download")).toHaveAttribute("data-state", "soon");
      });

      test("does not point a phone at a desktop download", async ({ browser }) => {
        const context = await browser.newContext({
          userAgent:
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
        });
        const page = await context.newPage();
        await withRelease(page, RELEASE);

        await page.goto(SITE + path);

        await expect(page.locator("#download")).toHaveAttribute("data-state", "ready");
        await expect(page.locator(".os.recommended")).toHaveCount(0);
        await expect(page.locator("[data-cta]")).toHaveAttribute("href", "#download");
        await context.close();
      });
    });
  });
}

test.describe("website (both languages)", () => {
  test("have the same structure, so neither falls behind", async ({ page }) => {
    await withRelease(page, null);
    const outline = async (path: string) => {
      await page.goto(SITE + path);
      return page.evaluate(() => ({
        sections: [...document.querySelectorAll("main > section")].map((section) => section.id),
        headings: [...document.querySelectorAll("h2")].length,
        subheadings: [...document.querySelectorAll("h3")].length,
        images: [...document.querySelectorAll("img")].length,
        steps: document.querySelectorAll(".steps li").length,
        tiles: document.querySelectorAll(".tile").length,
        frames: document.querySelectorAll(".frames-grid figure").length,
        tools: document.querySelectorAll(".bento article").length,
        trust: document.querySelectorAll(".trust article").length,
        questions: document.querySelectorAll(".faq details").length,
        chips: document.querySelectorAll(".chips li").length,
        links: [...document.querySelectorAll("a[href^='http']")].map((a) =>
          (a.getAttribute("href") ?? "").replace(/\/fr\//, "/"),
        ),
      }));
    };

    const english = await outline("/");
    const french = await outline("/fr/");

    expect(french).toEqual(english);
    expect(english.sections.length).toBeGreaterThanOrEqual(8);
  });

  test("serve a robots file, a sitemap listing both pages, and a 404", async ({ request }) => {
    const robots = await (await request.get(`${SITE}/robots.txt`)).text();
    expect(robots).toContain("Sitemap: https://d1nker.github.io/qfilm/sitemap.xml");

    const sitemap = await (await request.get(`${SITE}/sitemap.xml`)).text();
    expect(sitemap).toContain("<loc>https://d1nker.github.io/qfilm/</loc>");
    expect(sitemap).toContain("<loc>https://d1nker.github.io/qfilm/fr/</loc>");

    expect((await request.get(`${SITE}/404.html`)).ok()).toBe(true);
  });
});

test.describe("website layout", () => {
  test("the privacy cards are centred, icon included", async ({ page }) => {
    await withRelease(page, null);
    await page.goto(SITE);
    const card = page.locator(".trust article").first();
    await card.scrollIntoViewIfNeeded();

    const [cardBox, iconBox] = await Promise.all([
      card.boundingBox(),
      card.locator(".icon").boundingBox(),
    ]);

    expect(
      Math.abs(
        (iconBox?.x ?? 0) +
          (iconBox?.width ?? 0) / 2 -
          ((cardBox?.x ?? 0) + (cardBox?.width ?? 0) / 2),
      ),
    ).toBeLessThan(1.5);
    await expect(card.locator("h3")).toHaveCSS("text-align", "center");
  });
});

test.describe("the logo", () => {
  const read = (path: string) =>
    readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), "utf8");
  /// Le dessin, sans la balise `<svg>` d'ouverture : les copies ne changent que de cadrage.
  const drawing = (svg: string) => svg.slice(svg.indexOf(">") + 1);

  test("is one drawing: the app's favicon and the site's are copies of the source", () => {
    const source = read("branding/icon.svg");

    expect(read("ui/public/favicon.svg")).toBe(read("website/icon.svg"));
    expect(drawing(read("website/icon.svg"))).toBe(drawing(source));
    expect(drawing(source)).toContain("<circle");
  });

  test("is the one the pages and the share cards point at", async ({ page }) => {
    await withRelease(page, null);
    await page.goto(SITE);

    await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", "icon.svg");
    await expect(page.locator(".top .brand img")).toHaveAttribute("src", "icon.svg");
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
      "href",
      "apple-touch-icon.png",
    );
  });
});
