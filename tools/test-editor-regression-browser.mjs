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
  const page = await browser.newPage({ viewport: { width: 1500, height: 940 } });
  page.on("pageerror", (error) => issues.push(`page error: ${error.message}`));
  await page.goto(`${editorUrl}?mode=edit`, { waitUntil: "commit" });
  await page.waitForSelector(".body-text", { state: "attached" });
  await page.waitForFunction(() => document.querySelector(".program-section-layer") && document.querySelector(".process-section-layer"));

  const viewportResults = {};
  for (const viewport of ["desktop", "phoneSmall", "phone", "tablet"]) {
    await page.evaluate((value) => {
      clearHomeMenuView();
      setMode("view");
      setViewport(value);
    }, viewport);
    await page.waitForTimeout(900);
    viewportResults[viewport] = await page.evaluate(() => {
      const visibleIds = getVisibleSectionIds();
      const gap = getSectionInsertGapPx();
      const regions = visibleIds.map((sectionId) => ({
        sectionId,
        top: getSectionRenderedTopPx(sectionId),
        height: getSectionHeightPx(sectionId)
      }));
      const sectionOverlaps = regions.slice(1).filter((region, index) => {
        const previous = regions[index];
        return region.top < previous.top + previous.height + gap - 2;
      }).length;
      const stageRect = document.getElementById("stage").getBoundingClientRect();
      const framedLayers = [...document.querySelectorAll(".main-intro-surface:not([hidden]), .program-section-layer:not([hidden]), .process-section-layer:not([hidden]), .history-section-layer:not([hidden])")];
      const horizontalOverflow = framedLayers.filter((layer) => {
        const rect = layer.getBoundingClientRect();
        return rect.left < stageRect.left - 2 || rect.right > stageRect.right + 2;
      }).length;
      const clippedSectionContent = framedLayers.filter((layer) => {
        const content = layer.querySelector(".program-section-content, .process-section-content, .history-section-content");
        return content && content.scrollHeight > layer.getBoundingClientRect().height + 8;
      }).length;
      const sectionGaps = regions.slice(1).map((region, index) => {
        const previous = regions[index];
        return region.top - (previous.top + previous.height);
      });
      const maxSectionGap = sectionGaps.length ? Math.max(...sectionGaps.map(Math.abs)) : 0;
      const stageScale = stageRect.width / Math.max(document.getElementById("stage").offsetWidth, 1);
      const innerLeft = stageRect.left + document.getElementById("stage").clientLeft * stageScale;
      const innerRight = innerLeft + document.getElementById("stage").clientWidth * stageScale;
      const managedLayers = [...document.querySelectorAll(".program-section-layer:not([hidden]), .process-section-layer:not([hidden]), .history-section-layer:not([hidden]), .donation-section-layer:not([hidden]), .gallery-section-layer:not([hidden])")];
      const nonFullBleedManagedLayers = managedLayers.filter((layer) => {
        const rect = layer.getBoundingClientRect();
        return Math.abs(rect.left - innerLeft) > 2 || Math.abs(rect.right - innerRight) > 2;
      }).length;
      const shellRect = document.getElementById("stageShell").getBoundingClientRect();
      const desktopOuterInset = stage.classList.contains("desktop")
        ? Math.max(Math.abs(stageRect.left - shellRect.left), Math.abs(shellRect.right - stageRect.right))
        : null;
      return { visibleIds, sectionOverlaps, horizontalOverflow, clippedSectionContent, maxSectionGap, nonFullBleedManagedLayers, desktopOuterInset };
    });
  }

  await page.evaluate(() => {
    setViewport("desktop");
    setMode("edit");
    clearHomeMenuView();
    setActiveSection("greeting", { selectLayer: true });
  });
  const editGapResult = await page.evaluate(() => ({
    gap: getSectionInsertGapPx(),
    programLayout: { ...state.layouts.desktop.program }
  }));
  const menuPositionResult = await page.evaluate(async () => {
    const waitForLayout = () => new Promise((resolveWait) => requestAnimationFrame(() => requestAnimationFrame(resolveWait)));
    const measureBaseTop = () => {
      const menuRect = document.getElementById("homepageMenu").getBoundingClientRect();
      const stageRect = document.getElementById("stage").getBoundingClientRect();
      return (menuRect.top - stageRect.top) / Math.max(state.scale || 1, .1);
    };
    const beforeTop = measureBaseTop();
    const addedIds = Array.from({ length: 3 }, () => (
      EditorModules.sectionManager.addDonationAt("bottom", EditorModules.sectionManager.getOrder().length)
    ));
    await waitForLayout();
    const afterSectionGrowthTop = measureBaseTop();
    window.scrollTo(0, Math.min(640, Math.max(0, document.documentElement.scrollHeight - window.innerHeight)));
    await waitForLayout();
    const menuRect = document.getElementById("homepageMenu").getBoundingClientRect();
    const topbarRect = document.querySelector(".topbar").getBoundingClientRect();
    const stickyGap = menuRect.top - topbarRect.bottom;
    window.scrollTo(0, 0);
    addedIds.forEach((sectionId) => EditorModules.sectionManager.deleteById(sectionId));
    await waitForLayout();
    const restoredTop = measureBaseTop();
    return { beforeTop, afterSectionGrowthTop, restoredTop, stickyGap };
  });
  const menuRouteReturnResult = await page.evaluate(async () => {
    const waitForLayout = (delay = 220) => new Promise((resolveWait) => {
      requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolveWait, delay)));
    });
    const introId = getSectionOrder().find((sectionId) => isMainIntroSection(sectionId));
    let introMenu = null;
    let otherMenu = null;
    visitHomeMenuItems((item) => {
      const linkedSectionIds = getHomeMenuLinkedSectionIds(item);
      if (!introMenu && linkedSectionIds.length === 1 && linkedSectionIds[0] === introId) introMenu = item;
      if (!otherMenu && linkedSectionIds.length && !linkedSectionIds.includes(introId)) otherMenu = item;
    });
    const measure = () => {
      const visibleIds = getVisibleSectionIds();
      const introIndex = visibleIds.indexOf(introId);
      const nextId = introIndex >= 0 ? visibleIds[introIndex + 1] : null;
      const introTop = getSectionRenderedTopPx(introId);
      const introHeight = getSectionHeightPx(introId);
      const nextTop = nextId ? getSectionRenderedTopPx(nextId) : null;
      const surface = [...document.querySelectorAll(".main-intro-surface:not([hidden])")]
        .find((element) => String(element.dataset.sectionId || "mainIntro") === introId);
      const surfaceRect = surface?.getBoundingClientRect();
      const stageElement = document.getElementById("stage");
      const stageScaleElement = document.getElementById("stageScale");
      const stageRect = stageElement?.getBoundingClientRect();
      const stageScaleRect = stageScaleElement?.getBoundingClientRect();
      const layerRects = (sectionLayerMap[introId] ?? [])
        .map((layerId) => {
          const element = elements[layerId];
          if (!element || element.hidden) return null;
          const rect = element.getBoundingClientRect();
          return { id: layerId, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
        })
        .filter(Boolean);
      const layerBottom = Math.max(
        surfaceRect?.bottom ?? 0,
        ...layerRects.map((rect) => rect.bottom)
      );

      return {
        visibleIds,

        stageHeight: getRenderedStageSize().h,
        introTop,
        introHeight,
        nextId,
        nextTop,
        scale: state.scale,
        scrollY: window.scrollY,
        rootStageHeightVar: getComputedStyle(document.documentElement).getPropertyValue("--stage-h").trim(),
        stageHeightVar: stageElement ? getComputedStyle(stageElement).getPropertyValue("--stage-h").trim() : "",
        stageInlineHeight: stageElement?.style.height ?? "",
        stageScaleInlineHeight: stageScaleElement?.style.height ?? "",
        stageRect: stageRect ? { top: stageRect.top, bottom: stageRect.bottom, height: stageRect.height } : null,
        stageScaleRect: stageScaleRect
          ? { top: stageScaleRect.top, bottom: stageScaleRect.bottom, height: stageScaleRect.height }
          : null,
        surfaceStyle: surface ? { top: surface.style.top, height: surface.style.height } : null,
        surfaceRect: surfaceRect
          ? { top: surfaceRect.top, bottom: surfaceRect.bottom, height: surfaceRect.height }
          : null,
        layerRects,
        surfaceHeight: surfaceRect?.height ?? 0,
        surfaceOverflow: surfaceRect ? Math.max(0, layerBottom - surfaceRect.bottom) : 999,
        gap: getSectionInsertGapPx()
      };
    };

    setViewport("desktop");
    setMode("edit");
    clearHomeMenuView();
    await waitForLayout(320);
    const before = measure();
    if (!introMenu) return { menuFound: false, before };

    navigateToHomeMenuSection(introMenu.id);
    await waitForLayout();
    const introOnly = measure();
    if (otherMenu) {
      navigateToHomeMenuSection(otherMenu.id);
      await waitForLayout();
    }
    clearHomeMenuView();
    await waitForLayout(360);
    return {
      menuFound: true,
      otherMenuFound: Boolean(otherMenu),
      before,
      introOnly,
      after: measure()
    };
  });
  const historyResult = await page.evaluate(async () => {
    const field = document.querySelector(".body-text");
    const original = field.value;
    field.value = `${original}\n회귀 테스트 문장`;
    field.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((resolveWait) => setTimeout(resolveWait, 520));
    undoHistory();
    const afterUndo = field.value;
    redoHistory();
    const afterRedo = field.value;
    return { original, afterUndo, afterRedo };
  });

  const saveResult = await page.evaluate(async () => {
    await saveSnapshot();
    const raw = localStorage.getItem("representativeGreetingEditor");
    const saved = raw ? JSON.parse(raw) : null;
    return {
      saved: Boolean(saved),
      sectionCount: saved?.document?.sections?.length ?? 0,
      hasLegacySectionArrays: Boolean(
        saved?.content?.mainIntroSections
        || saved?.content?.greetingSections
        || saved?.content?.programSections
        || saved?.content?.processSections
      )
    };
  });

  await page.evaluate(() => {
    setViewport("phone");
    setMode("view");
  });
  await page.click("#homepageMenuToggle");
  await page.waitForTimeout(150);
  const mobileMenuResult = await page.evaluate(() => {
    const stageRect = document.getElementById("stage").getBoundingClientRect();
    const menu = document.getElementById("homepageMenu");
    const rect = menu?.getBoundingClientRect();
    return {
      expanded: document.getElementById("homepageMenuToggle")?.getAttribute("aria-expanded") === "true",
      visible: Boolean(rect?.width && rect?.height),
      insideStage: Boolean(rect
        && rect.left >= stageRect.left - 2
        && rect.right <= stageRect.right + 2
        && rect.top >= stageRect.top - 2
        && rect.bottom <= stageRect.bottom + 2),
      stageRect: { left: stageRect.left, top: stageRect.top, right: stageRect.right, bottom: stageRect.bottom },
      menuRect: rect ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom } : null
    };
  });

  Object.entries(viewportResults).forEach(([viewport, result]) => {
    if (result.sectionOverlaps) issues.push(`${viewport}: ${result.sectionOverlaps} section overlaps`);
    if (result.horizontalOverflow) issues.push(`${viewport}: ${result.horizontalOverflow} section layers exceed stage width`);
    if (result.clippedSectionContent) issues.push(`${viewport}: ${result.clippedSectionContent} section contents are clipped`);
    if (result.maxSectionGap > 1) issues.push(`${viewport}: preview sections retain a ${result.maxSectionGap}px gap`);
    if (result.nonFullBleedManagedLayers) issues.push(`${viewport}: ${result.nonFullBleedManagedLayers} managed sections are not full width in preview`);
    if (viewport === "desktop" && result.desktopOuterInset > 2) issues.push(`desktop: preview canvas retains a ${result.desktopOuterInset}px outer inset`);
  });
  if (editGapResult.gap < 40) issues.push("edit mode section insertion gap was removed");
  if (Math.abs(editGapResult.programLayout.x) > .01 || Math.abs(editGapResult.programLayout.w - 100) > .01) issues.push("program section edit frame is not aligned with preview");
  if (historyResult.afterUndo !== historyResult.original) issues.push("undo did not restore edited greeting text");
  if (!historyResult.afterRedo.endsWith("회귀 테스트 문장")) issues.push("redo did not restore edited greeting text");
  if (Math.abs(menuPositionResult.afterSectionGrowthTop - menuPositionResult.beforeTop) > 1) issues.push("desktop menu moved when the page gained sections");
  if (Math.abs(menuPositionResult.restoredTop - menuPositionResult.beforeTop) > 1) issues.push("desktop menu base position did not restore");
  if (menuPositionResult.stickyGap < 10 || menuPositionResult.stickyGap > 14) issues.push("desktop menu did not follow the viewport at the intended sticky gap");
  if (!menuRouteReturnResult.menuFound) {
    issues.push("main intro menu route was not found");
  } else {
    const { before, introOnly, after } = menuRouteReturnResult;
    const expectedIntroStageHeight = introOnly.stageHeight * introOnly.scale;
    const expectedIntroSectionHeight = introOnly.introHeight * introOnly.scale;
    if (Math.abs(introOnly.stageRect.height - expectedIntroStageHeight) > 3) issues.push("main intro menu left a stale rendered stage height");
    if (introOnly.surfaceHeight > expectedIntroSectionHeight + 2) issues.push("main intro menu magnified the intro surface");
    if (introOnly.surfaceOverflow > 2) issues.push("main intro menu clipped main intro content");
    if (after.visibleIds.length !== before.visibleIds.length) issues.push("logo return did not restore every section");
    if (Math.abs(after.stageHeight - before.stageHeight) > 3) issues.push("logo return changed the full-page stage height");
    if (Math.abs(after.introHeight - before.introHeight) > 3) issues.push("logo return compressed the main intro section");
    if (after.surfaceOverflow > 2) issues.push("logo return clipped main intro content");
    if (after.nextId && after.nextTop < after.introTop + after.introHeight + after.gap - 2) issues.push("logo return overlapped the section after the main intro");
  }
  if (!saveResult.saved || saveResult.sectionCount < 4) issues.push("canonical section document was not saved");
  if (saveResult.hasLegacySectionArrays) issues.push("legacy section arrays were duplicated in saved data");
  if (!mobileMenuResult.expanded || !mobileMenuResult.visible || !mobileMenuResult.insideStage) issues.push("mobile full-screen menu did not open inside the phone stage");

  console.log(JSON.stringify({ viewportResults, historyResult: {
    undoRestored: historyResult.afterUndo === historyResult.original,
    redoRestored: historyResult.afterRedo.endsWith("회귀 테스트 문장")
  }, editGapResult, menuPositionResult, menuRouteReturnResult, saveResult, mobileMenuResult }, null, 2));
} finally {
  await browser.close();
}

if (issues.length) {
  console.error(issues.join("\n"));
  process.exitCode = 1;
} else {
  console.log("editor regression browser tests OK");
}
