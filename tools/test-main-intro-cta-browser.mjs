import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { createEditorServer } from "./serve-editor.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || "playwright");
const executablePath = [
  process.env.BROWSER_EXECUTABLE,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean).find(existsSync);
const configuredOrigin = String(process.env.SONGAK_QA_ORIGIN || "").replace(/\/+$/, "");
const viewports = [
  { name: "desktop", profile: "desktop", viewport: { width: 1440, height: 900 } },
  { name: "tablet", profile: "tablet", viewport: { width: 820, height: 1180 }, mobile: true },
  { name: "mobile", profile: "phone", viewport: { width: 390, height: 844 }, mobile: true },
  { name: "small-mobile", profile: "phoneSmall", viewport: { width: 320, height: 720 }, mobile: true },
];

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
  if (!server) return Promise.resolve();
  return new Promise((resolveClose, rejectClose) => {
    server.close((error) => error ? rejectClose(error) : resolveClose());
  });
}

const fixtureServer = configuredOrigin ? null : createEditorServer();
const origin = configuredOrigin || await listen(fixtureServer);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

try {
  for (const testCase of viewports) {
    const context = await browser.newContext({
      viewport: testCase.viewport,
      hasTouch: Boolean(testCase.mobile),
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    try {
      // Use the canonical public route. Loading the integration HTML through
      // file:// breaks its /songak/ base URL and produces a false CTA failure.
      await page.goto(`${origin}/programs/application?type=donation&viewport=${testCase.profile}`, {
        waitUntil: "domcontentloaded",
      });
      await page.waitForFunction(() => document.body.dataset.editorBootState === "ready", null, { timeout: 30_000 });
      await page.locator('.essential-section-content[data-detail-page-kind="application"]').first().waitFor({ state: "visible" });

      const directApplication = await page.evaluate(() => {
        const row = document.querySelector(".main-intro-cta-row");
        const buttons = [...row.querySelectorAll("button")];
        const applicationLayers = [...document.querySelectorAll('[data-detail-page-kind="application"]')]
          .filter((content) => {
            const layer = content.closest(".essential-section-layer");
            const style = layer && getComputedStyle(layer);
            return layer && !layer.hidden && style.display !== "none" && style.visibility !== "hidden";
          });
        return {
          rowHidden: row.hidden,
          rowDisplay: getComputedStyle(row).display,
          rowAriaHidden: row.getAttribute("aria-hidden"),
          tabIndexes: buttons.map((button) => button.tabIndex),
          applicationLayerCount: applicationLayers.length,
        };
      });
      assert.equal(directApplication.rowHidden, true, `${testCase.name}: application page hides the main CTA row`);
      assert.equal(directApplication.rowDisplay, "none", `${testCase.name}: hidden CTA row is not rendered`);
      assert.equal(directApplication.rowAriaHidden, "true", `${testCase.name}: hidden CTA row is absent from the accessibility tree`);
      assert.ok(directApplication.tabIndexes.every((tabIndex) => tabIndex === -1), `${testCase.name}: hidden CTA controls are not focusable`);
      assert.ok(directApplication.applicationLayerCount > 0, `${testCase.name}: application detail is visible`);

      await page.goto(`${origin}/about?viewport=${testCase.profile}`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => document.body.dataset.editorBootState === "ready", null, { timeout: 30_000 });
      await page.locator('.main-intro-cta-row:not([hidden]) [data-main-intro-cta="consult"]').waitFor({ state: "visible" });

      const mainIntro = await page.evaluate(() => {
        const row = document.querySelector(".main-intro-cta-row");
        const message = document.querySelector('[data-id="mainIntroRightText"]');
        const sectionId = row.dataset.sectionId || "mainIntro";
        const surface = document.querySelector(`.main-intro-surface[data-section-id="${CSS.escape(sectionId)}"]`);
        const buttons = [...row.querySelectorAll("button")];
        const rowRect = row.getBoundingClientRect();
        const messageRect = message?.getBoundingClientRect();
        const surfaceRect = surface?.getBoundingClientRect();
        return {
          rowHidden: row.hidden,
          rowDisplay: getComputedStyle(row).display,
          rowAriaHidden: row.getAttribute("aria-hidden"),
          labels: buttons.map((button) => button.textContent.trim()),
          tabIndexes: buttons.map((button) => button.tabIndex),
          buttonHeights: buttons.map((button) => button.getBoundingClientRect().height),
          computedButtonHeights: buttons.map((button) => getComputedStyle(button).height),
          stageClass: document.querySelector("#stage")?.className || "",
          stageScaleTransform: getComputedStyle(document.querySelector("#stageScale")).transform,
          overlapsRightMessage: Boolean(messageRect
            && rowRect.left < messageRect.right && rowRect.right > messageRect.left
            && rowRect.top < messageRect.bottom && rowRect.bottom > messageRect.top),
          rowBottom: rowRect.bottom,
          surfaceBottom: surfaceRect?.bottom ?? null,
          horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        };
      });
      assert.equal(mainIntro.rowHidden, false, `${testCase.name}: main intro shows its CTA row`);
      assert.notEqual(mainIntro.rowDisplay, "none", `${testCase.name}: main intro CTA row is rendered`);
      assert.equal(mainIntro.rowAriaHidden, "false", `${testCase.name}: visible CTA row is exposed to assistive technology`);
      assert.deepEqual(mainIntro.labels, ["프로그램 찾기", "상담·이용 문의"], `${testCase.name}: CTA labels remain canonical`);
      assert.ok(mainIntro.tabIndexes.every((tabIndex) => tabIndex === 0), `${testCase.name}: visible CTA controls are keyboard reachable`);
      assert.ok(
        mainIntro.buttonHeights.every((height) => height >= 44),
        `${testCase.name}: CTA touch targets remain at least 44px (${mainIntro.buttonHeights.join(", ")}; CSS ${mainIntro.computedButtonHeights.join(", ")}; ${mainIntro.stageClass}; ${mainIntro.stageScaleTransform})`,
      );
      assert.equal(mainIntro.overlapsRightMessage, false, `${testCase.name}: CTA does not cover the right-side message`);
      assert.ok(
        mainIntro.surfaceBottom !== null && mainIntro.rowBottom <= mainIntro.surfaceBottom + 1,
        `${testCase.name}: CTA remains inside the main-intro surface (${mainIntro.rowBottom} <= ${mainIntro.surfaceBottom})`,
      );
      assert.equal(mainIntro.horizontalOverflow, false, `${testCase.name}: CTA does not create horizontal overflow`);

      await page.locator('[data-main-intro-cta="consult"]').click();
      await page.waitForURL((url) => url.pathname === "/programs/application" && url.searchParams.get("type") === "case");
      await page.locator('.essential-section-content[data-detail-page-kind="application"]').first().waitFor({ state: "visible" });
      const afterConsult = await page.evaluate(() => {
        const row = document.querySelector(".main-intro-cta-row");
        const visibleApplicationLayer = [...document.querySelectorAll('[data-detail-page-kind="application"]')]
          .some((content) => {
            const layer = content.closest(".essential-section-layer");
            const style = layer && getComputedStyle(layer);
            return layer && !layer.hidden && style.display !== "none" && style.visibility !== "hidden";
          });
        return {
          rowHidden: row.hidden,
          rowAriaHidden: row.getAttribute("aria-hidden"),
          tabIndexes: [...row.querySelectorAll("button")].map((button) => button.tabIndex),
          visibleApplicationLayer,
        };
      });
      assert.equal(afterConsult.rowHidden, true, `${testCase.name}: CTA navigation hides the main-intro row`);
      assert.equal(afterConsult.rowAriaHidden, "true", `${testCase.name}: navigated CTA row leaves the accessibility tree`);
      assert.ok(afterConsult.tabIndexes.every((tabIndex) => tabIndex === -1), `${testCase.name}: navigated CTA controls leave the tab order`);
      assert.equal(afterConsult.visibleApplicationLayer, true, `${testCase.name}: consult CTA opens the application detail`);
      assert.deepEqual(pageErrors, [], `${testCase.name}: browser runtime remains error-free`);
    } finally {
      await context.close();
    }
  }

  console.log(`main intro CTA browser tests OK (${viewports.length} viewports, ${configuredOrigin ? "configured origin" : "HTTP fixture"})`);
} finally {
  await browser.close();
  await close(fixtureServer);
}
