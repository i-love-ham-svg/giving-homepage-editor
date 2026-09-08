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
const types = { ".css": "text/css", ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const writes = [];
const server = createServer(async (request, response) => {
  try {
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) writes.push(`${request.method} ${request.url}`);
    const url = new URL(request.url, "http://127.0.0.1");
    if (url.pathname === "/api/board/admin/session") {
      response.writeHead(200, { "content-type": "application/json" }).end('{"admin":true}');
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      response.writeHead(200, { "content-type": "application/json" }).end("{}");
      return;
    }
    const relative = decodeURIComponent(url.pathname).replace(/^\/songak\//, "").replace(/^\/+/, "") || "representative-greeting-editor.html";
    const file = resolve(outputRoot, relative);
    if (file !== outputRoot && !file.startsWith(`${outputRoot}${sep}`)) throw new Error("invalid path");
    const info = await stat(file);
    const resolved = info.isDirectory() ? resolve(file, "index.html") : file;
    response.writeHead(200, { "content-type": `${types[extname(resolved)] || "application/octet-stream"}; charset=utf-8` });
    response.end(await readFile(resolved));
  } catch {
    response.writeHead(404).end("Not found");
  }
});

await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const profiles = [
  { name: "desktop", width: 1360, height: 900 },
  { name: "tablet", width: 768, height: 900 },
  { name: "phone", width: 390, height: 844 },
  { name: "phoneSmall", width: 320, height: 720 }
];

async function stateOf(page) {
  return page.evaluate(() => {
    const ids = window.EditorModalCoordinator?.getOpenSurfaceIds?.() || [];
    const boundaries = ids.filter((id) => !(id === "notice-text-editor" && ids.includes("notice-composer")));
    const transients = [
      document.getElementById("backgroundFloat")?.classList.contains("open") ? "background" : "",
      document.querySelector(".section-appearance-menu:not([hidden]), .section-style-choice-menu:not([hidden])") ? "section-menu" : "",
      document.querySelector("details.sns-auth-image-picker[open], details.sns-auth-layout-picker[open]") ? "sns-details" : ""
    ].filter(Boolean);
    return {
      ids,
      boundaries,
      transients,
      childInsideComposer: document.getElementById("essentialNoticeTextEditorModal")?.parentElement === document.getElementById("essentialNoticeComposerModal"),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2
    };
  });
}

function assertContract(value, label) {
  assert.ok(value.boundaries.length <= 1, `${label}: independent modal boundaries ${JSON.stringify(value)}`);
  assert.ok(!(value.boundaries.length && value.transients.length), `${label}: modal and transient overlap ${JSON.stringify(value)}`);
  assert.equal(value.overflow, false, `${label}: horizontal overflow ${JSON.stringify(value)}`);
}

const results = [];
try {
  for (const profile of profiles) {
    const page = await browser.newPage({ viewport: { width: profile.width, height: profile.height } });
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.addInitScript(() => localStorage.removeItem("sacwcWebsiteEditor"));
    await page.goto(`${origin}/songak/representative-greeting-editor.html?mode=edit&viewport=${profile.name}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.body.dataset.editorBootState === "ready", null, { timeout: 60_000 });

    const checkpoints = [];
    const check = async (label) => {
      const value = await stateOf(page);
      assertContract(value, `${profile.name}/${label}`);
      checkpoints.push({ label, ...value });
      return value;
    };

    // Real menu button -> real transient background. The coordinator must replace,
    // rather than stack, the two independent editing tasks.
    await page.evaluate(() => document.getElementById("homepageMenuEditBtn")?.click());
    assert.deepEqual((await check("menu")).ids, ["menu-editor"]);
    await page.evaluate(() => document.getElementById("backgroundFloatToggle")?.click());
    const blockedBackground = await check("background-blocked-by-menu");
    assert.deepEqual(blockedBackground.ids, ["menu-editor"]);
    assert.deepEqual(blockedBackground.transients, []);
    await page.keyboard.press("Escape");
    await page.evaluate(() => document.getElementById("backgroundFloatToggle")?.click());
    assert.deepEqual((await check("background")).transients, ["background"]);
    await page.keyboard.press("Escape");
    assert.deepEqual((await check("background-escape")).transients, []);

    // The staff section manager has no staff-dock launch button by design, so use
    // the public coordinator API to exercise the same surface contract without
    // changing editor data.
    await page.evaluate(() => {
      if (!window.EditorModalCoordinator.prepare("staff-section-manager")) throw new Error("staff manager prepare blocked");
      document.getElementById("staffSectionManager").hidden = false;
      document.getElementById("staffSectionBackdrop").hidden = false;
    });
    assert.deepEqual((await check("staff-section-manager")).ids, ["staff-section-manager"]);
    await page.keyboard.press("Escape");
    assert.deepEqual((await check("staff-section-manager-escape")).ids, []);

    // Exercise real icon buttons from three mounted section types.
    for (const [label, sectionSelector, buttonSelector, expected] of [
      ["process-icon", ".process-section-layer", "[data-process-action='select-step-icon']", "process-icon-picker"],
      ["history-icon", ".history-section-layer", "[data-history-action='open-icon-picker']", "history-icon-picker"],
      ["donation-icon", ".donation-section-layer", "[data-donation-action='open-icon-picker']", "donation-icon-picker"]
    ]) {
      const opened = await page.evaluate(({ sectionSelector, buttonSelector }) => {
        const section = document.querySelector(sectionSelector);
        const button = section?.querySelector(buttonSelector);
        if (!button) return false;
        button.click();
        return true;
      }, { sectionSelector, buttonSelector });
      if (opened) {
        assert.deepEqual((await check(label)).ids, [expected]);
        await page.keyboard.press("Escape");
      }
    }

    // Real page-decoration action mutates only the unsaved, isolated browser state.
    await page.locator("#decorationFloatToggle").click({ force: true });
    assert.deepEqual((await check("decoration")).ids, ["decoration-picker"]);
    await page.keyboard.press("Escape");

    // Open a notice composer from its real card, then its embedded text inspector.
    const noticeReady = await page.evaluate(() => {
      const button = document.querySelector('[data-essential-action="open-notice-composer"]');
      if (!(button instanceof HTMLButtonElement)) return false;
      button.click();
      return true;
    });
    if (noticeReady) {
      await page.waitForFunction(() => !document.getElementById("essentialNoticeComposerModal")?.hidden);
      assert.deepEqual((await check("notice-composer")).ids, ["notice-composer"]);
      await page.locator("#essentialNoticeComposerTitle").click({ force: true });
      await page.waitForFunction(() => !document.getElementById("essentialNoticeTextEditorModal").hidden);
      const nested = await check("notice-text-inspector");
      assert.deepEqual(nested.ids.sort(), ["notice-composer", "notice-text-editor"]);
      assert.equal(nested.childInsideComposer, true);
      await page.keyboard.press("Escape");
      assert.deepEqual((await check("notice-inspector-escape")).ids, ["notice-composer"]);
      await page.keyboard.press("Escape");
      assert.deepEqual((await check("notice-composer-escape")).ids, []);
    }

    // Details self-open semantics: opening the second details closes the first;
    // Escape closes the transient before any parent dialog.
    const snsReady = await page.evaluate(() => Boolean(
      document.querySelector("details.sns-auth-image-picker > summary")
      && document.querySelector("details.sns-auth-layout-picker > summary")
    ));
    if (snsReady) {
      await page.evaluate(() => document.querySelector("details.sns-auth-image-picker > summary")?.click());
      assert.deepEqual((await check("sns-image-details")).transients, ["sns-details"]);
      await page.evaluate(() => document.querySelector("details.sns-auth-layout-picker > summary")?.click());
      const detailCount = await page.locator("details.sns-auth-image-picker[open], details.sns-auth-layout-picker[open]").count();
      assert.equal(detailCount, 1, `${profile.name}: SNS details must self-replace`);
      await page.keyboard.press("Escape");
      assert.deepEqual((await check("sns-details-escape")).transients, []);
      await page.evaluate(() => document.querySelector(".sns-auth-config-trigger")?.click());
      assert.deepEqual((await check("sns-config")).ids, ["sns-auth-config"]);
      await page.keyboard.press("Escape");
      assert.deepEqual((await check("sns-config-escape")).ids, []);
    }

    assert.deepEqual(pageErrors, [], `${profile.name}: page errors ${pageErrors.join(" | ")}`);
    results.push({ profile: profile.name, checkpoints: checkpoints.length });
    await page.close();
  }
  assert.deepEqual(writes, [], `browser fixture made modifying HTTP requests: ${writes.join(", ")}`);
  console.log(JSON.stringify(results, null, 2));
  console.log("editor modal single-active browser tests OK");
} finally {
  await browser.close();
  await new Promise((closed) => server.close(closed));
}
