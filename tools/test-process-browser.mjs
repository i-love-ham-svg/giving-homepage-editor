import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const editorUrl = pathToFileURL(resolve("outputs", "representative-greeting-editor.html")).href;
const viewports = process.env.PROCESS_QA_VIEWPORTS?.split(",").filter(Boolean)
  ?? ["desktop", "phoneSmall", "phone", "tablet"];
const browserCandidates = [
  process.env.BROWSER_EXECUTABLE,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
].filter(Boolean);
const executablePath = browserCandidates.find(existsSync);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const issues = [];
const screenshots = [];

try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport: { width: viewport === "desktop" ? 1500 : 980, height: 900 } });
    page.on("pageerror", (error) => issues.push(`${viewport}: ${error.message}`));
    const url = `${editorUrl}?viewport=${viewport}&mode=view&previewSection=process`;
    await page.goto(url, { waitUntil: "commit" });
    await page.waitForSelector(".process-section-layer:not([hidden]) .process-section-content");
    const heightSamples = [];
    for (let index = 0; index < 6; index += 1) {
      heightSamples.push(await page.evaluate(() => {
        const layer = document.querySelector(".process-section-layer:not([hidden])");
        const content = layer?.querySelector(".process-section-content");
        const card = layer?.querySelector(".process-step-card");
        return {
          layer: Math.round(layer?.getBoundingClientRect().height ?? 0),
          content: content?.scrollHeight ?? 0,
          card: Math.round(card?.getBoundingClientRect().height ?? 0)
        };
      }));
      await page.waitForTimeout(160);
    }
    const firstHeight = heightSamples[0]?.layer ?? 0;
    const lastHeight = heightSamples.at(-1)?.layer ?? 0;
    if (lastHeight > firstHeight + 8) issues.push(`${viewport}: process section height keeps increasing (${firstHeight}px -> ${lastHeight}px)`);
    await page.waitForFunction(() => {
      const layer = document.querySelector(".process-section-layer:not([hidden])");
      const content = layer?.querySelector(".process-section-content");
      return layer && content && content.scrollHeight <= layer.getBoundingClientRect().height + 6;
    }, null, { timeout: 10000 }).catch(() => {});
    const result = await page.evaluate(() => {
      const stage = document.getElementById("stage");
      const layer = document.querySelector(".process-section-layer:not([hidden])");
      const content = layer?.querySelector(".process-section-content");
      const cards = [...(layer?.querySelectorAll(".process-step-card") ?? [])];
      const fields = [...(layer?.querySelectorAll("textarea.process-field") ?? [])];
      const stageRect = stage?.getBoundingClientRect();
      const layerRect = layer?.getBoundingClientRect();
      const cardRects = cards.map((card) => card.getBoundingClientRect());
      const isMobile = stage?.classList.contains("mobile");
      const overlaps = cardRects.slice(1).filter((rect, index) => {
        const previous = cardRects[index];
        return isMobile
          ? rect.top < previous.bottom - 1
          : rect.left < previous.right - 1;
      }).length;
      return {
        stageWidth: stageRect?.width ?? 0,
        layerWidth: layerRect?.width ?? 0,
        layerHeight: layerRect?.height ?? 0,
        contentScrollHeight: content?.scrollHeight ?? 0,
        cardCount: cards.length,
        overlaps,
        clippedFields: fields.filter((field) => field.scrollHeight > field.clientHeight + 2).length
      };
    });
    if (result.cardCount !== 6) issues.push(`${viewport}: expected six process cards`);
    if (result.overlaps) issues.push(`${viewport}: ${result.overlaps} process card overlaps`);
    if (result.clippedFields) issues.push(`${viewport}: ${result.clippedFields} clipped text fields`);
    if (result.contentScrollHeight > result.layerHeight + 6) issues.push(`${viewport}: process section height is shorter than its content`);
    if (result.layerWidth > result.stageWidth + 2) issues.push(`${viewport}: process section exceeds stage width`);
    console.log(viewport, JSON.stringify({ ...result, heightSamples }));
    const screenshot = join(tmpdir(), `process-section-${viewport}.png`);
    await page.screenshot({ path: screenshot });
    screenshots.push(screenshot);
    const bottomScreenshot = join(tmpdir(), `process-section-${viewport}-bottom.png`);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(120);
    await page.screenshot({ path: bottomScreenshot });
    screenshots.push(bottomScreenshot);
    await page.close();
  }

  const editPage = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  editPage.on("pageerror", (error) => issues.push(`edit: ${error.message}`));
  await editPage.goto(`${editorUrl}?viewport=desktop&mode=edit&previewSection=process`, { waitUntil: "commit" });
  await editPage.waitForSelector(".process-section-layer:not([hidden]) [data-process-field=\"headline\"]");
  await editPage.locator('[data-process-field="headline"]').dispatchEvent("pointerdown");
  await editPage.waitForTimeout(120);
  const toolbarState = await editPage.evaluate(() => ({
    hidden: document.getElementById("inlineToolbar")?.hidden,
    label: document.getElementById("inlineLayerName")?.textContent ?? ""
  }));
  if (toolbarState.hidden || !toolbarState.label.includes("프로세스 제목")) issues.push("edit: process headline toolbar did not open");

  await editPage.evaluate(() => {
    const model = window.EditorModules.process.getContent("process");
    model.heights.desktop = 3000;
    window.EditorModules.process.setContent("process", model);
    window.EditorModules.process.refreshSizing();
  });
  await editPage.waitForFunction(() => {
    const layer = document.querySelector(".process-section-layer:not([hidden])");
    return layer && layer.getBoundingClientRect().height < 1400;
  }, null, { timeout: 10000 }).catch(() => {});
  const recoveredHeight = await editPage.locator(".process-section-layer:not([hidden])").evaluate((layer) => layer.getBoundingClientRect().height);
  if (recoveredHeight >= 1400) issues.push(`edit: oversized saved process height was not corrected (${Math.round(recoveredHeight)}px)`);

  const addedState = await editPage.evaluate(() => {
    const layer = document.querySelector(".process-section-layer:not([hidden])");
    const headline = layer.querySelector('[data-process-field="headline"]');
    headline.value = "함께 걷는 지원 과정";
    headline.dispatchEvent(new Event("input", { bubbles: true }));
    const firstId = layer.querySelector("[data-step-id]")?.dataset.stepId;
    layer.querySelector('[data-step-id] [data-process-action="add-step-after"]').click();
    const updatedLayer = document.querySelector(".process-section-layer:not([hidden])");
    const ids = [...updatedLayer.querySelectorAll("[data-step-id]")].map((card) => card.dataset.stepId);
    updatedLayer.querySelectorAll("[data-step-id]")[1].querySelector('[data-process-action="select-step-icon"]').click();
    return { count: ids.length, insertedAfterFirst: ids[0] === firstId && ids[1] !== firstId };
  });
  await editPage.waitForSelector("#processIconPickerModal:not([hidden])");
  const pickerState = await editPage.evaluate(() => ({
    choiceCount: document.querySelectorAll("#processIconPickerGrid [data-process-icon-key]").length,
    textSelectCount: document.querySelectorAll('.process-section-layer select[data-process-action$="icon"]').length,
    stepAddCount: document.querySelectorAll('[data-step-id] [data-process-action="add-step-after"]').length,
    stepCount: document.querySelectorAll("[data-step-id]").length,
    globalStepAddCount: document.querySelectorAll('[data-process-action="add-step"]').length,
    highlightAddCount: document.querySelectorAll('[data-highlight-id] [data-process-action="add-highlight-after"]').length,
    highlightCount: document.querySelectorAll("[data-highlight-id]").length,
    globalHighlightAddCount: document.querySelectorAll('[data-process-action="add-highlight"]').length
  }));
  if (pickerState.choiceCount < 24) issues.push("edit: process icon picker does not show enough icon choices");
  if (pickerState.textSelectCount) issues.push("edit: legacy text icon select is still visible");
  if (pickerState.stepAddCount !== pickerState.stepCount || pickerState.globalStepAddCount) issues.push("edit: process step inline add controls are inconsistent");
  if (pickerState.highlightAddCount !== pickerState.highlightCount || pickerState.globalHighlightAddCount) issues.push("edit: process highlight inline add controls are inconsistent");
  const desktopPickerScreenshot = join(tmpdir(), "process-icon-picker-desktop.png");
  await editPage.screenshot({ path: desktopPickerScreenshot });
  screenshots.push(desktopPickerScreenshot);
  await editPage.locator('[data-process-icon-key="home"]').click();
  await editPage.locator("#processIconPickerModal").waitFor({ state: "hidden" });

  const highlightAddedState = await editPage.evaluate(() => {
    const layer = document.querySelector(".process-section-layer:not([hidden])");
    const firstId = layer.querySelector("[data-highlight-id]")?.dataset.highlightId;
    layer.querySelector('[data-highlight-id] [data-process-action="add-highlight-after"]').click();
    const ids = [...document.querySelectorAll(".process-section-layer:not([hidden]) [data-highlight-id]")]
      .map((card) => card.dataset.highlightId);
    return { count: ids.length, insertedAfterFirst: ids[0] === firstId && ids[1] !== firstId };
  });

  const editResult = await editPage.evaluate(() => {
    const model = window.EditorModules.process.getContent("process");
    const copiedId = window.EditorModules.sectionManager.addProcessAt("bottom", window.EditorModules.sectionManager.getOrder().length);
    const copiedModel = window.EditorModules.process.getContent(copiedId);
    const copiedSteps = copiedModel.steps.length;
    const copiedHighlights = copiedModel.highlights.length;
    window.EditorModules.sectionManager.deleteById(copiedId);
    const deleted = !window.EditorModules.sectionManager.getOrder().includes(copiedId);
    return {
      copiedSteps,
      copiedHighlights,
      deleted,
      headline: model.headline,
      insertedIcon: model.steps[1]?.icon,
      documentTypes: window.EditorModules.storage.createSectionDocument().sections.map((section) => section.type)
    };
  });
  if (addedState.count !== 7 || !addedState.insertedAfterFirst) issues.push("edit: inserting a process step after the selected card failed");
  if (highlightAddedState.count !== 4 || !highlightAddedState.insertedAfterFirst) issues.push("edit: inserting a process highlight after the selected card failed");
  if (editResult.copiedSteps !== 7 || editResult.copiedHighlights !== 4 || !editResult.deleted) issues.push("edit: duplicating or deleting a process section failed");
  if (editResult.headline !== "함께 걷는 지원 과정") issues.push("edit: process headline edit was not stored");
  if (editResult.insertedIcon !== "home") issues.push("edit: process icon selection was not stored");
  if (!editResult.documentTypes.includes("process")) issues.push("edit: process section was not included in the section document");

  await editPage.evaluate(() => window.EditorModules.mobileViewport.setViewport("phone"));
  await editPage.waitForTimeout(240);
  await editPage.locator('.process-section-layer:not([hidden]) [data-process-action="select-step-icon"]').first().click();
  await editPage.waitForSelector("#processIconPickerModal:not([hidden])");
  const mobilePicker = await editPage.evaluate(() => {
    const stage = document.getElementById("stage").getBoundingClientRect();
    const picker = document.getElementById("processIconPickerModal").getBoundingClientRect();
    return {
      inside: picker.left >= stage.left - 2 && picker.right <= stage.right + 2,
      stage: { left: stage.left, right: stage.right },
      picker: { left: picker.left, right: picker.right }
    };
  });
  console.log("mobilePicker", JSON.stringify(mobilePicker));
  if (!mobilePicker.inside) issues.push("edit: mobile process icon picker exceeds the phone stage");
  const mobilePickerScreenshot = join(tmpdir(), "process-icon-picker-mobile.png");
  await editPage.screenshot({ path: mobilePickerScreenshot });
  screenshots.push(mobilePickerScreenshot);
  await editPage.locator("#processIconPickerCloseBtn").click();
  await editPage.locator('[data-step-id] [data-step-field="title"]').first().dispatchEvent("pointerdown");
  await editPage.waitForFunction(() => {
    const stage = document.getElementById("stage")?.getBoundingClientRect();
    const toolbar = document.getElementById("inlineToolbar");
    const rect = toolbar?.getBoundingClientRect();
    return stage && toolbar && !toolbar.hidden && rect.left >= stage.left - 2 && rect.right <= stage.right + 2;
  }, null, { timeout: 5000 }).catch(() => {});
  const mobileToolbar = await editPage.evaluate(() => {
    const stage = document.getElementById("stage").getBoundingClientRect();
    const toolbar = document.getElementById("inlineToolbar");
    const rect = toolbar.getBoundingClientRect();
    return {
      hidden: toolbar.hidden,
      inside: rect.left >= stage.left - 2 && rect.right <= stage.right + 2 && rect.top >= stage.top - 2 && rect.bottom <= stage.bottom + 2,
      stage: { left: stage.left, top: stage.top, right: stage.right, bottom: stage.bottom },
      rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }
    };
  });
  console.log("mobileToolbar", JSON.stringify(mobileToolbar));
  if (mobileToolbar.hidden || !mobileToolbar.inside) issues.push("edit: mobile process text toolbar exceeds the phone stage");

  const baselineProcess = await editPage.evaluate(() => window.EditorModules.process.getContent("process"));
  await editPage.evaluate(() => window.EditorModules.mobileViewport.setViewport("desktop"));
  await editPage.waitForTimeout(220);
  const baselineHeight = await editPage.locator(".process-section-layer:not([hidden])").evaluate((layer) => layer.getBoundingClientRect().height);

  await editPage.evaluate((baseline) => {
    window.EditorModules.process.setContent("process", { ...baseline, steps: [] });
    window.EditorModules.process.refreshSizing();
  }, baselineProcess);
  await editPage.waitForFunction((previousHeight) => {
    const layer = document.querySelector(".process-section-layer:not([hidden])");
    return layer
      && !layer.querySelector(".process-step-list")
      && layer.querySelector(".process-highlights")
      && layer.getBoundingClientRect().height < previousHeight - 120;
  }, baselineHeight, { timeout: 10000 }).catch(() => {});
  const noStepsState = await editPage.evaluate(() => {
    const layer = document.querySelector(".process-section-layer:not([hidden])");
    return {
      hasSteps: Boolean(layer.querySelector(".process-step-list")),
      hasHighlights: Boolean(layer.querySelector(".process-highlights")),
      height: layer.getBoundingClientRect().height
    };
  });
  if (noStepsState.hasSteps || !noStepsState.hasHighlights) issues.push("edit: removing all steps should leave only the summary content");
  if (noStepsState.height >= baselineHeight - 120) issues.push("edit: process section did not shrink after removing all steps");
  const noStepsScreenshot = join(tmpdir(), "process-section-no-steps.png");
  await editPage.screenshot({ path: noStepsScreenshot, fullPage: true });
  screenshots.push(noStepsScreenshot);

  await editPage.evaluate((baseline) => {
    window.EditorModules.process.setContent("process", { ...baseline, highlights: [] });
    window.EditorModules.process.refreshSizing();
  }, baselineProcess);
  await editPage.waitForTimeout(220);
  const noHighlightsState = await editPage.evaluate(() => {
    const layer = document.querySelector(".process-section-layer:not([hidden])");
    return {
      hasSteps: Boolean(layer.querySelector(".process-step-list")),
      hasHighlights: Boolean(layer.querySelector(".process-highlights"))
    };
  });
  if (!noHighlightsState.hasSteps || noHighlightsState.hasHighlights) issues.push("edit: removing all summaries should leave only the process steps");
  const noHighlightsScreenshot = join(tmpdir(), "process-section-no-highlights.png");
  await editPage.screenshot({ path: noHighlightsScreenshot, fullPage: true });
  screenshots.push(noHighlightsScreenshot);

  await editPage.evaluate((baseline) => {
    let model = structuredClone(baseline);
    while (model.highlights.length < 5) model = window.EditorProcessManager.addHighlight(model);
    model.highlights = model.highlights.slice(0, 5);
    window.EditorModules.process.setContent("process", model);
    window.EditorModules.process.refreshSizing();
  }, baselineProcess);
  await editPage.waitForTimeout(260);
  const fiveHighlightLayout = await editPage.evaluate(() => {
    const container = document.querySelector(".process-section-layer:not([hidden]) .process-highlights");
    const bounds = container.getBoundingClientRect();
    const items = [...container.querySelectorAll(".process-highlight-item")].map((item) => item.getBoundingClientRect());
    const close = (a, b) => Math.abs(a - b) <= 2;
    return {
      count: items.length,
      firstRow: close(items[0].top, items[1].top) && close(items[1].top, items[2].top),
      secondRow: items[3].top > items[0].top + 4 && close(items[3].top, items[4].top),
      fillsSecondRow: close(items[3].left, bounds.left) && close(items[4].right, bounds.right)
    };
  });
  if (fiveHighlightLayout.count !== 5 || !fiveHighlightLayout.firstRow || !fiveHighlightLayout.secondRow || !fiveHighlightLayout.fillsSecondRow) {
    issues.push("edit: five summaries should fill a three-plus-two row layout without an empty cell");
  }
  const fiveHighlightsScreenshot = join(tmpdir(), "process-section-five-highlights.png");
  await editPage.screenshot({ path: fiveHighlightsScreenshot, fullPage: true });
  screenshots.push(fiveHighlightsScreenshot);

  await editPage.evaluate((baseline) => {
    let model = structuredClone(baseline);
    while (model.highlights.length < 9) model = window.EditorProcessManager.addHighlight(model);
    model.highlights = model.highlights.slice(0, 9);
    window.EditorModules.process.setContent("process", model);
    window.EditorModules.process.refreshSizing();
  }, baselineProcess);
  await editPage.waitForTimeout(260);
  const nineHighlightLayout = await editPage.evaluate(() => {
    const container = document.querySelector(".process-section-layer:not([hidden]) .process-highlights");
    const bounds = container.getBoundingClientRect();
    const items = [...container.querySelectorAll(".process-highlight-item")].map((item) => item.getBoundingClientRect());
    const rows = [];
    items.forEach((rect) => {
      let row = rows.find((entry) => Math.abs(entry.top - rect.top) <= 2);
      if (!row) {
        row = { top: rect.top, items: [] };
        rows.push(row);
      }
      row.items.push(rect);
    });
    rows.sort((a, b) => a.top - b.top);
    return {
      count: items.length,
      rowSizes: rows.map((row) => row.items.length),
      rowsFill: rows.every((row) => {
        row.items.sort((a, b) => a.left - b.left);
        return Math.abs(row.items[0].left - bounds.left) <= 2
          && Math.abs(row.items.at(-1).right - bounds.right) <= 2;
      })
    };
  });
  if (nineHighlightLayout.count !== 9
    || JSON.stringify(nineHighlightLayout.rowSizes) !== JSON.stringify([3, 3, 3])
    || !nineHighlightLayout.rowsFill) {
    issues.push("edit: nine summaries should fill three balanced rows without empty cells");
  }
  const nineHighlightsScreenshot = join(tmpdir(), "process-section-nine-highlights.png");
  await editPage.screenshot({ path: nineHighlightsScreenshot, fullPage: true });
  screenshots.push(nineHighlightsScreenshot);

  await editPage.evaluate(() => window.EditorModules.mobileViewport.setMode("view"));
  await editPage.waitForFunction(() => {
    const layer = document.querySelector(".process-section-layer:not([hidden])");
    const content = layer?.querySelector(".process-section-content");
    if (!layer || !content) return false;
    return layer.getBoundingClientRect().bottom - content.getBoundingClientRect().bottom <= 28;
  }, null, { timeout: 10000 }).catch(() => {});
  const previewSpacing = await editPage.evaluate(() => {
    const layer = document.querySelector(".process-section-layer:not([hidden])");
    const content = layer.querySelector(".process-section-content");
    const highlights = content.querySelector(".process-highlights");
    const layerRect = layer.getBoundingClientRect();
    const contentRect = content.getBoundingClientRect();
    const highlightsRect = highlights.getBoundingClientRect();
    return {
      layerGap: layerRect.bottom - contentRect.bottom,
      contentGap: contentRect.bottom - highlightsRect.bottom
    };
  });
  if (previewSpacing.layerGap > 28 || previewSpacing.contentGap > 90) {
    issues.push(`view: process section retained excessive empty space (${JSON.stringify(previewSpacing)})`);
  }
  const previewScreenshot = join(tmpdir(), "process-section-preview-tight.png");
  await editPage.screenshot({ path: previewScreenshot, fullPage: true });
  screenshots.push(previewScreenshot);
  await editPage.evaluate(() => window.EditorModules.mobileViewport.setMode("edit"));
  await editPage.waitForTimeout(180);

  await editPage.evaluate((baseline) => window.EditorModules.process.setContent("process", baseline), baselineProcess);
  await editPage.waitForTimeout(180);

  const smokeState = await editPage.evaluate(() => ({
    schemaConstant: window.EditorStorageSchema?.SCHEMA_VERSION,
    saveSchemaVersion,
    documentVersion: StorageManager.createSectionDocument().schemaVersion,
    smoke: window.runEditorRegressionSmoke()
  }));
  console.log("smoke schema", JSON.stringify({
    schemaConstant: smokeState.schemaConstant,
    saveSchemaVersion: smokeState.saveSchemaVersion,
    documentVersion: smokeState.documentVersion
  }));
  if (!smokeState.smoke?.ok) issues.push(...(smokeState.smoke?.issues ?? ["editor smoke test failed"]));
  await editPage.close();

} finally {
  await browser.close();
}

if (issues.length) {
  console.error(issues.join("\n"));
  process.exitCode = 1;
} else {
  console.log("process browser tests OK");
  screenshots.forEach((path) => console.log(path));
}
