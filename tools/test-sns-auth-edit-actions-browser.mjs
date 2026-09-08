import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { loadPlaywrightCore } from "../manual-video/v2/record-manual-v2.cjs";

const { chromium } = loadPlaywrightCore();
const executablePath = [
  process.env.BROWSER_EXECUTABLE,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
].filter(Boolean).find(existsSync);
const outputRoot = resolve("outputs");
const contentTypes = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".webp": "image/webp" };

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://127.0.0.1");
    if (url.pathname === "/api/board/admin/session") {
      response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ admin: true }));
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      response.writeHead(404, { "content-type": "application/json" }).end("{}");
      return;
    }
    const relative = decodeURIComponent(url.pathname).replace(/^\/songak\//, "").replace(/^\/+/, "") || "representative-greeting-editor.html";
    const file = resolve(outputRoot, relative);
    if (file !== outputRoot && !file.startsWith(`${outputRoot}${sep}`)) throw new Error("invalid path");
    const info = await stat(file);
    const resolvedFile = info.isDirectory() ? resolve(file, "index.html") : file;
    response.writeHead(200, { "content-type": contentTypes[extname(resolvedFile)] || "application/octet-stream" });
    response.end(await readFile(resolvedFile));
  } catch {
    response.writeHead(404).end("Not found");
  }
});

await new Promise((resolveReady) => server.listen(0, "127.0.0.1", resolveReady));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

try {
  for (const profile of [
    { width: 390, height: 844, viewport: "phone" },
    { width: 360, height: 800, viewport: "phoneSmall" }
  ]) {
    const page = await browser.newPage({ viewport: { width: profile.width, height: profile.height } });
    try {
      await page.goto(`${origin}/songak/representative-greeting-editor.html?mode=edit&editorRole=staff&viewport=${profile.viewport}&stylePage=account`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector('.essential-section-content[data-detail-page-kind="account"][data-detail-section-kind="social"] .sns-auth-edit-actions', { timeout: 30_000 });
      await page.waitForFunction(() => document.body.dataset.editorBootState === "ready");
      const selector = '.essential-section-content[data-detail-page-kind="account"][data-detail-section-kind="social"]';
      const account = page.locator(selector);
      await account.locator(".sns-auth-image-picker > summary").click();
      const imageChoice = account.locator('.sns-auth-image-choice[data-sns-image-value="./assets/generated/account-sns-pop-v1.webp"]');
      await imageChoice.click();
      await account.locator(".sns-auth-layout-picker > summary").click();
      const layoutChoice = account.locator('.sns-auth-layout-choice[data-sns-layout-value="fresh-split"]');
      await layoutChoice.click();

      const result = await page.evaluate((accountSelector) => {
        const root = document.querySelector(accountSelector);
        const nav = document.querySelector("#homepageMenu").getBoundingClientRect();
        const dock = document.querySelector("#staffEditorDock").getBoundingClientRect();
        const actions = root.querySelector(".sns-auth-edit-actions").getBoundingClientRect();
        const summaries = [...root.querySelectorAll(".sns-auth-edit-actions summary")].map((node) => {
          const rect = node.getBoundingClientRect();
          const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
          return { height: rect.height, hitSelf: hit === node || node.contains(hit), top: rect.top, bottom: rect.bottom };
        });
        return {
          actions: { top: actions.top, bottom: actions.bottom },
          navBottom: nav.bottom,
          dockTop: dock.top,
          summaries,
          layout: root.querySelector(".sns-auth-layout")?.dataset.snsLayout,
          desktopImage: root.querySelector(".sns-auth-desktop-image")?.getAttribute("src"),
          openPickers: root.querySelectorAll("details[open]").length,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        };
      }, selector);
      console.log(profile.viewport, JSON.stringify(result));
      assert.equal(result.layout, "fresh-split", `${profile.viewport}: pointer layout selection applies`);
      assert.equal(result.desktopImage, "./assets/generated/account-sns-pop-v1.webp", `${profile.viewport}: pointer image selection applies`);
      assert.equal(result.openPickers, 0, `${profile.viewport}: picker closes after selection`);
      assert.ok(result.actions.top > result.navBottom, `${profile.viewport}: edit actions clear sticky menu`);
      assert.ok(result.summaries.every((item) => item.height >= 44), `${profile.viewport}: rendered summary targets are at least 44px`);
      assert.ok(result.summaries.every((item) => item.top >= result.navBottom), `${profile.viewport}: summary targets clear sticky menu`);
      assert.ok(result.overflow <= 1, `${profile.viewport}: no horizontal overflow`);
    } finally {
      await page.close();
    }
  }
  console.log("SNS auth edit actions browser tests OK");
} finally {
  await browser.close();
  await new Promise((resolveClosed) => server.close(resolveClosed));
}
