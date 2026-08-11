import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const executablePath = [
  process.env.BROWSER_EXECUTABLE,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
].filter(Boolean).find(existsSync);

const workspaceRoot = resolve(".");
const publicRoutes = new Set([
  "/",
  "/about",
  "/about/greeting",
  "/programs",
  "/news/gallery"
]);
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".webp": "image/webp",
  ".woff2": "font/woff2"
};

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
    const localPath = publicRoutes.has(pathname)
      ? "/outputs/representative-greeting-editor.html"
      : pathname.startsWith("/songak/")
        ? `/outputs/${pathname.slice("/songak/".length)}`
        : pathname;
    const filePath = resolve(workspaceRoot, `.${localPath}`);
    if (!filePath.startsWith(workspaceRoot)) throw new Error("invalid path");
    const fileStat = await stat(filePath);
    const resolvedPath = fileStat.isDirectory() ? resolve(filePath, "index.html") : filePath;
    response.writeHead(200, { "content-type": contentTypes[extname(resolvedPath)] || "application/octet-stream" });
    response.end(await readFile(resolvedPath));
  } catch {
    response.writeHead(404).end("Not found");
  }
});

await new Promise((resolveReady) => server.listen(0, "127.0.0.1", resolveReady));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36"
});
const page = await context.newPage();

async function openMenu() {
  const before = await page.evaluate(() => {
    const stage = document.querySelector("#stage");
    const toggle = document.querySelector("#homepageMenuToggle");
    const stageRect = stage?.getBoundingClientRect();
    const toggleRect = toggle?.getBoundingClientRect();
    return {
      scrollY: window.scrollY,
      stageTop: stageRect?.top ?? null,
      stickyTop: Number.parseFloat(getComputedStyle(stage).getPropertyValue("--home-menu-sticky-y")) || 0,
      toggleTop: toggleRect?.top ?? null,
      toggleBottom: toggleRect?.bottom ?? null
    };
  });
  assert.ok(before.toggleTop >= -1 && before.toggleBottom <= 845, "the sticky mobile menu button must remain in the visible viewport");
  await page.locator("#homepageMenuToggle").click();
  await page.waitForSelector("#homepageMenu.open #homepageMenuList");
  assert.equal(await page.locator("#homepageMenuToggle").getAttribute("aria-expanded"), "true");
  const after = await page.evaluate(() => {
    const menu = document.querySelector("#homepageMenu");
    const rect = menu?.getBoundingClientRect();
    return {
      bottom: rect?.bottom ?? null,
      innerHeight: window.innerHeight,
      scrollY: window.scrollY
    };
  });
  assert.equal(after.scrollY, before.scrollY, `opening the menu must not move the page: ${JSON.stringify({ before, after })}`);
  assert.ok(
    after.bottom >= after.innerHeight - 2,
    `the open panel must reach the viewport bottom without subtracting stickyTop twice: ${JSON.stringify({ before, after })}`
  );
  return before.scrollY;
}

async function closeMenuAndAssertScroll(expectedScrollY) {
  await page.locator("#homepageMenuToggle").click();
  await page.waitForFunction(() => !document.querySelector("#homepageMenu")?.classList.contains("open"));
  const state = await page.evaluate(() => ({
    bodyLocked: document.body.classList.contains("home-menu-open"),
    rootOverflow: getComputedStyle(document.documentElement).overflow,
    scrollY: window.scrollY
  }));
  assert.equal(state.bodyLocked, false, "closing the menu must release the document scroller");
  assert.notEqual(state.rootOverflow, "hidden", "closing the menu must restore document overflow");
  assert.equal(state.scrollY, expectedScrollY, "closing the menu must restore the page position");
}

async function expandAncestorsAndSelect(menuId) {
  const link = page.locator(`#homepageMenuList [data-menu-id="${menuId}"]`).first();
  assert.equal(await link.count(), 1, `${menuId} must exist in the mobile menu`);
  const ancestorIds = await link.evaluate((element) => {
    const ids = [];
    let item = element.closest(".homepage-menu-item")?.parentElement?.closest(".homepage-menu-item");
    while (item) {
      const button = item.querySelector(":scope > .homepage-menu-link");
      if (button?.dataset.menuId) ids.unshift(button.dataset.menuId);
      item = item.parentElement?.closest(".homepage-menu-item");
    }
    return ids;
  });
  for (const ancestorId of ancestorIds) {
    const ancestor = page.locator(`#homepageMenuList [data-menu-id="${ancestorId}"]`).first();
    if (await ancestor.getAttribute("aria-expanded") !== "true") await ancestor.click();
  }
  await link.click();
  await page.waitForFunction((activeId) => {
    const menu = document.querySelector("#homepageMenu");
    return !menu?.classList.contains("open")
      && document.querySelector(`[data-menu-id="${activeId}"][aria-current="page"]`);
  }, menuId);
}

async function scrollPageDown() {
  await page.evaluate(() => {
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    window.scrollTo(0, Math.min(360, maxScroll));
  });
  // Give the production passive-scroll path time to move the sticky button
  // before Playwright clicks it, matching a visitor who sees and taps the button.
  await page.waitForTimeout(120);
  const result = await page.evaluate(() => ({
    maxScroll: Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
    scrollY: window.scrollY
  }));
  assert.ok(result.maxScroll > 0, "the selected public page should have scrollable content");
  assert.ok(result.scrollY > 0, "the visitor should be able to inspect content below the first fold");
  return result.scrollY;
}

try {
  await page.goto(`${origin}/`, { waitUntil: "commit" });
  await page.waitForFunction(() => document.body.dataset.editorBootState === "ready"
    && document.body.dataset.editorRole === "public"
    && window.EditorModules?.sectionManager);

  await openMenu();
  await expandAncestorsAndSelect("home-menu-intro-main");
  assert.equal(new URL(page.url()).pathname, "/about", "the first selection should update the public URL");
  assert.equal(await page.evaluate(() => window.scrollY), 0, "page navigation should start at the top");

  const inspectedScrollY = await scrollPageDown();
  await openMenu();
  await closeMenuAndAssertScroll(inspectedScrollY);

  await openMenu();
  const activeBranch = page.locator('#homepageMenuList [data-menu-id="home-menu-1"]').first();
  assert.equal(await activeBranch.getAttribute("aria-expanded"), "true", "reopening should reveal the current page branch");
  await expandAncestorsAndSelect("home-menu-news-gallery");
  assert.equal(new URL(page.url()).pathname, "/news/gallery", "the second selection should update the public URL");
  assert.equal(await page.evaluate(() => window.scrollY), 0, "the second page should also start at the top");
  assert.equal(await page.evaluate(() => document.body.classList.contains("home-menu-open")), false, "selection must collapse the mobile panel");

  await scrollPageDown();
  await openMenu();
  assert.equal(
    await page.locator('#homepageMenuList [data-menu-id="home-menu-gallery"]').first().getAttribute("aria-expanded"),
    "true",
    "reopening after the second selection should reveal the new active branch"
  );

  console.log("mobile repeated navigation regression browser test OK");
} finally {
  await browser.close();
  await new Promise((resolveClosed) => server.close(resolveClosed));
}
