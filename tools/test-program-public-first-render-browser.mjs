import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { createEditorServer } from "./serve-editor.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || "playwright");
const executablePath = [
  process.env.BROWSER_EXECUTABLE,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean).find(existsSync);
const iterations = Math.max(1, Number(process.env.SONGAK_PROGRAM_BENCH_ITERATIONS || 3));
const viewports = Object.freeze([
  { name: "desktop", profile: "desktop", width: 1440, height: 900 },
  { name: "mobile-390", profile: "phone", width: 390, height: 844 },
]);

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve(`http://127.0.0.1:${server.address().port}`);
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

const server = createEditorServer();
const origin = process.env.SONGAK_QA_ORIGIN || await listen(server);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const reports = [];

try {
  for (let index = 0; index < iterations; index += 1) {
    const viewport = viewports[index % viewports.length];
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await page.addInitScript(() => {
      window.__programRenderPerf = { longTasks: [], paints: [], lcp: 0, functions: {} };
      try {
        new PerformanceObserver((list) => {
          window.__programRenderPerf.longTasks.push(...list.getEntries().map((entry) => ({
            start: entry.startTime,
            duration: entry.duration,
          })));
        }).observe({ type: "longtask", buffered: true });
        new PerformanceObserver((list) => {
          window.__programRenderPerf.paints.push(...list.getEntries().map((entry) => ({
            name: entry.name,
            start: entry.startTime,
          })));
        }).observe({ type: "paint", buffered: true });
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          window.__programRenderPerf.lcp = entries.at(-1)?.startTime || 0;
        }).observe({ type: "largest-contentful-paint", buffered: true });
      } catch {}
      window.addEventListener("DOMContentLoaded", () => {
        const names = [
          "loadInitialSiteSnapshot",
          "renderProgramSection",
          "renderProgramCard",
          "applySectionVisibility",
          "syncContent",
          "applyLayouts",
          "applyTextStyles",
          "fitStage",
          "renderHomeMenu",
          "setActiveSection",
          "autoSectionTextarea",
          "measureProgramSections",
          "refreshAllPhotoTransforms",
          "updateSectionInsertControls",
          "renderLayerList",
          "syncInspector",
          "stabilizePublicGreetingLayouts",
        ];
        names.forEach((name) => {
          const original = window[name];
          if (typeof original !== "function") return;
          window[name] = function measuredProgramBootFunction(...args) {
            const startedAt = performance.now();
            const finish = () => {
              const duration = performance.now() - startedAt;
              const record = window.__programRenderPerf.functions[name] ||= { calls: 0, total: 0, max: 0 };
              record.calls += 1;
              record.total += duration;
              record.max = Math.max(record.max, duration);
            };
            try {
              const result = original.apply(this, args);
              if (result && typeof result.then === "function") return result.finally(finish);
              finish();
              return result;
            } catch (error) {
              finish();
              throw error;
            }
          };
        });
      }, { capture: true, once: true });
    });

    const startedAt = performance.now();
    await page.goto(`${origin}/programs?viewport=${viewport.profile}&program-benchmark=${Date.now()}-${index}`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await page.waitForFunction(() => document.body.dataset.editorBootState === "ready", null, { timeout: 15_000 });
    await page.locator("#editorBootOverlay").waitFor({ state: "hidden", timeout: 15_000 });
    await page.waitForSelector('.program-section-layer[data-section-id="program"] .program-card', { timeout: 10_000 });
    await page.waitForTimeout(80);
    const elapsedMs = performance.now() - startedAt;
    const report = await page.evaluate(() => {
      const boot = window.__songakEditorBoot || {};
      const navigation = performance.getEntriesByType("navigation")[0];
      const cards = [...document.querySelectorAll('.program-section-layer[data-section-id="program"] .program-card')];
      const firstViewportCards = cards.filter((card) => {
        const rect = card.getBoundingClientRect();
        return rect.bottom > 0 && rect.top < window.innerHeight;
      });
      const editControls = [...document.querySelectorAll('.program-section-layer[data-section-id="program"] .program-edit-only')];
      const hiddenEditControls = editControls.every((control) => {
        const style = getComputedStyle(control);
        return style.display === "none" || style.visibility === "hidden";
      });
      return {
        bootReadyMs: boot.readyAt - boot.startedAt,
        initializeMs: Number(document.body.dataset.editorInitializeMs || 0),
        snapshotMs: Number(document.body.dataset.editorSnapshotMs || 0),
        domContentLoadedMs: navigation?.domContentLoadedEventEnd || 0,
        loadMs: navigation?.loadEventEnd || 0,
        longTaskTotalMs: window.__programRenderPerf.longTasks.reduce((sum, task) => sum + task.duration, 0),
        longestTaskMs: Math.max(0, ...window.__programRenderPerf.longTasks.map((task) => task.duration)),
        firstPaintMs: window.__programRenderPerf.paints.find((entry) => entry.name === "first-paint")?.start || 0,
        firstContentfulPaintMs: window.__programRenderPerf.paints.find((entry) => entry.name === "first-contentful-paint")?.start || 0,
        lcpMs: window.__programRenderPerf.lcp,
        cardCount: cards.length,
        firstViewportCardCount: firstViewportCards.length,
        inputCount: document.querySelectorAll('.program-section-layer[data-section-id="program"] textarea, .program-section-layer[data-section-id="program"] input, .program-section-layer[data-section-id="program"] select').length,
        hiddenEditControls,
        role: document.body.dataset.editorRole,
        mode: document.getElementById("stage")?.classList.contains("view-mode") ? "view" : "edit",
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        deferredCards: document.querySelectorAll('.program-card[data-program-public-deferred="true"]').length,
        publicCardContentVisibility: getComputedStyle(cards[0]).contentVisibility,
        publicCardIntrinsicSize: getComputedStyle(cards[0]).containIntrinsicSize,
        functionTimings: Object.fromEntries(Object.entries(window.__programRenderPerf.functions)
          .sort(([, a], [, b]) => b.total - a.total)
          .map(([name, record]) => [name, {
            calls: record.calls,
            totalMs: record.total,
            maxMs: record.max,
          }])),
      };
    });

    const roleIsolation = await page.evaluate(async () => {
      const firstCard = document.querySelector('.program-section-layer[data-section-id="program"] .program-card');
      const read = () => getComputedStyle(firstCard).contentVisibility;
      const publicValue = read();
      window.SongakEditorAccess.setRole("staff");
      await new Promise((resolveFrame) => requestAnimationFrame(resolveFrame));
      const staffValue = read();
      window.SongakEditorAccess.setRole("developer");
      await new Promise((resolveFrame) => requestAnimationFrame(resolveFrame));
      const developerValue = read();
      window.SongakEditorAccess.setRole("public");
      await new Promise((resolveFrame) => requestAnimationFrame(resolveFrame));
      return { publicValue, staffValue, developerValue, restoredPublicValue: read() };
    });
    const lastCardAfterReveal = await page.evaluate(async () => {
      const cards = [...document.querySelectorAll('.program-section-layer[data-section-id="program"] .program-card')];
      const card = cards.at(-1);
      card.scrollIntoView({ block: "center" });
      await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
      const rect = card.getBoundingClientRect();
      const title = card.querySelector(".program-card-title-input")?.value?.trim() || "";
      const action = card.querySelector(".program-card-cta-action");
      return {
        inViewport: rect.bottom > 0 && rect.top < window.innerHeight,
        offsetHeight: card.offsetHeight,
        title,
        actionText: action?.textContent?.trim() || "",
        actionHref: action?.getAttribute("href") || "",
      };
    });

    assert.deepEqual(pageErrors, [], `iteration ${index + 1}: no page errors`);
    assert.equal(report.role, "public", `iteration ${index + 1}: public role`);
    assert.equal(report.mode, "view", `iteration ${index + 1}: view mode`);
    assert.ok(report.cardCount >= 16, `iteration ${index + 1}: all program cards remain in the DOM`);
    assert.ok(report.firstViewportCardCount >= 1, `iteration ${index + 1}: first viewport contains program cards`);
    assert.equal(report.hiddenEditControls, true, `iteration ${index + 1}: edit controls remain hidden`);
    assert.equal(report.horizontalOverflow, false, `iteration ${index + 1}: no horizontal overflow`);
    assert.equal(report.publicCardContentVisibility, "auto", `iteration ${index + 1}: public cards defer off-screen rendering`);
    assert.match(report.publicCardIntrinsicSize, /430px/, `iteration ${index + 1}: public cards retain stable intrinsic height`);
    assert.deepEqual(roleIsolation, {
      publicValue: "auto",
      staffValue: "visible",
      developerValue: "visible",
      restoredPublicValue: "auto",
    }, `iteration ${index + 1}: rendering deferral is isolated from staff and developer roles`);
    assert.equal(lastCardAfterReveal.inViewport, true, `iteration ${index + 1}: final deferred card can be revealed`);
    assert.ok(lastCardAfterReveal.offsetHeight > 0,
      `iteration ${index + 1}: final card receives responsive layout after reveal`);
    assert.ok(lastCardAfterReveal.title, `iteration ${index + 1}: final card retains its title`);
    assert.ok(lastCardAfterReveal.actionText, `iteration ${index + 1}: final card retains its CTA text`);
    assert.equal(lastCardAfterReveal.actionHref, "/programs/application?type=program",
      `iteration ${index + 1}: final card retains its CTA destination`);
    reports.push({ iteration: index + 1, viewport: viewport.name, elapsedMs, ...report });
    await context.close();
  }
} finally {
  await browser.close();
  if (!process.env.SONGAK_QA_ORIGIN) await close(server);
}

const summary = {
  iterations: reports.length,
  medianElapsedMs: Math.round(median(reports.map((report) => report.elapsedMs))),
  medianBootReadyMs: Math.round(median(reports.map((report) => report.bootReadyMs))),
  medianInitializeMs: Math.round(median(reports.map((report) => report.initializeMs))),
  medianLongTaskTotalMs: Math.round(median(reports.map((report) => report.longTaskTotalMs))),
  medianLongestTaskMs: Math.round(median(reports.map((report) => report.longestTaskMs))),
  reports: reports.map((report) => ({
    iteration: report.iteration,
    viewport: report.viewport,
    elapsedMs: Math.round(report.elapsedMs),
    bootReadyMs: Math.round(report.bootReadyMs),
    initializeMs: report.initializeMs,
    snapshotMs: report.snapshotMs,
    longTaskTotalMs: Math.round(report.longTaskTotalMs),
    longestTaskMs: Math.round(report.longestTaskMs),
    firstContentfulPaintMs: Math.round(report.firstContentfulPaintMs),
    lcpMs: Math.round(report.lcpMs),
    cards: report.cardCount,
    firstViewportCards: report.firstViewportCardCount,
    inputs: report.inputCount,
    deferredCards: report.deferredCards,
    topFunctions: Object.entries(report.functionTimings).slice(0, 8).map(([name, record]) => ({
      name,
      calls: record.calls,
      totalMs: Math.round(record.totalMs),
      maxMs: Math.round(record.maxMs),
    })),
  })),
};

console.log(`program public first-render browser test OK ${JSON.stringify(summary)}`);
