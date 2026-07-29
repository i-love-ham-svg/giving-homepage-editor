import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

async function measureHistoryLayout(viewport, mode) {
  const page = await browser.newPage({ viewport: { width: 1500, height: 960 } });
  page.on("pageerror", (error) => issues.push(`${viewport}-${mode}: ${error.message}`));
  await page.goto(`${editorUrl}?viewport=${viewport}&mode=${mode}&previewSection=history`, { waitUntil: "commit" });
  await page.waitForSelector(".history-section-layer:not([hidden]) .history-group-card");
  await page.waitForTimeout(500);
  const result = await page.evaluate(() => {
    const stage = document.getElementById("stage").getBoundingClientRect();
    const layer = document.querySelector(".history-section-layer:not([hidden])").getBoundingClientRect();
    const card = document.querySelector(".history-section-layer:not([hidden]) .history-group-card").getBoundingClientRect();
    const row = document.querySelector(".history-section-layer:not([hidden]) .history-event-row").getBoundingClientRect();
    const tools = document.querySelector(".history-section-layer:not([hidden]) .history-event-tools");
    const icon = document.querySelector(".history-section-layer:not([hidden]) .history-group-icon");
    const moveTools = tools?.querySelector(".history-event-move-tools");
    const editTools = tools?.querySelector(".history-event-edit-tools");
    const eventImage = document.querySelector(".history-section-layer:not([hidden]) .history-event-image");
    const toolsRect = tools?.getBoundingClientRect();
    const iconRect = icon?.getBoundingClientRect();
    const moveRect = moveTools?.getBoundingClientRect();
    const editRect = editTools?.getBoundingClientRect();
    const imageRect = eventImage?.getBoundingClientRect();
    const controlRects = [...(tools?.querySelectorAll("button") ?? [])].map((button) => button.getBoundingClientRect());
    const intersects = (first, second) => Boolean(first && second
      && first.left < second.right
      && first.right > second.left
      && first.top < second.bottom
      && first.bottom > second.top);
    return {
      cardHeight: Math.round(card.height),
      rowHeight: Math.round(row.height),
      cardWidthRatio: Number((card.width / stage.width).toFixed(4)),
      layerWidthRatio: Number((layer.width / stage.width).toFixed(4)),
      toolsOverlapIcon: Boolean(toolsRect && iconRect
        && toolsRect.left < iconRect.right
        && toolsRect.right > iconRect.left
        && toolsRect.top < iconRect.bottom
        && toolsRect.bottom > iconRect.top),
      desktopControlsSingleRow: controlRects.length === 4
        && Math.max(...controlRects.map((rect) => rect.top)) - Math.min(...controlRects.map((rect) => rect.top)) <= 2,
      mobileMoveAtTopRight: Boolean(moveRect
        && Math.abs(moveRect.right - row.right) <= 5
        && moveRect.top - row.top <= 6),
      mobileEditAtBottomRight: Boolean(editRect
        && Math.abs(editRect.right - row.right) <= 5
        && row.bottom - editRect.bottom <= 6),
      mobileControlsOverlapImage: intersects(moveRect, imageRect) || intersects(editRect, imageRect)
    };
  });
  await page.close();
  return result;
}

try {
  for (const viewport of ["desktop", "phoneSmall", "phone", "tablet"]) {
    const page = await browser.newPage({ viewport: { width: 1500, height: 960 } });
    page.on("pageerror", (error) => issues.push(`${viewport}: ${error.message}`));
    await page.goto(`${editorUrl}?viewport=${viewport}&mode=view&previewSection=history`, { waitUntil: "commit" });
    await page.waitForSelector(".history-section-layer:not([hidden]) .history-section-content");
    await page.waitForTimeout(900);
    const result = await page.evaluate(() => {
      const stage = document.getElementById("stage");
      const layer = document.querySelector(".history-section-layer:not([hidden])");
      const content = layer?.querySelector(".history-section-content");
      const cards = [...(layer?.querySelectorAll(".history-group-card") ?? [])];
      const cardRects = cards.map((card) => card.getBoundingClientRect());
      const fields = [...(layer?.querySelectorAll("textarea") ?? [])];
      const rows = [];
      cardRects.forEach((rect) => {
        let row = rows.find((item) => Math.abs(item.top - rect.top) <= 2);
        if (!row) { row = { top: rect.top, cards: [] }; rows.push(row); }
        row.cards.push(rect);
      });
      const overlaps = cardRects.reduce((count, rect, index) => count + cardRects
        .slice(index + 1)
        .filter((other) => rect.top < other.bottom - 1
          && rect.bottom > other.top + 1
          && rect.left < other.right - 1
          && rect.right > other.left + 1).length, 0);
      return {
        isMobile: stage.classList.contains("mobile"),
        cardCount: cards.length,
        rowSizes: rows.sort((a, b) => a.top - b.top).map((row) => row.cards.length),
        overlaps,
        clippedFields: fields.filter((field) => field.scrollHeight > field.clientHeight + 2).length,
        layerHeight: Math.round(layer.getBoundingClientRect().height),
        contentHeight: content.scrollHeight,
        horizontalOverflow: layer.getBoundingClientRect().right > stage.getBoundingClientRect().right + 2
          || layer.getBoundingClientRect().left < stage.getBoundingClientRect().left - 2
      };
    });
    console.log(viewport, JSON.stringify(result));
    await page.screenshot({ path: join(tmpdir(), `timeline-section-${viewport}.png`), fullPage: true });
    if (result.cardCount !== 4) issues.push(`${viewport}: expected four history month cards`);
    if (result.overlaps) issues.push(`${viewport}: history cards overlap`);
    if (result.clippedFields) issues.push(`${viewport}: ${result.clippedFields} history text fields are clipped`);
    if (result.contentHeight > result.layerHeight + 8) issues.push(`${viewport}: history content is clipped`);
    if (result.horizontalOverflow) issues.push(`${viewport}: history layer exceeds the stage`);
    if (viewport === "desktop" && JSON.stringify(result.rowSizes) !== JSON.stringify([2, 2])) issues.push("desktop: history cards should use two columns");
    if (viewport !== "desktop" && result.rowSizes.some((size) => size !== 1)) issues.push(`${viewport}: history cards should stack in one column`);
    await page.close();
  }

  const layoutPairs = {};
  for (const viewport of ["desktop", "phone"]) {
    layoutPairs[viewport] = {
      edit: await measureHistoryLayout(viewport, "edit"),
      view: await measureHistoryLayout(viewport, "view")
    };
    const { edit, view } = layoutPairs[viewport];
    if (Math.abs(edit.cardHeight - view.cardHeight) > 2) {
      issues.push(`${viewport}: edit and preview history card heights differ (${edit.cardHeight}/${view.cardHeight})`);
    }
    if (Math.abs(edit.rowHeight - view.rowHeight) > 2) {
      issues.push(`${viewport}: edit and preview history row heights differ (${edit.rowHeight}/${view.rowHeight})`);
    }
    if (Math.abs(edit.cardWidthRatio - view.cardWidthRatio) > 0.015) {
      issues.push(`${viewport}: edit and preview history card width ratios differ (${edit.cardWidthRatio}/${view.cardWidthRatio})`);
    }
    if (edit.toolsOverlapIcon) issues.push(`${viewport}: history editing tools overlap the month icon`);
    if (viewport === "desktop" && !edit.desktopControlsSingleRow) {
      issues.push("desktop: history event add, move, and delete controls should share one row");
    }
    if (viewport === "phone" && (!edit.mobileMoveAtTopRight || !edit.mobileEditAtBottomRight)) {
      issues.push("phone: history move controls should be top-right and add/delete controls bottom-right");
    }
    if (viewport === "phone" && edit.mobileControlsOverlapImage) {
      issues.push("phone: history controls overlap the event image upload area");
    }
  }
  console.log("layout parity", JSON.stringify(layoutPairs));

  const page = await browser.newPage({ viewport: { width: 1500, height: 960 } });
  page.on("pageerror", (error) => issues.push(`edit: ${error.message}`));
  await page.goto(`${editorUrl}?viewport=desktop&mode=edit&previewSection=history`, { waitUntil: "commit" });
  await page.waitForSelector('.history-section-layer:not([hidden]) [data-history-field="headline"]');
  const themeIntegrationResult = await page.evaluate(async () => {
    const read = () => {
      const layer = document.querySelector(".history-section-layer:not([hidden])");
      const periods = [...layer.querySelectorAll(".history-group-period")];
      return {
        headline: getComputedStyle(layer.querySelector('[data-history-field="headline"]')).color,
        date: getComputedStyle(layer.querySelector("[data-history-event-field='date']")).color,
        greenPeriod: getComputedStyle(periods[0]).backgroundColor,
        secondaryPeriod: getComputedStyle(periods[1]).backgroundColor,
        surface: getComputedStyle(layer.querySelector(".history-section-content")).backgroundImage
      };
    };
    const waitForPaint = () => new Promise((resolveWait) => requestAnimationFrame(() => requestAnimationFrame(resolveWait)));
    const warm = read();
    document.querySelector('[data-theme="blue"]')?.click();
    await waitForPaint();
    const blue = read();
    document.querySelector('[data-theme="warm"]')?.click();
    await waitForPaint();
    return { warm, blue };
  });
  console.log("theme", JSON.stringify(themeIntegrationResult));
  if (themeIntegrationResult.warm.headline === themeIntegrationResult.blue.headline
    || themeIntegrationResult.warm.date === themeIntegrationResult.blue.date) {
    issues.push("edit: history text colors are not linked to the shared mood theme");
  }
  if (themeIntegrationResult.warm.greenPeriod === themeIntegrationResult.blue.greenPeriod
    || themeIntegrationResult.warm.secondaryPeriod === themeIntegrationResult.blue.secondaryPeriod
    || themeIntegrationResult.warm.surface === themeIntegrationResult.blue.surface) {
    issues.push("edit: history card backgrounds are not linked to the shared mood theme");
  }
  await page.locator('[data-history-field="headline"]').dispatchEvent("pointerdown");
  await page.waitForTimeout(160);
  const toolbar = await page.evaluate(() => ({
    hidden: document.getElementById("inlineToolbar")?.hidden,
    label: document.getElementById("inlineLayerName")?.textContent ?? ""
  }));
  if (toolbar.hidden || !toolbar.label.includes("연혁 제목")) issues.push("edit: history text toolbar did not open");

  const editResult = await page.evaluate(async () => {
    const waitForRender = () => new Promise((resolveWait) => setTimeout(resolveWait, 360));
    const readLayer = () => document.querySelector(".history-section-layer:not([hidden])");
    const layer = readLayer();
    const sectionId = layer?.dataset.sectionId || "history";
    const initialModel = window.EditorModules.history.getContent(sectionId);
    const beforeHeight = layer.getBoundingClientRect().height;
    const beforeCount = initialModel.groups.length;
    const beforeEventCount = initialModel.groups.reduce((sum, group) => sum + group.events.length, 0);
    const firstGroupId = initialModel.groups[0].id;
    const firstEventId = initialModel.groups[0].events[0].id;
    const monthAddButtonCount = layer.querySelectorAll('[data-history-action="add-group-after"]').length;
    const eventAddButtonCount = layer.querySelectorAll('[data-history-action="add-event-after"]').length;

    layer.querySelector(`[data-history-group-id="${CSS.escape(firstGroupId)}"] [data-history-action="add-group-after"]`).click();
    await waitForRender();
    const groupAddedModel = window.EditorModules.history.getContent(sectionId);
    const insertedGroupId = groupAddedModel.groups[1]?.id;
    const groupInsertedAfterTarget = groupAddedModel.groups[0]?.id === firstGroupId
      && Boolean(insertedGroupId)
      && insertedGroupId !== initialModel.groups[1]?.id;
    readLayer().querySelector(`[data-history-group-id="${CSS.escape(insertedGroupId)}"] [data-history-action="delete-group"]`).click();
    await waitForRender();

    readLayer().querySelector(`[data-history-group-id="${CSS.escape(firstGroupId)}"] [data-history-event-id="${CSS.escape(firstEventId)}"] [data-history-action="add-event-after"]`).click();
    await waitForRender();
    const eventAddedModel = window.EditorModules.history.getContent(sectionId);
    const firstGroupAfterEventAdd = eventAddedModel.groups.find((group) => group.id === firstGroupId);
    const insertedEventId = firstGroupAfterEventAdd?.events[1]?.id;
    const eventInsertedAfterTarget = firstGroupAfterEventAdd?.events[0]?.id === firstEventId
      && Boolean(insertedEventId)
      && insertedEventId !== initialModel.groups[0].events[1]?.id;
    readLayer().querySelector(`[data-history-group-id="${CSS.escape(firstGroupId)}"] [data-history-event-id="${CSS.escape(insertedEventId)}"] [data-history-action="delete-event"]`).click();
    await waitForRender();

    const restoredLayer = readLayer();
    const finalModel = window.EditorModules.history.getContent(sectionId);
    const copiedId = window.EditorModules.sectionManager.addHistoryAt("bottom", window.EditorModules.sectionManager.getOrder().length);
    const copiedGroups = window.EditorModules.history.getContent(copiedId).groups.length;
    window.EditorModules.sectionManager.deleteById(copiedId);
    return {
      beforeCount,
      beforeEventCount,
      finalCount: finalModel.groups.length,
      finalEventCount: finalModel.groups.reduce((sum, group) => sum + group.events.length, 0),
      monthAddButtonCount,
      eventAddButtonCount,
      groupInsertedAfterTarget,
      eventInsertedAfterTarget,
      beforeHeight,
      finalHeight: restoredLayer.getBoundingClientRect().height,
      copiedGroups,
      copiedDeleted: !window.EditorModules.sectionManager.getOrder().includes(copiedId),
      documentTypes: window.EditorModules.storage.createSectionDocument().sections.map((section) => section.type)
    };
  });
  console.log("edit", JSON.stringify(editResult));
  if (editResult.monthAddButtonCount !== editResult.beforeCount) issues.push("edit: every history month must expose its own add button");
  if (editResult.eventAddButtonCount !== editResult.beforeEventCount) issues.push("edit: every history event image must expose its own add button");
  if (!editResult.groupInsertedAfterTarget || editResult.finalCount !== editResult.beforeCount) issues.push("edit: inserting or deleting a history month after the selected month failed");
  if (!editResult.eventInsertedAfterTarget || editResult.finalEventCount !== editResult.beforeEventCount) issues.push("edit: inserting or deleting a history event after the selected event failed");
  if (Math.abs(editResult.beforeHeight - editResult.finalHeight) > 16) issues.push("edit: history height did not shrink after deleting a month");
  if (editResult.copiedGroups !== 4 || !editResult.copiedDeleted) issues.push("edit: duplicating or deleting a history section failed");
  if (!editResult.documentTypes.includes("history")) issues.push("edit: history section is missing from the saved section document");
  await page.close();
} finally {
  await browser.close();
}

if (issues.length) {
  console.error(issues.join("\n"));
  process.exitCode = 1;
} else {
  console.log("timeline browser tests OK");
}
