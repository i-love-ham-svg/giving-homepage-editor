import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { mkdir, readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || "playwright");
const origin = process.env.SONGAK_ORIGIN || "http://localhost:43217";
const executablePath = [
  process.env.BROWSER_EXECUTABLE,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
].filter(Boolean).find(existsSync);

const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 940 } });
const attemptedBoardMutations = [];
const screenshotDir = process.env.SONGAK_SCREENSHOT_DIR || "";
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

context.on("request", (request) => {
  const url = new URL(request.url());
  if (url.pathname.startsWith("/api/board/") && !["GET", "HEAD", "OPTIONS"].includes(request.method())) {
    attemptedBoardMutations.push({ method: request.method(), path: url.pathname });
  }
});

await context.route("**/api/board/admin/session**", async (route) => {
  await route.fulfill({
    status: 200,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify({
      authenticated: true,
      admin: true,
      email: "preview-qa@example.invalid",
      signInPath: "/staff-login?returnTo=%2Feditor%3Fsurface%3Dcommunity"
    })
  });
});

await context.route("**/api/board/posts?**", async (route) => {
  await route.fulfill({
    status: 200,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify({ items: [], total: 0, page: 1, pageSize: 9, totalPages: 1, admin: true })
  });
});

// Keep the browser regression independent from authenticated static-file
// middleware while serving the exact local editor artifacts under its normal
// same-origin /songak URL contract.
await context.route("**/songak/**", async (route) => {
  try {
    const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
    const relativePath = pathname.slice("/songak/".length);
    const filePath = resolve(outputRoot, relativePath || "representative-greeting-editor.html");
    if (filePath !== outputRoot && !filePath.startsWith(`${outputRoot}${sep}`)) throw new Error("invalid path");
    const fileStat = await stat(filePath);
    const resolvedPath = fileStat.isDirectory() ? resolve(filePath, "index.html") : filePath;
    await route.fulfill({
      status: 200,
      contentType: contentTypes[extname(resolvedPath)] || "application/octet-stream",
      body: await readFile(resolvedPath)
    });
  } catch {
    await route.fulfill({ status: 404, contentType: "text/plain; charset=utf-8", body: "Not found" });
  }
});

const page = await context.newPage();
page.setDefaultTimeout(120_000);
const browserErrors = [];
page.on("pageerror", (error) => browserErrors.push(error.message));

const profiles = [
  { viewport: "desktop", minWidth: 900 },
  { viewport: "tablet", minWidth: 640 },
  { viewport: "phone", minWidth: 360 },
  { viewport: "phoneSmall", minWidth: 300 }
];

const results = [];
try {
  if (screenshotDir) await mkdir(screenshotDir, { recursive: true });
  await page.goto(`${origin}/editor?surface=community`, { waitUntil: "domcontentloaded" });
  const editorFrame = page.frameLocator("iframe.editor-frame");
  await editorFrame.locator('body[data-editor-boot-state="ready"]').waitFor({ state: "attached" });
  await editorFrame.locator("iframe.community-editor-surface").waitFor({ state: "attached" });
  const communityFrame = editorFrame.frameLocator("iframe.community-editor-surface");
  await communityFrame.locator("#community-editor-preview-note").waitFor({ state: "visible" });

  for (const profile of profiles) {
    const switcher = editorFrame.locator(`[data-staff-viewport="${profile.viewport}"]`);
    await switcher.click();
    await editorFrame.locator(`[data-staff-viewport="${profile.viewport}"][aria-pressed="true"]`).waitFor();
    await communityFrame.locator("#community-editor-preview-note").waitFor({ state: "visible" });

    const metric = await communityFrame.locator("body").evaluate((body) => {
      const note = document.getElementById("community-editor-preview-note");
      const managementLink = note?.querySelector("a");
      const noteRect = note?.getBoundingClientRect();
      const linkRect = managementLink?.getBoundingClientRect();
      const primary = document.querySelector(".board-intro-actions .primary-btn");
      const secondary = document.querySelector(".board-intro-actions .secondary-btn");
      const emptyWrite = document.querySelector(".empty-state .primary-btn");
      return {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        previewClass: Boolean(body.querySelector(".community-editor-embed")),
        noteVisible: Boolean(noteRect && noteRect.width > 0 && noteRect.height > 0),
        noteInsideViewport: Boolean(noteRect && noteRect.left >= -1 && noteRect.right <= window.innerWidth + 1),
        noteText: note?.textContent?.replace(/\s+/g, " ").trim() || "",
        managementHref: managementLink?.getAttribute("href") || "",
        managementTarget: managementLink?.getAttribute("target") || "",
        managementRel: managementLink?.getAttribute("rel") || "",
        managementTouchHeight: linkRect?.height || 0,
        primaryDisabled: primary?.getAttribute("aria-disabled"),
        primaryDescription: primary?.getAttribute("aria-describedby"),
        secondaryDisabled: secondary?.getAttribute("aria-disabled"),
        emptyWriteDisabled: emptyWrite?.getAttribute("aria-disabled"),
        adminConsoleCount: document.querySelectorAll(".admin-console").length,
        moderationCount: document.querySelectorAll(".moderation-panel").length,
        detailToolsCount: document.querySelectorAll(".detail-tools").length,
        noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
      };
    });

    assert.equal(metric.previewClass, true, JSON.stringify(metric));
    assert.equal(metric.noteVisible, true, JSON.stringify(metric));
    assert.equal(metric.noteInsideViewport, true, JSON.stringify(metric));
    assert.match(metric.noteText, /시각 편집 미리보기/);
    assert.match(metric.noteText, /게시글 등록·검수·삭제/);
    assert.equal(metric.managementHref, "/community?manage=1");
    assert.equal(metric.managementTarget, "_blank");
    assert.equal(metric.managementRel, "noopener noreferrer");
    assert.ok(metric.managementTouchHeight >= 44, JSON.stringify(metric));
    assert.equal(metric.primaryDisabled, "true");
    assert.equal(metric.primaryDescription, "community-editor-preview-note");
    assert.equal(metric.secondaryDisabled, "true");
    assert.equal(metric.emptyWriteDisabled, "true");
    assert.equal(metric.adminConsoleCount, 0);
    assert.equal(metric.moderationCount, 0);
    assert.equal(metric.detailToolsCount, 0);
    assert.equal(metric.noHorizontalOverflow, true, JSON.stringify(metric));
    assert.ok(metric.viewport.width >= profile.minWidth, JSON.stringify(metric));

    await communityFrame.locator(".board-intro-actions .primary-btn").dispatchEvent("click");
    assert.equal(await communityFrame.locator("dialog.write-dialog[open]").count(), 0);
    if (screenshotDir) {
      await page.screenshot({ path: resolve(screenshotDir, `community-editor-${profile.viewport}.png`), fullPage: false });
    }
    results.push({ profile: profile.viewport, ...metric });
  }

  assert.deepEqual(attemptedBoardMutations, [], `embedded preview attempted board mutations: ${JSON.stringify(attemptedBoardMutations)}`);
  assert.deepEqual(browserErrors, [], `browser errors: ${JSON.stringify(browserErrors)}`);
  console.log(JSON.stringify({ origin, attemptedBoardMutations, results }, null, 2));
  console.log("community editor preview browser tests OK");
} finally {
  await context.close();
  await browser.close();
}
