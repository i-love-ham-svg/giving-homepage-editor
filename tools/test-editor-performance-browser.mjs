import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const editorUrl = pathToFileURL(resolve("outputs", "representative-greeting-editor.html")).href;
const browserCandidates = [
  process.env.BROWSER_EXECUTABLE,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
].filter(Boolean);
const executablePath = browserCandidates.find(existsSync);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const issues = [];

try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
  page.on("pageerror", (error) => issues.push(`page error: ${error.message}`));
  const navigationStart = performance.now();
  await page.goto(`${editorUrl}?mode=edit`, { waitUntil: "commit" });
  await page.waitForSelector(".body-text", { state: "attached" });
  await page.waitForFunction(() => document.querySelector(".program-headline-input") && document.querySelector(".process-headline-input"));
  await page.waitForTimeout(300);
  const readyMs = performance.now() - navigationStart;

  async function measureInput(selector, suffix) {
    return page.evaluate(async ({ selector, suffix }) => {
      const field = document.querySelector(selector);
      if (!field) return null;
      const start = performance.now();
      field.value += suffix;
      field.dispatchEvent(new Event("input", { bubbles: true }));
      const syncMs = performance.now() - start;
      await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
      return { syncMs, frameMs: performance.now() - start };
    }, { selector, suffix });
  }

  async function measureTextStyle(layerId) {
    return page.evaluate(async (id) => {
      if (!elements[id]) return null;
      selectLayer(id);
      const style = getTextStyle();
      if (!style) return null;
      const start = performance.now();
      updateTextStyle("size", Math.min(getTextSizeBounds(id).max, style.size + 1));
      const syncMs = performance.now() - start;
      await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
      return { syncMs, frameMs: performance.now() - start };
    }, layerId);
  }

  const results = {
    readyMs,
    mainIntro: await measureInput(".main-intro-title-text", " 테스트"),
    greeting: await measureInput(".body-text", " 테스트"),
    program: await measureInput(".program-headline-input", " 테스트"),
    process: await measureInput(".process-headline-input", " 테스트"),
    mainIntroStyle: await measureTextStyle("mainIntroTitle")
  };
  results.layoutBreakdown = await page.evaluate(() => {
    const measure = (callback) => {
      const start = performance.now();
      callback();
      return performance.now() - start;
    };
    const metrics = getMainIntroLayerIds("mainIntro").map((id) => {
      const textarea = elements[id]?.querySelector("textarea");
      const layout = state.layouts.desktop?.[id];
      return {
        id,
        current: layout ? getFullStageSize("desktop").h * layout.h / 100 : 0,
        needed: (textarea?.scrollHeight ?? 0) + 2
      };
    });
    return {
      syncMainIntro: measure(() => syncMainIntroSectionHeightToContent("mainIntro", "desktop")),
      arrangeMainIntro: measure(() => arrangeMainIntroResponsiveFlow("mainIntro", "desktop")),
      fitStage: measure(() => fitStage()),
      applyLayouts: measure(() => applyLayouts()),
      applyLayoutsNoStyles: measure(() => applyLayouts({ applyStyles: false })),
      ensureVisibilityChanged: ensureMainIntroTextVisibilityAfterApply("desktop"),
      metrics
    };
  });
  results.applyBreakdown = await page.evaluate(() => {
    const result = {};
    const measure = (name, callback) => {
      const start = performance.now();
      callback();
      result[name] = performance.now() - start;
    };
    let frameContext;
    let stageSize;
    measure("ensureResponsiveState", () => ensureResponsiveState());
    measure("getStageSize", () => { stageSize = getStageSize(); });
    measure("updateDynamicLayouts", () => {
      updateProgramLayoutState(state.viewport);
      updateProcessLayoutState(state.viewport);
    });
    measure("createFrameContext", () => { frameContext = createLayoutFrameContext(state.viewport); });
    measure("normalizeIdentity", () => getSectionOrder().filter(isGreetingSection).forEach((sectionId) => normalizeIdentityContainerLayout(state.viewport, sectionId)));
    measure("applyTextStyles", () => applyTextStyles());
    measure("identityLayouts", () => updateAllIdentityItemLayouts());
    measure("layerLayouts", () => Object.keys(elements).forEach((id) => applyLayerLayout(id, stageSize, frameContext)));
    measure("surface", () => updateMainIntroSurfaceLayout());
    measure("insertControls", () => updateSectionInsertControls());
    measure("sticky", () => updateHomeMenuStickyPosition());
    measure("photos", () => refreshAllPhotoTransforms());
    measure("inspector", () => syncInspector());
    measure("layerList", () => renderLayerList());
    measure("toolbar", () => updateInlineToolbar());
    return result;
  });

  Object.entries(results).forEach(([name, result]) => {
    if (name === "readyMs" || name === "layoutBreakdown" || name === "applyBreakdown") return;
    if (!result) issues.push(`${name}: input field missing`);
    else if (result.syncMs > 500) issues.push(`${name}: synchronous input took ${result.syncMs.toFixed(1)}ms`);
    else if (result.frameMs > 1500) issues.push(`${name}: layout frame took ${result.frameMs.toFixed(1)}ms`);
  });
  if (readyMs > 30_000) issues.push(`initial editor ready took ${readyMs.toFixed(1)}ms`);

  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}

if (issues.length) {
  console.error(issues.join("\n"));
  process.exitCode = 1;
} else {
  console.log("editor performance browser tests OK");
}
