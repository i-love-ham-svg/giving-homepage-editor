import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || "playwright");
const executablePath = [
  process.env.BROWSER_EXECUTABLE,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean).find(existsSync);
const origin = process.env.SONGAK_QA_ORIGIN || "http://127.0.0.1:43216";
const routes = [
  "/",
  "/about",
  "/about/mission",
  "/about/corporate",
  "/about/history",
  "/directions",
  "/about/facility",
  "/about/organization",
  "/programs",
  "/programs/schedule",
  "/programs/schedule-original",
  "/programs/case-management",
  "/programs/application",
  "/participation/volunteer",
  "/participation/donation",
  "/news/notices",
  "/news/press",
  "/news/videos",
  "/news/gallery",
];
const sectionSurfaceSelector = [
  ".main-intro-surface",
  ".program-section-layer",
  ".process-section-layer",
  ".history-section-layer",
  ".donation-section-layer",
  ".gallery-section-layer",
  ".essential-section-layer:not([data-section-id=\"footer\"])",
].join(",");

const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const context = await browser.newContext({ viewport: { width: 1329, height: 912 } });
const page = await context.newPage();

try {
  for (const route of routes) {
    await page.goto(`${origin}${route}`, { waitUntil: "domcontentloaded" });
    await page.locator('#homepageMenu[data-layout-mode="selected-dropdown"]').waitFor({ timeout: 30_000 });
    const result = await page.evaluate((selector) => {
      const menu = document.querySelector("#homepageMenu");
      const breadcrumbs = [...document.querySelectorAll("[data-homepage-breadcrumb]")];
      const breadcrumb = breadcrumbs.find((element) => !element.hidden && getComputedStyle(element).display !== "none");
      const menuRect = menu?.getBoundingClientRect();
      const candidates = [...document.querySelectorAll(selector)]
        .filter((element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return !element.hidden
            && style.display !== "none"
            && style.visibility !== "hidden"
            && rect.width > 20
            && rect.height > 20;
        })
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            className: element.className,
            sectionId: element.dataset.sectionId || "",
            top: rect.top,
            bottom: rect.bottom,
          };
        })
        .sort((a, b) => Math.abs(a.top - menuRect.bottom) - Math.abs(b.top - menuRect.bottom));
      return {
        menuBottom: menuRect?.bottom ?? null,
        firstSurface: candidates[0] ?? null,
        breadcrumbCount: breadcrumbs.length,
        breadcrumbRect: breadcrumb?.getBoundingClientRect().toJSON() ?? null,
        firstContentTop: candidates[0] && candidates[0].top > (menuRect?.bottom ?? 0) + 40
          ? [...document.querySelectorAll(selector)]
            .filter((element) => {
              const rect = element.getBoundingClientRect();
              return (element.dataset.sectionId || element.className) === (candidates[0].sectionId || candidates[0].className)
                && rect.width > 20 && rect.height > 20;
            })[0]?.querySelector("textarea, input, h1, h2, .eyebrow")?.getBoundingClientRect().top ?? null
          : null,
        horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    }, sectionSurfaceSelector);

    assert.ok(result.menuBottom !== null, `${route}: menu is measurable`);
    assert.ok(result.firstSurface, `${route}: first visible section surface exists`);
    assert.equal(result.breadcrumbCount, 1, `${route}: exactly one shared breadcrumb exists`);
    assert.ok(result.breadcrumbRect, `${route}: breadcrumb is visible`);
    assert.ok(result.breadcrumbRect.top >= result.menuBottom - 2, `${route}: breadcrumb starts below the menu`);
    if (Number.isFinite(result.firstContentTop)) {
      assert.ok(result.breadcrumbRect.bottom <= result.firstContentTop + 2, `${route}: breadcrumb does not cover first section content`);
    }
    assert.ok(
      Math.abs(result.firstSurface.top - result.menuBottom) < 1.5,
      `${route}: ${result.firstSurface.sectionId || result.firstSurface.className} touches the menu without a blank strip`,
    );
    assert.ok(result.horizontalOverflow <= 1, `${route}: no horizontal page overflow`);
  }
  console.log(`public menu-to-section connection regression test OK (${routes.length} routes)`);
} finally {
  await context.close();
  await browser.close();
}
