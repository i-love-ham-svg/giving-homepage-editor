import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const editorUrl = pathToFileURL(resolve("outputs", "representative-greeting-editor.html")).href;
const executablePath = [
  process.env.BROWSER_EXECUTABLE,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
].filter(Boolean).find(existsSync);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const issues = [];

async function measure(viewport, mode) {
  const page = await browser.newPage({ viewport: { width: 1500, height: 960 } });
  page.on("pageerror", (error) => issues.push(`${viewport}-${mode}: ${error.message}`));
  await page.goto(`${editorUrl}?viewport=${viewport}&mode=${mode}&previewSection=program`, { waitUntil: "commit" });
  await page.waitForSelector(".program-section-layer:not([hidden]) .program-card");
  await page.waitForTimeout(700);
  const result = await page.evaluate(() => {
    const rect = (selector) => document.querySelector(selector)?.getBoundingClientRect();
    const stage = rect("#stage");
    const layer = rect(".program-section-layer:not([hidden])");
    const content = rect(".program-section-layer:not([hidden]) .program-section-content");
    const card = rect(".program-section-layer:not([hidden]) .program-card");
    const image = rect(".program-section-layer:not([hidden]) .program-card-image");
    const body = rect(".program-section-layer:not([hidden]) .program-card-body");
    const summary = rect(".program-section-layer:not([hidden]) .program-summary");
    const tabs = rect(".program-section-layer:not([hidden]) .program-category-tabs");
    const title = rect(".program-section-layer:not([hidden]) .program-card-title-input");
    const category = rect(".program-section-layer:not([hidden]) .program-card-category-select");
    const upload = rect(".program-section-layer:not([hidden]) .program-card-image-upload");
    const add = rect(".program-section-layer:not([hidden]) .program-card-add");
    const addImage = rect(".program-section-layer:not([hidden]) .program-card:has(.program-card-add) .program-card-image");
    const imageUpload = rect(".program-section-layer:not([hidden]) .program-card:has(.program-card-add) .program-card-image-upload");
    const movePrevious = rect('.program-section-layer:not([hidden]) [data-program-action="move-card-previous"]');
    const moveNext = rect('.program-section-layer:not([hidden]) [data-program-action="move-card-next"]');
    const headline = rect(".program-section-layer:not([hidden]) .program-section-head");
    const categoryPreview = rect(".program-section-layer:not([hidden]) .program-category-tab");
    const categoryEditor = rect(".program-section-layer:not([hidden]) .program-category-edit");
    const overlaps = (a, b) => Boolean(a && b
      && a.left < b.right - 1 && a.right > b.left + 1
      && a.top < b.bottom - 1 && a.bottom > b.top + 1);
    const isVisible = (value) => Boolean(value && value.width > 0 && value.height > 0);
    const categoryVisual = [categoryPreview, categoryEditor].find(isVisible);
    return {
      layerHeight: Math.round(layer.height),
      contentHeight: Math.round(content.height),
      cardHeight: Math.round(card.height),
      imageHeight: Math.round(image.height),
      bodyHeight: Math.round(body.height),
      summaryHeight: Math.round(summary.height),
      tabsHeight: Math.round(tabs.height),
      categoryWidth: Math.round(categoryVisual.width),
      categoryHeight: Math.round(categoryVisual.height),
      titleTop: Math.round(title.top - card.top),
      cardWidth: Math.round(card.width),
      cardWidthRatio: Number((card.width / stage.width).toFixed(4)),
      layerWidthRatio: Number((layer.width / stage.width).toFixed(4)),
      controlsVisible: [category, upload, add, movePrevious, moveNext].every(isVisible),
      inlineCategoryControls: document.querySelectorAll(".program-category-view, .program-category-delete, .program-category-add").length,
      categoryUploadOverlap: overlaps(category, upload),
      addHeadlineOverlap: overlaps(add, headline),
      addInsideImage: Boolean(add && addImage
        && add.left >= addImage.left - 1 && add.right <= addImage.right + 1
        && add.top >= addImage.top - 1 && add.bottom <= addImage.bottom + 1),
      addLeftGap: add && addImage ? Math.round(add.left - addImage.left) : null,
      addBottomGap: add && addImage ? Math.round(addImage.bottom - add.bottom) : null,
      addUploadOverlap: overlaps(add, imageUpload),
      horizontalOverflow: layer.left < stage.left - 2 || layer.right > stage.right + 2
    };
  });
  await page.close();
  return result;
}

async function exerciseProgramManagement() {
  const page = await browser.newPage({ viewport: { width: 1500, height: 960 } });
  page.on("pageerror", (error) => issues.push(`management: ${error.message}`));
  await page.goto(`${editorUrl}?viewport=desktop&mode=edit&previewSection=program`, { waitUntil: "commit" });
  await page.waitForSelector(".program-section-layer:not([hidden]) .program-card-add");
  const initialOrder = await page.locator(".program-section-layer:not([hidden]) .program-card").evaluateAll((cards) => cards.map((card) => card.dataset.cardId));
  await page.locator(".program-section-layer:not([hidden]) .program-card").nth(1).locator(".program-card-add").click();
  await page.waitForFunction(() => document.querySelectorAll(".program-section-layer:not([hidden]) .program-card").length === 5);
  const insertedOrder = await page.locator(".program-section-layer:not([hidden]) .program-card").evaluateAll((cards) => cards.map((card) => card.dataset.cardId));
  if (insertedOrder[0] !== initialOrder[0]
    || insertedOrder[1] !== initialOrder[1]
    || insertedOrder[3] !== initialOrder[2]
    || insertedOrder[4] !== initialOrder[3]) {
    issues.push("management: card add button did not insert directly after its card");
  }
  await page.locator(".program-section-layer:not([hidden]) .program-card").last().locator(".program-card-add").click();
  await page.waitForFunction(() => document.querySelectorAll(".program-section-layer:not([hidden]) .program-card").length === 6);
  const grid = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll(".program-section-layer:not([hidden]) .program-card"));
    const gridRect = document.querySelector(".program-section-layer:not([hidden]) .program-card-grid").getBoundingClientRect();
    const rows = [];
    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      let row = rows.find((item) => Math.abs(item.top - rect.top) <= 2);
      if (!row) {
        row = { top: rect.top, cards: [] };
        rows.push(row);
      }
      row.cards.push({ left: rect.left, right: rect.right, width: rect.width });
    });
    return {
      rowCounts: rows.map((row) => row.cards.length),
      rowEdgeGaps: rows.map((row) => ({
        left: Math.round(Math.min(...row.cards.map((card) => card.left)) - gridRect.left),
        right: Math.round(gridRect.right - Math.max(...row.cards.map((card) => card.right)))
      })),
      addButtons: document.querySelectorAll(".program-section-layer:not([hidden]) .program-card-add").length
    };
  });
  if (grid.rowCounts.join(",") !== "3,3") issues.push(`management: six cards do not fill two rows (${grid.rowCounts.join(",")})`);
  if (grid.rowEdgeGaps.some((gap) => Math.abs(gap.left) > 2 || Math.abs(gap.right) > 2)) {
    issues.push(`management: a program row leaves unused horizontal space (${JSON.stringify(grid.rowEdgeGaps)})`);
  }
  if (grid.addButtons !== 6) issues.push(`management: expected one add button per card, found ${grid.addButtons}`);

  const beforeOrder = await page.locator(".program-section-layer:not([hidden]) .program-card").evaluateAll((cards) => cards.map((card) => card.dataset.cardId));
  await page.locator(".program-section-layer:not([hidden]) .program-card").last().locator('[data-program-action="move-card-previous"]').click();
  const afterOrder = await page.locator(".program-section-layer:not([hidden]) .program-card").evaluateAll((cards) => cards.map((card) => card.dataset.cardId));
  const last = beforeOrder.length - 1;
  if (afterOrder[last - 1] !== beforeOrder[last] || afterOrder[last] !== beforeOrder[last - 1]) {
    issues.push("management: move-previous did not swap the final two program cards");
  }
  await page.close();
  return { grid, initialOrder, insertedOrder, beforeOrder, afterOrder };
}

try {
  const results = {};
  for (const viewport of ["desktop", "phoneSmall", "phone", "tablet"]) {
    results[viewport] = {
      edit: await measure(viewport, "edit"),
      view: await measure(viewport, "view")
    };
    const { edit, view } = results[viewport];
    for (const field of ["layerHeight", "contentHeight", "cardHeight", "imageHeight", "bodyHeight", "summaryHeight", "tabsHeight", "categoryWidth", "categoryHeight", "titleTop"]) {
      if (Math.abs(edit[field] - view[field]) > 2) {
        issues.push(`${viewport}: edit and preview ${field} differ (${edit[field]}/${view[field]})`);
      }
    }
    if (Math.abs(edit.cardWidth - view.cardWidth) > 2) {
      issues.push(`${viewport}: edit and preview card widths differ (${edit.cardWidth}/${view.cardWidth})`);
    }
    if (!edit.controlsVisible) issues.push(`${viewport}: program edit controls are missing`);
    if (view.controlsVisible) issues.push(`${viewport}: program edit controls are visible in preview`);
    if (edit.inlineCategoryControls || view.inlineCategoryControls) issues.push(`${viewport}: duplicate category controls are visible inside the tabs`);
    if (edit.categoryUploadOverlap) issues.push(`${viewport}: category selector overlaps the image upload button`);
    if (edit.addHeadlineOverlap) issues.push(`${viewport}: add-program button overlaps the section headline`);
    if (!edit.addInsideImage) issues.push(`${viewport}: add-program button is not inside the program image area`);
    if (viewport !== "desktop" && (Math.abs(edit.addLeftGap - 7) > 2 || Math.abs(edit.addBottomGap - 7) > 2)) {
      issues.push(`${viewport}: add-program button is not anchored to the image lower-left (${edit.addLeftGap}/${edit.addBottomGap})`);
    }
    if (edit.addUploadOverlap) issues.push(`${viewport}: add-program button overlaps the image upload button`);
    if (edit.horizontalOverflow || view.horizontalOverflow) issues.push(`${viewport}: program section exceeds the stage`);
  }
  results.management = await exerciseProgramManagement();
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}

if (issues.length) {
  console.error(issues.join("\n"));
  process.exitCode = 1;
} else {
  console.log("program layout browser tests OK");
}
