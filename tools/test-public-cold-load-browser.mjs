import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { extname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || "playwright");
const workspaceRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const outputRoot = resolve(workspaceRoot, "outputs");
const canonicalEditorFile = resolve(outputRoot, "representative-greeting-editor.html");
const executablePath = [
  process.env.BROWSER_EXECUTABLE,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean).find(existsSync);

const readyBudgetMs = Number(process.env.SONGAK_PUBLIC_READY_BUDGET_MS || 4_000);
const overlayBudgetMs = Number(process.env.SONGAK_PUBLIC_OVERLAY_BUDGET_MS || 4_500);
const contentBudgetMs = Number(process.env.SONGAK_PUBLIC_CONTENT_BUDGET_MS || 2_000);
const expectedFullSectionOrder = Object.freeze([
  "mainIntro",
  "essential2",
  "program",
  "process",
  "essential16",
  "essential17",
  "essential18",
  "essential19",
  "essential6",
  "schedule",
  "essential12",
  "essential13",
  "essential14",
  "essential15",
  "facility",
  "essential8",
  "essential9",
  "essential10",
  "essential11",
  "essential5",
  "greeting",
  "essential4",
  "organization",
  "essential20",
  "essential21",
  "essential22",
  "essential23",
  "history",
  "volunteer",
  "donation",
  "notice",
  "gallery",
  "essential7",
  "essential24",
  "essential25",
  "essential26",
  "essential3",
  "location",
  "essential27",
  "essential28",
  "essential29",
  "essential30",
  "footer",
]);
// Persisted full publications already reflect retirement of the duplicate
// visitor-board section. Its former `essential8` slot is intentionally reused
// as `essential31` by the maintained detail presentation set, and the storage
// normalizer produces this canonical full-document order.
const expectedPublishedFullSectionOrder = Object.freeze([
  "mainIntro",
  "notice",
  "program",
  "schedule",
  "essential12",
  "essential13",
  "essential14",
  "essential15",
  "process",
  "essential16",
  "essential17",
  "essential18",
  "essential19",
  "facility",
  "essential31",
  "essential9",
  "essential10",
  "essential11",
  "organization",
  "essential20",
  "essential21",
  "essential22",
  "essential23",
  "greeting",
  "location",
  "history",
  "volunteer",
  "donation",
  "gallery",
  "essential2",
  "essential6",
  "essential5",
  "essential4",
  "essential7",
  "essential24",
  "essential25",
  "essential26",
  "essential3",
  "essential27",
  "essential28",
  "essential29",
  "essential30",
  "footer",
]);
const viewports = Object.freeze([
  { name: "desktop", profile: "desktop", width: 1440, height: 900, touch: false },
  { name: "mobile-390", profile: "phone", width: 390, height: 844, touch: true },
]);
const branchCases = Object.freeze([
  { scenario: "canonical", requests: ["home-menu-intro-main"], order: ["mainIntro", "greeting", "footer"] },
  { scenario: "legacy-document", requests: ["home-menu-intro-main"], order: expectedPublishedFullSectionOrder },
  { scenario: "incomplete-scope", requests: ["home-menu-intro-main"], order: expectedPublishedFullSectionOrder },
  { scenario: "network", requests: ["home-menu-intro-main", "full"], order: expectedPublishedFullSectionOrder },
]);
const mimeTypes = Object.freeze({
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".webp": "image/webp",
});

function isInside(parent, child) {
  const delta = relative(parent, child);
  return delta === "" || (!delta.startsWith("..") && !isAbsolute(delta));
}

function listen(server) {
  return new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", rejectListen);
      const address = server.address();
      resolveListen(`http://127.0.0.1:${address.port}`);
    });
  });
}

function close(server) {
  return new Promise((resolveClose, rejectClose) => {
    server.close((error) => error ? rejectClose(error) : resolveClose());
  });
}

function sendJson(response, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  response.writeHead(200, {
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(body),
    "content-type": "application/json; charset=utf-8",
    "x-content-type-options": "nosniff",
    ...extraHeaders,
  });
  response.end(body);
}

function findMenuItem(items, menuId) {
  for (const item of Array.isArray(items) ? items : []) {
    if (item?.id === menuId) return item;
    const nested = findMenuItem(item?.children, menuId);
    if (nested) return nested;
  }
  return null;
}

function createCanonicalScopedResponse(fullContent, scope) {
  const sourceDocument = fullContent?.document;
  const menuItem = findMenuItem(sourceDocument?.globals?.homeMenu?.items, scope);
  assert.ok(sourceDocument && menuItem, `fixture can resolve canonical scope ${scope}`);
  const linkedIds = [...new Set([
    ...(Array.isArray(menuItem.sectionIds) ? menuItem.sectionIds : []),
    menuItem.sectionId,
  ].map((value) => String(value || "").trim()).filter(Boolean))];
  const requiredIds = new Set([...linkedIds, "footer"]);
  const sections = sourceDocument.sections.filter((section) => requiredIds.has(section.id));
  const scopeSectionIds = sections.map((section) => section.id);
  assert.ok(scopeSectionIds.includes("footer"), "canonical scoped fixture retains the footer");
  return {
    key: "songak-homepage",
    content: {
      schemaVersion: fullContent.schemaVersion,
      document: {
        ...structuredClone(sourceDocument),
        activeSectionId: scopeSectionIds.includes(sourceDocument.activeSectionId)
          ? sourceDocument.activeSectionId
          : scopeSectionIds[0],
        sectionOrder: [...scopeSectionIds],
        sections: structuredClone(sections),
      },
    },
    revision: 1,
    publishedAt: "2026-08-13T00:00:00.000Z",
    scope,
    scopeSectionIds,
  };
}

// The default fixture reports an unpublished scope. Additional branch fixtures
// verify which exceptional responses may reuse their scoped payload and which
// one genuinely needs a second complete-document request.
function createColdLoadServer(requestLog, { scenario = "unpublished", fullContent = null } = {}) {
  return createServer((request, response) => {
    const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
    if (requestUrl.pathname === "/api/site-content/songak-homepage") {
      const scope = requestUrl.searchParams.get("scope");
      requestLog.push({ at: performance.now(), scope: scope || null });
      if (scope) {
        if (scenario === "network") {
          response.writeHead(503, {
            "cache-control": "no-store",
            "content-type": "application/json; charset=utf-8",
          });
          response.end(JSON.stringify({ error: "temporary upstream failure" }));
          return;
        }
        if (scenario === "canonical") {
          sendJson(response, createCanonicalScopedResponse(fullContent, scope), {
            "x-site-content-scope": scope,
          });
          return;
        }
        if (scenario === "legacy-document" || scenario === "incomplete-scope") {
          sendJson(response, {
            key: "songak-homepage",
            content: fullContent,
            revision: 1,
            publishedAt: "2026-08-13T00:00:00.000Z",
            scope,
            scopeFallback: scenario,
          }, {
            "x-site-content-scope": scope,
            "x-site-content-scope-fallback": scenario,
          });
          return;
        }
        sendJson(response, {
          key: "songak-homepage",
          content: null,
          revision: 0,
          publishedAt: null,
          scope,
          scopeFallback: "unpublished",
        }, {
          "x-site-content-scope": scope,
          "x-site-content-scope-fallback": "unpublished",
        });
        return;
      }
      sendJson(response, {
        key: "songak-homepage",
        content: fullContent,
        revision: fullContent ? 1 : 0,
        publishedAt: fullContent ? "2026-08-13T00:00:00.000Z" : null,
      });
      return;
    }

    const mountedPath = decodeURIComponent(requestUrl.pathname)
      .replace(/^\/+/, "")
      .replace(/^songak\/?/, "");
    const isPublicPage = mountedPath === ""
      || /^(?:about|programs|participation|news)(?:\/|$)/.test(mountedPath)
      || ["directions", "privacy-policy", "email-refusal"].includes(mountedPath);
    const filePath = isPublicPage
      ? canonicalEditorFile
      : resolve(outputRoot, mountedPath);
    if (!isInside(outputRoot, filePath) || !existsSync(filePath) || !statSync(filePath).isFile()) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    response.writeHead(200, {
      "cache-control": "no-store",
      "content-type": mimeTypes[extname(filePath).toLowerCase()] || "application/octet-stream",
      "x-content-type-options": "nosniff",
    });
    createReadStream(filePath).pipe(response);
  });
}

const requestLog = [];
const fixtureServer = createColdLoadServer(requestLog);
const origin = await listen(fixtureServer);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const reports = [];

try {
  for (const testCase of viewports) {
    const context = await browser.newContext({
      viewport: { width: testCase.width, height: testCase.height },
      hasTouch: testCase.touch,
    });
    const cdp = await context.newCDPSession(await context.newPage());
    const pages = context.pages();
    const page = pages[0];
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    const firstRequest = requestLog.length;
    const coldToken = `${testCase.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      await page.goto(`${origin}/about?viewport=${testCase.profile}&cold=${coldToken}`, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      await page.waitForFunction(() => document.body.dataset.editorBootState === "ready", null, {
        timeout: readyBudgetMs + 5_000,
      });
      await page.locator("#editorBootOverlay").waitFor({ state: "hidden", timeout: overlayBudgetMs + 5_000 });

      const result = await page.evaluate(() => {
        const boot = window.__songakEditorBoot || {};
        const order = window.EditorModules?.sectionManager?.getOrder?.() || [];
        const footerModel = window.EditorModules?.essential?.getContent?.("footer") || null;
        const footerLayer = document.querySelector('.essential-section-layer[data-section-id="footer"]');
        const navigation = performance.getEntriesByType("navigation")[0];
        const scopeResources = performance.getEntriesByType("resource")
          .filter((entry) => entry.name.includes("/api/site-content/songak-homepage"))
          .map((entry) => ({ name: entry.name, duration: entry.duration, transferSize: entry.transferSize }));
        return {
          appVisibility: getComputedStyle(document.querySelector(".app")).visibility,
          bodyBootState: document.body.dataset.editorBootState,
          bodyStillBooting: document.body.classList.contains("is-app-booting"),
          boot: {
            state: boot.state,
            readyMs: boot.readyAt - boot.startedAt,
            overlayHiddenMs: boot.overlayHiddenAt - boot.startedAt,
            contentMs: boot.siteContentReadyAt - boot.siteContentStartedAt,
            contentStartedAt: boot.siteContentStartedAt,
            contentReadyAt: boot.siteContentReadyAt,
            contentDecodedBytes: boot.siteContentDecodedBytes,
            appHiddenAtPaint: boot.appHiddenAtPaint,
            overlayVisibleAtPaint: boot.overlayVisibleAtPaint,
          },
          order,
          footerLast: order.at(-1) === "footer",
          footerModelPresent: Boolean(footerModel),
          footerLayerPresent: Boolean(footerLayer),
          footerTemplate: footerLayer?.querySelector(".essential-section-content")?.dataset.essentialTemplate || "",
          topMenuCount: document.querySelectorAll("#homepageMenuList > .homepage-menu-item.level-1").length,
          horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          navigation: navigation ? {
            transferSize: navigation.transferSize,
            domContentLoadedMs: navigation.domContentLoadedEventEnd,
            loadMs: navigation.loadEventEnd,
          } : null,
          scopeResources,
        };
      });
      const apiRequests = requestLog.slice(firstRequest);

      assert.deepEqual(pageErrors, [], `${testCase.name}: public cold load has no page errors`);
      assert.equal(result.bodyBootState, "ready", `${testCase.name}: body reaches ready state`);
      assert.equal(result.bodyStillBooting, false, `${testCase.name}: booting class is removed`);
      assert.equal(result.appVisibility, "visible", `${testCase.name}: public application is visible`);
      assert.equal(result.boot.state, "ready", `${testCase.name}: boot record reaches ready`);
      assert.equal(result.boot.appHiddenAtPaint, true, `${testCase.name}: incomplete app is hidden at first paint`);
      assert.equal(result.boot.overlayVisibleAtPaint, true, `${testCase.name}: loading overlay protects first paint`);
      assert.ok(result.boot.readyMs > 0 && result.boot.readyMs <= readyBudgetMs,
        `${testCase.name}: ready ${result.boot.readyMs.toFixed(1)}ms exceeds ${readyBudgetMs}ms budget`);
      assert.ok(result.boot.overlayHiddenMs >= result.boot.readyMs && result.boot.overlayHiddenMs <= overlayBudgetMs,
        `${testCase.name}: overlay ${result.boot.overlayHiddenMs.toFixed(1)}ms exceeds ${overlayBudgetMs}ms budget`);
      assert.ok(result.boot.contentStartedAt > 0 && result.boot.contentReadyAt >= result.boot.contentStartedAt,
        `${testCase.name}: scoped content timing markers are valid`);
      assert.ok(result.boot.contentMs >= 0 && result.boot.contentMs <= contentBudgetMs,
        `${testCase.name}: scoped content ${result.boot.contentMs.toFixed(1)}ms exceeds ${contentBudgetMs}ms budget`);
      assert.ok(result.boot.contentDecodedBytes > 0, `${testCase.name}: scoped response byte count is recorded`);
      assert.deepEqual(result.order, expectedFullSectionOrder,
        `${testCase.name}: unpublished fallback retains every canonical section`);
      assert.equal(result.footerLast, true, `${testCase.name}: footer remains the terminal section`);
      assert.equal(result.footerModelPresent, true, `${testCase.name}: footer content remains in the model`);
      assert.equal(result.footerLayerPresent, true, `${testCase.name}: footer remains mounted on the public page`);
      assert.equal(result.footerTemplate, "footer", `${testCase.name}: footer uses its canonical template`);
      assert.ok(result.topMenuCount >= 5, `${testCase.name}: complete primary navigation remains available`);
      assert.equal(result.horizontalOverflow, false, `${testCase.name}: cold public page has no horizontal overflow`);
      assert.equal(apiRequests.length, 1, `${testCase.name}: unpublished cold load performs only the scoped read`);
      assert.equal(apiRequests[0].scope, "home-menu-intro-main", `${testCase.name}: head prefetch requests the route scope first`);
      assert.equal(result.scopeResources.length, 1, `${testCase.name}: browser records exactly one site-content HTTP resource`);

      reports.push({
        viewport: testCase.name,
        readyMs: Math.round(result.boot.readyMs),
        overlayHiddenMs: Math.round(result.boot.overlayHiddenMs),
        contentMs: Math.round(result.boot.contentMs),
        sections: result.order.length,
        apiRequests: apiRequests.map(({ scope }) => scope || "full"),
      });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  await close(fixtureServer);
}

// Exercise the remaining response contracts once on desktop. `unpublished` is
// covered above in both required viewports because it is the initial-production
// case. These branch checks isolate request-count regressions from rendering or
// viewport regressions, and use the canonical checked-in 43-section document as
// the full payload without changing files or publishing data.
const branchSourceLog = [];
const branchSourceServer = createColdLoadServer(branchSourceLog);
const branchSourceOrigin = await listen(branchSourceServer);
const branchSourceBrowser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
let fullContent;
try {
  const context = await branchSourceBrowser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${branchSourceOrigin}/about?viewport=desktop&branch-source=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.body.dataset.editorBootState === "ready", null, { timeout: readyBudgetMs + 5_000 });
  fullContent = await page.evaluate(() => ({
    schemaVersion: 5,
    document: window.EditorModules.storage.createSectionDocument(),
  }));
  await context.close();
} finally {
  await branchSourceBrowser.close();
  await close(branchSourceServer);
}
assert.deepEqual(fullContent.document.sectionOrder, expectedFullSectionOrder,
  "branch fixture source remains the complete checked-in 43-section document");
// Convert the checked-in renderer snapshot through the same storage contract
// that produces a publish payload. This makes the legacy/incomplete fixtures a
// current valid full document instead of an artificial mixed-generation model.
const normalizeRequestLog = [];
const normalizeServer = createColdLoadServer(normalizeRequestLog, {
  scenario: "legacy-document",
  fullContent,
});
const normalizeOrigin = await listen(normalizeServer);
const normalizeBrowser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
try {
  const context = await normalizeBrowser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${normalizeOrigin}/about?viewport=desktop&normalize-published=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.body.dataset.editorBootState === "ready", null, { timeout: readyBudgetMs + 5_000 });
  fullContent = await page.evaluate(() => ({
    schemaVersion: 5,
    document: window.EditorModules.storage.createSectionDocument(),
  }));
  await context.close();
} finally {
  await normalizeBrowser.close();
  await close(normalizeServer);
}
assert.deepEqual(fullContent.document.sectionOrder, expectedPublishedFullSectionOrder,
  "published full fixture follows the current storage normalizer and retired visitor-board policy");

for (const branchCase of branchCases) {
  const branchRequestLog = [];
  const branchServer = createColdLoadServer(branchRequestLog, {
    scenario: branchCase.scenario,
    fullContent,
  });
  const branchOrigin = await listen(branchServer);
  const branchBrowser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  try {
    const context = await branchBrowser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto(`${branchOrigin}/about?viewport=desktop&branch=${branchCase.scenario}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.body.dataset.editorBootState === "ready", null, { timeout: readyBudgetMs + 5_000 });
    const branchResult = await page.evaluate(() => ({
      order: window.EditorModules?.sectionManager?.getOrder?.() || [],
      footerLast: window.EditorModules?.sectionManager?.getOrder?.().at(-1) === "footer",
      footerPresent: Boolean(window.EditorModules?.essential?.getContent?.("footer")),
    }));
    const requestKinds = branchRequestLog.map(({ scope }) => scope || "full");
    assert.deepEqual(pageErrors, [], `${branchCase.scenario}: branch has no page errors`);
    assert.deepEqual(requestKinds, branchCase.requests, `${branchCase.scenario}: expected HTTP request count and order`);
    assert.deepEqual(branchResult.order, branchCase.order, `${branchCase.scenario}: expected section contract`);
    assert.equal(branchResult.footerLast, true, `${branchCase.scenario}: footer remains terminal`);
    assert.equal(branchResult.footerPresent, true, `${branchCase.scenario}: footer content remains available`);
    reports.push({
      branch: branchCase.scenario,
      sections: branchResult.order.length,
      apiRequests: requestKinds,
    });
    await context.close();
  } finally {
    await branchBrowser.close();
    await close(branchServer);
  }
}

console.log(JSON.stringify(reports, null, 2));
console.log(`public HTTP cold-load browser gate OK (${viewports.length} viewports + ${branchCases.length} response branches, ready <= ${readyBudgetMs}ms)`);
