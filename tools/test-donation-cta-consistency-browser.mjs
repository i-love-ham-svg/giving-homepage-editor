import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createEditorServer } from "./serve-editor.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || "playwright");
const workspaceRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const canonicalHtml = readFileSync(resolve(workspaceRoot, "outputs", "representative-greeting-editor.html"), "utf8");
const executablePath = [
  process.env.BROWSER_EXECUTABLE,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean).find(existsSync);
const configuredOrigin = String(process.env.SONGAK_QA_ORIGIN || "").replace(/\/+$/, "");
const viewports = Object.freeze([
  { name: "desktop", profile: "desktop", width: 1440, height: 900 },
  { name: "tablet", profile: "tablet", width: 820, height: 1180 },
  { name: "mobile", profile: "phone", width: 390, height: 844 },
  { name: "small-mobile", profile: "phoneSmall", width: 320, height: 720 },
]);

function listen(server) {
  return new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", rejectListen);
      resolveListen(`http://127.0.0.1:${server.address().port}`);
    });
  });
}

function close(server) {
  return new Promise((resolveClose, rejectClose) => {
    server.close((error) => error ? rejectClose(error) : resolveClose());
  });
}

function overlaps(a, b, tolerance = 1) {
  return Boolean(a && b
    && a.left < b.right - tolerance && a.right > b.left + tolerance
    && a.top < b.bottom - tolerance && a.bottom > b.top + tolerance);
}

// Editing consistency stays a static contract in the self-contained public
// fixture. A configured delivery origin may additionally exercise login below.
assert.match(canonicalHtml, /\.donation-cta-input,\s*\.donation-view-only\s*\{[\s\S]*?width:\s*min\(100%,\s*420px\);[\s\S]*?min-height:\s*58px;[\s\S]*?margin-top:\s*18px;[\s\S]*?padding:\s*15px 34px;/,
  "edit textarea and public anchor share the canonical CTA geometry");
assert.match(canonicalHtml, /\.edit-mode\s+\.donation-view-only\s*\{\s*display:\s*none\s*!important;\s*\}/,
  "edit mode hides only the public CTA anchor");
assert.match(canonicalHtml, /\.view-mode\s+\.donation-cta-input\s*\{\s*display:\s*none\s*!important;\s*\}/,
  "public mode hides only the CTA editor");

const fixtureServer = configuredOrigin ? null : createEditorServer();
const origin = configuredOrigin || await listen(fixtureServer);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const reports = [];

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto(`${origin}/participation/donation?viewport=${viewport.profile}&donation-cta-qa=1`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await page.waitForFunction(() => document.body.dataset.editorBootState === "ready", null, { timeout: 15_000 });
    await page.locator("#editorBootOverlay").waitFor({ state: "hidden", timeout: 15_000 });
    const cta = page.locator('.donation-section-layer[data-section-id="donation"] .donation-view-only');
    await cta.waitFor({ state: "visible", timeout: 10_000 });
    await cta.scrollIntoViewIfNeeded();
    await page.waitForTimeout(60);

    const result = await page.evaluate(() => {
      const layer = document.querySelector('.donation-section-layer[data-section-id="donation"]');
      const content = layer?.querySelector(".donation-section-content");
      const cta = layer?.querySelector(".donation-view-only");
      const editor = layer?.querySelector(".donation-cta-input");
      const footer = layer?.querySelector(".donation-footer");
      const note = layer?.querySelector(".donation-note-input");
      const cards = [...(layer?.querySelectorAll(".donation-card") || [])];
      const rect = (element) => element?.getBoundingClientRect() || null;
      const ctaStyle = getComputedStyle(cta);
      const editorStyle = getComputedStyle(editor);
      const stage = document.getElementById("stage");
      return {
        role: document.body.dataset.editorRole,
        mode: stage?.classList.contains("view-mode") ? "view" : "edit",
        href: cta?.getAttribute("href") || "",
        text: cta?.textContent?.trim() || "",
        ariaLabel: cta?.getAttribute("aria-label")?.trim() || "",
        ctaRect: rect(cta),
        footerRect: rect(footer),
        noteRect: rect(note),
        lastCardRect: rect(cards.at(-1)),
        contentRect: rect(content),
        cardCount: cards.length,
        editorHidden: editorStyle.display === "none" || editorStyle.visibility === "hidden",
        ctaDisplay: ctaStyle.display,
        ctaBackground: ctaStyle.backgroundColor,
        ctaColor: ctaStyle.color,
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        stageHorizontalOverflow: stage.scrollWidth > stage.clientWidth + 1,
      };
    });

    assert.deepEqual(pageErrors, [], `${viewport.name}: no public page errors`);
    assert.equal(result.role, "public", `${viewport.name}: uses the public role`);
    assert.equal(result.mode, "view", `${viewport.name}: uses view mode`);
    assert.equal(result.href, "/programs/application?type=donation", `${viewport.name}: donation destination is canonical`);
    assert.ok(result.text, `${viewport.name}: CTA has visible text`);
    assert.equal(result.ariaLabel, result.text, `${viewport.name}: CTA accessible name matches its text`);
    assert.ok(result.ctaRect.width >= 44 && result.ctaRect.height >= 44,
      `${viewport.name}: CTA touch target is at least 44px (${result.ctaRect.width}x${result.ctaRect.height})`);
    assert.ok(result.cardCount >= 1, `${viewport.name}: donation cards remain present`);
    assert.equal(result.editorHidden, true, `${viewport.name}: editor textarea is hidden from visitors`);
    assert.notEqual(result.ctaDisplay, "none", `${viewport.name}: public CTA is rendered`);
    assert.ok(result.ctaBackground !== "rgba(0, 0, 0, 0)", `${viewport.name}: public CTA keeps its background`);
    assert.equal(overlaps(result.ctaRect, result.noteRect), false, `${viewport.name}: CTA does not overlap the note`);
    assert.equal(overlaps(result.ctaRect, result.lastCardRect), false, `${viewport.name}: CTA does not overlap the cards`);
    assert.ok(result.ctaRect.top >= result.noteRect.bottom - 1, `${viewport.name}: CTA follows the note`);
    assert.ok(result.footerRect.top >= result.lastCardRect.bottom - 1, `${viewport.name}: footer follows the cards`);
    assert.ok(result.ctaRect.left >= result.contentRect.left - 1 && result.ctaRect.right <= result.contentRect.right + 1,
      `${viewport.name}: CTA stays inside the donation content`);
    assert.equal(result.horizontalOverflow, false, `${viewport.name}: document has no horizontal overflow`);
    assert.equal(result.stageHorizontalOverflow, false, `${viewport.name}: stage has no horizontal overflow`);
    reports.push({
      viewport: viewport.name,
      cta: `${Math.round(result.ctaRect.width)}x${Math.round(result.ctaRect.height)}`,
      cards: result.cardCount,
      text: result.text,
      href: result.href,
    });
    await context.close();
  }

  // A configured integrated origin can prove edit/runtime parity after real
  // authentication. The default checked-in fixture intentionally has no login
  // backend, so it relies on the static shared-selector contract above.
  if (configuredOrigin && process.env.SONGAK_EDITOR_ID && process.env.SONGAK_EDITOR_PASSWORD) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const response = await context.request.post(`${origin}/api/board/admin/login`, {
      headers: { origin },
      data: { id: process.env.SONGAK_EDITOR_ID, password: process.env.SONGAK_EDITOR_PASSWORD },
    });
    assert.equal(response.ok(), true, `configured editor login succeeds (${response.status()})`);
    const page = await context.newPage();
    await page.goto(`${origin}/editor?previewSection=donation`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForFunction(() => document.body.dataset.editorBootState === "ready", null, { timeout: 15_000 });
    const parity = await page.evaluate(() => {
      const layer = document.querySelector('.donation-section-layer[data-section-id="donation"]');
      const input = layer?.querySelector(".donation-cta-input");
      const anchor = layer?.querySelector(".donation-view-only");
      const keys = ["width", "minHeight", "marginTop", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "borderRadius", "fontWeight", "textAlign"];
      const read = (element) => Object.fromEntries(keys.map((key) => [key, getComputedStyle(element)[key]]));
      const edit = read(input);
      window.EditorModules.mobileViewport.setMode("view");
      void anchor.offsetHeight;
      return { edit, view: read(anchor), textMatches: input.value.trim() === anchor.textContent.trim() };
    });
    assert.deepEqual(parity.edit, parity.view, "authenticated editor and public CTA share computed geometry");
    assert.equal(parity.textMatches, true, "authenticated editor and public CTA share text");
    await context.close();
  }
} finally {
  await browser.close();
  if (fixtureServer) await close(fixtureServer);
}

console.log(`donation CTA public HTTP browser tests OK ${JSON.stringify(reports)}`);
