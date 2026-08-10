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
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36"
});
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
const remoteEditorUrl = process.env.EDITOR_URL?.trim();
const server = remoteEditorUrl ? null : createServer(async (request, response) => {
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
if (server) await new Promise((resolveReady) => server.listen(0, "127.0.0.1", resolveReady));
const editorUrl = remoteEditorUrl || `http://127.0.0.1:${server.address().port}/outputs/representative-greeting-editor.html`;

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

  const accountStructure = await page.evaluate(() => {
    const links = [...document.querySelectorAll('#homepageMenuList [data-menu-id="home-menu-account"]')];
    return links.map((link) => ({
      levelOne: link.parentElement?.classList.contains("level-1") || false,
      nestedInSubmenu: Boolean(link.closest(".homepage-submenu")),
      label: link.textContent.trim()
    }));
  });
  console.log("mobile-menu-account-structure", JSON.stringify(accountStructure));
  assert.equal(accountStructure.length, 1, "the account destination must appear exactly once in the mobile menu");
  assert.equal(accountStructure[0].levelOne, true, "the account destination must remain a top-level mobile menu item");
  assert.equal(accountStructure[0].nestedInSubmenu, false, "the account destination must not overlap a news submenu");

  const newsRoot = page.locator('#homepageMenu [data-menu-id="home-menu-gallery"]').first();
  if (await newsRoot.getAttribute("aria-expanded") !== "true") await newsRoot.evaluate((button) => button.click());
  const newsAccountGeometry = await page.evaluate(() => {
    const newsElement = document.querySelector('#homepageMenu [data-menu-id="home-menu-gallery"]')?.parentElement;
    const accountElement = document.querySelector('#homepageMenu [data-menu-id="home-menu-account"]')?.parentElement;
    const boardElement = document.querySelector('#homepageMenu [data-menu-id="home-menu-news-board"]');
    const news = newsElement?.getBoundingClientRect();
    const account = accountElement?.getBoundingClientRect();
    const board = boardElement?.getBoundingClientRect();
    const newsStyle = newsElement ? getComputedStyle(newsElement) : null;
    const accountStyle = accountElement ? getComputedStyle(accountElement) : null;
    const submenuStyle = newsElement?.querySelector(":scope > .homepage-submenu") ? getComputedStyle(newsElement.querySelector(":scope > .homepage-submenu")) : null;
    return news && account && board ? {
      newsBottom: news.bottom,
      newsHeight: news.height,
      newsOffsetHeight: newsElement.offsetHeight,
      accountTop: account.top,
      accountBottom: account.bottom,
      boardTop: board.top,
      boardBottom: board.bottom,
      newsPosition: newsStyle.position,
      newsTransform: newsStyle.transform,
      newsMarginBottom: newsStyle.marginBottom,
      accountPosition: accountStyle.position,
      accountTransform: accountStyle.transform,
      accountMarginTop: accountStyle.marginTop,
      newsAlignSelf: newsStyle.alignSelf,
      newsGridRow: `${newsStyle.gridRowStart} / ${newsStyle.gridRowEnd}`,
      accountAlignSelf: accountStyle.alignSelf,
      accountGridRow: `${accountStyle.gridRowStart} / ${accountStyle.gridRowEnd}`,
      newsOffsetTop: newsElement.offsetTop,
      accountOffsetTop: accountElement.offsetTop,
      submenuPosition: submenuStyle?.position,
      submenuHeight: newsElement.querySelector(":scope > .homepage-submenu")?.getBoundingClientRect().height || 0,
      submenuOffsetHeight: newsElement.querySelector(":scope > .homepage-submenu")?.offsetHeight || 0,
      listDisplay: getComputedStyle(document.querySelector("#homepageMenuList")).display,
      listGap: getComputedStyle(document.querySelector("#homepageMenuList")).rowGap,
      listRows: getComputedStyle(document.querySelector("#homepageMenuList")).gridTemplateRows,
      listAlignItems: getComputedStyle(document.querySelector("#homepageMenuList")).alignItems
    } : null;
  });
  console.log("mobile-menu-news-account-geometry", JSON.stringify(newsAccountGeometry));
  assert.ok(newsAccountGeometry, "the news, board, and account menu geometry should be measurable");
  assert.ok(newsAccountGeometry.boardBottom <= newsAccountGeometry.newsBottom + 1, "the communication board must remain inside the expanded news card");
  assert.ok(newsAccountGeometry.newsBottom <= newsAccountGeometry.accountTop + 1, "the account card must start after the expanded news card");

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

  // Use a real Chrome touch sequence, not a direct scrollTop assignment, so the
  // production mobile gesture path stays covered by the regression test.
  await page.evaluate(() => { document.querySelector("#homepageMenuList").scrollTop = 0; });
  const listBox = await page.locator("#homepageMenuList").boundingBox();
  assert.ok(listBox, "the open mobile menu list should have a touch target");
  const client = await context.newCDPSession(page);
  const touchX = Math.round(listBox.x + listBox.width / 2);
  const touchStartY = Math.round(Math.min(listBox.y + listBox.height - 80, page.viewportSize().height - 90));
  const touchEndY = Math.round(Math.max(listBox.y + 90, touchStartY - 300));
  await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: touchX, y: touchStartY }] });
  for (let step = 1; step <= 6; step += 1) {
    const y = Math.round(touchStartY + (touchEndY - touchStartY) * (step / 6));
    await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: touchX, y }] });
  }
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(250);
  const touchScrollState = await page.evaluate(() => ({
    scrollTop: document.querySelector("#homepageMenuList").scrollTop,
    menuOpen: document.querySelector("#homepageMenu").classList.contains("open")
  }));
  console.log("mobile-menu-touch-scroll", JSON.stringify(touchScrollState));
  assert.ok(touchScrollState.scrollTop > 0, "a real upward touch drag should scroll the mobile menu list");
  assert.equal(touchScrollState.menuOpen, true, "touch scrolling must not close the mobile menu");

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
  if (server) await new Promise((resolveClosed) => server.close(resolveClosed));
}
