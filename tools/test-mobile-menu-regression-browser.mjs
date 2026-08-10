import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const executablePath = [
  process.env.BROWSER_EXECUTABLE,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
].filter(Boolean).find(existsSync);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
const page = await context.newPage();
const workspaceRoot = resolve(".");
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2"
};
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
    const localPath = pathname.startsWith("/songak/")
      ? `/outputs/${pathname.slice("/songak/".length)}`
      : pathname;
    const filePath = resolve(workspaceRoot, `.${localPath}`);
    if (!filePath.startsWith(workspaceRoot)) throw new Error("invalid path");
    const fileStat = await stat(filePath);
    const resolvedPath = fileStat.isDirectory() ? resolve(filePath, "index.html") : filePath;
    const extension = resolvedPath.slice(resolvedPath.lastIndexOf("."));
    response.writeHead(200, { "content-type": contentTypes[extension] || "application/octet-stream" });
    response.end(await readFile(resolvedPath));
  } catch {
    response.writeHead(404).end("Not found");
  }
});
await new Promise((resolveReady) => server.listen(0, "127.0.0.1", resolveReady));
const { port } = server.address();
const editorUrl = `http://127.0.0.1:${port}/outputs/representative-greeting-editor.html`;

async function openMenuAt(viewport, width, height) {
  await page.setViewportSize({ width, height });
  await page.goto(`${editorUrl}?mode=view&viewport=${viewport}&stylePage=facility`, { waitUntil: "commit" });
  await page.waitForSelector("#homepageMenu");
  await page.waitForFunction(() => window.EditorModules?.sectionManager);
  await page.locator("#homepageMenu .homepage-menu-toggle").click();
  await page.waitForSelector("#homepageMenu.open .homepage-menu-list");
}

try {
  await openMenuAt("phone", 390, 844);
  const activeRoot = page.locator("#homepageMenu .homepage-menu-item.level-1 > .homepage-menu-link.has-children").first();
  const activeRootId = await activeRoot.getAttribute("data-menu-id");
  assert.ok(activeRootId, "a root menu should be available");
  if (await activeRoot.getAttribute("aria-expanded") !== "true") await activeRoot.click({ force: true });
  assert.equal(await activeRoot.getAttribute("aria-expanded"), "true", "opening should reveal the active branch");

  await activeRoot.click({ force: true });
  assert.equal(await activeRoot.getAttribute("aria-expanded"), "false", "the visitor must be able to collapse the active branch");
  await page.locator("#homepageMenu .homepage-menu-toggle").click();
  await page.locator("#homepageMenu .homepage-menu-toggle").click();
  assert.equal(await page.locator(`#homepageMenu [data-menu-id="${activeRootId}"]`).first().getAttribute("aria-expanded"), "true", "reopening may reveal the current page branch after the panel was fully closed");

  const rootIds = await page.locator("#homepageMenu .homepage-menu-item.level-1 > .homepage-menu-link.has-children").evaluateAll((links) => links.map((link) => link.dataset.menuId));
  for (const rootId of rootIds) {
    const root = page.locator(`#homepageMenu [data-menu-id="${rootId}"]`).first();
    if (await root.getAttribute("aria-expanded") !== "true") await root.evaluate((button) => button.click());
    const leafCount = await root.locator("xpath=..").locator(".homepage-menu-item.level-2 .homepage-menu-link").count();
    assert.ok(leafCount > 0, `${rootId} should expose at least one destination`);
  }

  const longestRoot = page.locator(`#homepageMenu [data-menu-id="${activeRootId}"]`).first();
  if (await longestRoot.getAttribute("aria-expanded") !== "true") await longestRoot.evaluate((button) => button.click());
  await page.evaluate(() => {
    const list = document.querySelector("#homepageMenuList");
    const source = list.querySelector(".homepage-menu-item.level-1");
    for (let index = 0; index < 6; index += 1) {
      const clone = source.cloneNode(true);
      clone.removeAttribute("id");
      clone.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"));
      clone.querySelectorAll("[aria-controls]").forEach((element) => element.removeAttribute("aria-controls"));
      list.appendChild(clone);
    }
  });
  const scrollState = await page.evaluate(() => {
    const list = document.querySelector("#homepageMenuList");
    list.scrollTop = 180;
    return {
      scrollTop: list.scrollTop,
      scrollHeight: list.scrollHeight,
      clientHeight: list.clientHeight,
      touchAction: getComputedStyle(list).touchAction,
      bodyOverflow: getComputedStyle(document.body).overflow,
      rootOverflow: getComputedStyle(document.documentElement).overflow
    };
  });
  console.log("mobile-menu-scroll", JSON.stringify(scrollState));
  assert.ok(scrollState.scrollHeight > scrollState.clientHeight && scrollState.scrollTop > 0, "long menus should scroll inside the menu list");
  assert.equal(scrollState.touchAction, "pan-y");
  assert.equal(scrollState.bodyOverflow, "hidden");
  assert.equal(scrollState.rootOverflow, "hidden");

  for (const [viewport, width, height] of [["phoneSmall", 360, 800], ["phone", 390, 844], ["tablet", 768, 1024], ["phone", 844, 390]]) {
    await openMenuAt(viewport, width, height);
    const bounds = await page.evaluate(() => {
      const rect = document.querySelector("#homepageMenuList").getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, innerHeight: window.innerHeight };
    });
    console.log("mobile-menu-bounds", viewport, width, height, JSON.stringify(bounds));
    assert.ok(bounds.top >= -1 && bounds.bottom <= bounds.innerHeight + 1, `${viewport} menu content should fit the visible viewport at ${width}x${height}`);
  }

  const beforeClose = await page.evaluate(() => window.scrollY);
  await page.locator("#homepageMenu .homepage-menu-toggle").click();
  const afterClose = await page.evaluate(() => ({
    scrollY: window.scrollY,
    bodyOpen: document.body.classList.contains("home-menu-open"),
    rootOverflow: getComputedStyle(document.documentElement).overflow
  }));
  assert.equal(afterClose.bodyOpen, false);
  assert.notEqual(afterClose.rootOverflow, "hidden");
  assert.equal(afterClose.scrollY, beforeClose, "closing the menu should return to the same document position");

  console.log("mobile menu regression browser tests OK");
} finally {
  await browser.close();
  await new Promise((resolveClosed) => server.close(resolveClosed));
}
