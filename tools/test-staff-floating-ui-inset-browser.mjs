import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || "playwright");
const executablePath = [
  process.env.BROWSER_EXECUTABLE,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
].filter(Boolean).find(existsSync);

const outputRoot = resolve("outputs");
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

const serverErrors = [];
const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, "http://127.0.0.1");
    const pathname = decodeURIComponent(requestUrl.pathname);
    if (pathname === "/api/board/admin/session") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" }).end(JSON.stringify({ admin: true }));
      return;
    }
    if (pathname.startsWith("/api/")) {
      response.writeHead(404, { "content-type": "application/json; charset=utf-8" }).end("{}");
      return;
    }
    const relativePath = pathname.startsWith("/songak/")
      ? pathname.slice("/songak/".length)
      : pathname.replace(/^\/+/, "");
    const filePath = resolve(outputRoot, relativePath || "representative-greeting-editor.html");
    if (filePath !== outputRoot && !filePath.startsWith(`${outputRoot}${sep}`)) throw new Error("invalid path");
    const fileStat = await stat(filePath);
    const resolvedPath = fileStat.isDirectory() ? resolve(filePath, "index.html") : filePath;
    response.writeHead(200, { "content-type": contentTypes[extname(resolvedPath)] || "application/octet-stream" });
    response.end(await readFile(resolvedPath));
  } catch (error) {
    serverErrors.push(`${request.url}: ${error.message}`);
    if (!response.headersSent) response.writeHead(404);
    response.end("Not found");
  }
});

await new Promise((resolveReady) => server.listen(0, "127.0.0.1", resolveReady));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

const profiles = [
  { width: 320, height: 720, viewport: "phoneSmall" },
  { width: 390, height: 844, viewport: "phone" },
  { width: 768, height: 900, viewport: "tablet" },
  { width: 1360, height: 900, viewport: "desktop" }
].filter((profile) => !process.env.ONLY_WIDTH || profile.width === Number(process.env.ONLY_WIDTH));

function assertClearsDock(result, key) {
  assert.equal(result[key].visible, true, `${key} must be visible`);
  assert.ok(result[key].bottom <= result.safeBottom + 1, `${key} crossed staff dock safe edge: ${JSON.stringify(result)}`);
  assert.ok(result.dock.top - result[key].bottom >= 11, `${key} must retain the 12px dock gap: ${JSON.stringify(result)}`);
}

async function measure(page, selector) {
  return page.evaluate((targetSelector) => {
    const dock = document.getElementById("staffEditorDock");
    const target = document.querySelector(targetSelector);
    const dockRect = dock.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const inset = Math.ceil(window.innerHeight - dockRect.top + 12);
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      inset,
      safeBottom: window.innerHeight - inset,
      dock: { top: dockRect.top, bottom: dockRect.bottom, height: dockRect.height },
      target: {
        visible: !target.hidden && getComputedStyle(target).display !== "none" && targetRect.width > 0 && targetRect.height > 0,
        top: targetRect.top,
        bottom: targetRect.bottom,
        height: targetRect.height
      },
      noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
    };
  }, selector);
}

const results = [];
try {
  for (const profile of profiles) {
    const page = await browser.newPage({ viewport: { width: profile.width, height: profile.height } });
    const browserErrors = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    page.setDefaultTimeout(60_000);
    try {
      const navigation = await page.goto(`${origin}/songak/representative-greeting-editor.html?role=staff&mode=edit&viewport=${profile.viewport}`, { waitUntil: "domcontentloaded" });
      await Promise.race([
        page.waitForFunction(() => ["ready", "error"].includes(document.body.dataset.editorBootState)),
        page.waitForTimeout(10_000)
      ]);
      const bootState = await page.evaluate(() => ({ state: document.body.dataset.editorBootState, role: document.body.dataset.editorRole, error: window.__songakEditorBoot?.error || "", body: document.body.textContent.slice(0, 80) }));
      assert.deepEqual({ state: bootState.state, role: bootState.role, error: bootState.error }, { state: "ready", role: "staff", error: "" }, `editor boot failed: ${JSON.stringify({ status: navigation?.status(), bootState, browserErrors, serverErrors })}`);
      await page.evaluate(() => new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame))));

      const dockMetric = await measure(page, "#staffEditorDock");
      assert.equal(dockMetric.target.visible, true, "staff dock must be visible");
      assert.ok(Math.abs(dockMetric.safeBottom - (dockMetric.dock.top - 12)) <= 1, `shared inset must reserve 12px: ${JSON.stringify(dockMetric)}`);

      await page.locator("#backgroundFloatToggle").click({ force: true });
      await page.waitForFunction(() => document.getElementById("backgroundFloat").classList.contains("open"));
      const backgroundMetric = await measure(page, "#backgroundFloat");
      const backgroundResult = { ...backgroundMetric, background: backgroundMetric.target };
      assertClearsDock(backgroundResult, "background");

      const selectedLayerId = await page.evaluate(() => {
        const items = [...document.querySelectorAll("#layerList .layer-item")];
        for (const item of items) {
          item.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
          if (!document.getElementById("inlineToolbar").hidden) return item.textContent.trim();
        }
        return "";
      });
      assert.ok(selectedLayerId, "a visible editable layer must open the existing toolbar");
      await page.waitForTimeout(180);
      const toolbarMetric = await measure(page, "#inlineToolbar");
      const toolbarResult = { ...toolbarMetric, toolbar: toolbarMetric.target };
      assertClearsDock(toolbarResult, "toolbar");

      const dragHandleBox = await page.locator("#toolbarDragHandle").boundingBox();
      assert.ok(dragHandleBox, "toolbar drag handle must be measurable");
      await page.mouse.move(dragHandleBox.x + dragHandleBox.width / 2, dragHandleBox.y + dragHandleBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(profile.width - 10, Math.max(12, dockMetric.dock.top - 2), { steps: 4 });
      await page.mouse.up();
      await page.waitForTimeout(180);
      const draggedToolbarMetric = await measure(page, "#inlineToolbar");
      const draggedToolbarResult = { ...draggedToolbarMetric, draggedToolbar: draggedToolbarMetric.target };
      assertClearsDock(draggedToolbarResult, "draggedToolbar");

      const collapsed = await page.evaluate(() => {
        document.getElementById("toolbarCollapseBtn").click();
        return !document.getElementById("inlineToolbarFloat").hidden;
      });
      assert.equal(collapsed, true, "existing collapse action must show the compact toolbar control");
      const collapsedMetric = await measure(page, "#inlineToolbarFloat");
      const collapsedResult = { ...collapsedMetric, collapsedToolbar: collapsedMetric.target };
      assertClearsDock(collapsedResult, "collapsedToolbar");

      await page.locator("#backgroundFloatToggle").click({ force: true });
      await page.locator("#decorationFloatToggle").click({ force: true });
      await page.waitForFunction(() => !document.getElementById("decorationPickerModal").hidden);
      await page.evaluate(() => new Promise((resolveFrame) => requestAnimationFrame(resolveFrame)));
      const decorationMetric = await measure(page, "#decorationPickerModal .decoration-picker-dialog");
      const decorationResult = { ...decorationMetric, decoration: decorationMetric.target };
      assertClearsDock(decorationResult, "decoration");

      [backgroundResult, toolbarResult, draggedToolbarResult, collapsedResult, decorationResult].forEach((result) => {
        assert.equal(result.noHorizontalOverflow, true, `floating UI must not create horizontal overflow: ${JSON.stringify(result)}`);
      });

      results.push({
        profile,
        inset: dockMetric.inset,
        dockTop: dockMetric.dock.top,
        gaps: {
          background: Math.round(dockMetric.dock.top - backgroundMetric.target.bottom),
          toolbar: Math.round(dockMetric.dock.top - toolbarMetric.target.bottom),
          draggedToolbar: Math.round(dockMetric.dock.top - draggedToolbarMetric.target.bottom),
          collapsedToolbar: Math.round(dockMetric.dock.top - collapsedMetric.target.bottom),
          decoration: Math.round(dockMetric.dock.top - decorationMetric.target.bottom)
        }
      });
    } finally {
      await page.close();
    }
  }

  console.log(JSON.stringify(results, null, 2));
  console.log("staff floating UI inset browser tests OK");
} finally {
  await browser.close();
  await new Promise((resolveClosed) => server.close(resolveClosed));
}
