import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";

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

try {
  for (const viewport of ["desktop", "phoneSmall", "phone", "tablet"]) {
    const page = await browser.newPage({ viewport: { width: 1500, height: 960 } });
    page.on("pageerror", (error) => issues.push(`${viewport}: ${error.message}`));
    await page.goto(`${editorUrl}?viewport=${viewport}&mode=view&previewSection=donation`, { waitUntil: "commit" });
    await page.waitForSelector(".donation-section-layer:not([hidden]) .donation-section-content", { timeout: 60000 });
    await page.waitForTimeout(900);
    const result = await page.evaluate(() => {
      const stage = document.getElementById("stage");
      const layer = document.querySelector(".donation-section-layer:not([hidden])");
      const content = layer?.querySelector(".donation-section-content");
      const cards = [...(layer?.querySelectorAll(".donation-card") ?? [])];
      const stageRect = stage.getBoundingClientRect();
      const layerRect = layer.getBoundingClientRect();
      const cardRects = cards.map((card) => card.getBoundingClientRect());
      const overlaps = cardRects.flatMap((rect, index) => cardRects.slice(index + 1).filter((other) => (
        rect.left < other.right - 1 && rect.right > other.left + 1 && rect.top < other.bottom - 1 && rect.bottom > other.top + 1
      ))).length;
      const rows = [];
      cardRects.forEach((rect) => {
        let row = rows.find((entry) => Math.abs(entry.top - rect.top) < 3);
        if (!row) { row = { top: rect.top, count: 0 }; rows.push(row); }
        row.count += 1;
      });
      return {
        cardCount: cards.length,
        rowSizes: rows.sort((a, b) => a.top - b.top).map((row) => row.count),
        overlaps,
        clippedFields: [...layer.querySelectorAll("textarea")].filter((field) => field.scrollHeight > field.clientHeight + 2).length,
        clippedContent: content.scrollHeight > layerRect.height + 8,
        horizontalOverflow: layerRect.left < stageRect.left - 2 || layerRect.right > stageRect.right + 2,
        layerHeight: Math.round(layerRect.height),
        contentHeight: content.scrollHeight
      };
    });
    console.log(viewport, JSON.stringify(result));
    await page.screenshot({ path: join(tmpdir(), `donation-section-${viewport}.png`), fullPage: true });
    if (result.cardCount !== 4) issues.push(`${viewport}: expected four donation cards`);
    if (result.overlaps) issues.push(`${viewport}: donation cards overlap`);
    if (result.clippedFields) issues.push(`${viewport}: ${result.clippedFields} donation text fields are clipped`);
    if (result.clippedContent) issues.push(`${viewport}: donation content is clipped`);
    if (result.horizontalOverflow) issues.push(`${viewport}: donation section exceeds stage width`);
    if (viewport === "desktop" && JSON.stringify(result.rowSizes) !== JSON.stringify([4])) issues.push("desktop: donation cards should use four columns");
    if (viewport === "tablet" && result.rowSizes.some((count) => count > 2)) issues.push("tablet: donation cards should use at most two columns");
    if ((viewport === "phone" || viewport === "phoneSmall") && result.rowSizes.some((count) => count !== 1)) issues.push(`${viewport}: donation cards should stack`);
    await page.close();
  }

  const page = await browser.newPage({ viewport: { width: 1500, height: 960 } });
  await page.goto(`${editorUrl}?viewport=desktop&mode=edit&previewSection=donation`, { waitUntil: "commit" });
  await page.waitForSelector('.donation-section-layer:not([hidden]) [data-donation-field="headline"]', { timeout: 60000 });
  await page.locator('.donation-section-layer:not([hidden]) [data-donation-field="headline"]').click();
  await page.waitForFunction(() => document.getElementById("inlineLayerName")?.textContent?.includes("후원 안내 제목"));
  const toolbarLabel = await page.locator("#inlineLayerName").textContent();
  await page.locator('.donation-section-layer:not([hidden]) .donation-heart-mark').click();
  await page.waitForSelector("#decorationPickerModal:not([hidden])");
  const decorationOptionCounts = await page.evaluate(() => ({
    icons: document.querySelectorAll("#decorationIconGrid [data-decoration-icon-key]").length,
    styles: document.querySelectorAll("#decorationStyleGrid [data-decoration-style-key]").length
  }));
  await page.locator('[data-decoration-icon-key="sprout"]').click();
  await page.locator('[data-decoration-style-key="double-ring"]').click();
  const decorationApplied = await page.evaluate(() => ({
    model: window.EditorModules.donation.getContent("donation").decorations[0],
    className: document.querySelector('.donation-section-layer:not([hidden]) .donation-heart-mark')?.className
  }));
  await page.locator("#decorationRemoveBtn").click();
  await page.waitForSelector("#decorationPickerModal", { state: "hidden" });
  const decorationRemoved = await page.evaluate(() => ({
    decorationCount: window.EditorModules.donation.getContent("donation").decorations.length,
    decorationVisible: Boolean(document.querySelector('.donation-section-layer:not([hidden]) .donation-heart-mark'))
  }));
  await page.locator('.donation-section-layer:not([hidden]) .donation-decoration-add').click();
  await page.waitForSelector("#decorationPickerModal:not([hidden])");
  await page.locator('[data-decoration-icon-key="heart"]').click();
  await page.locator('[data-decoration-style-key="soft-circle"]').click();
  await page.locator("#decorationPickerCloseBtn").click();
  if (decorationOptionCounts.icons < 20 || decorationOptionCounts.styles < 10) issues.push(`edit: decoration choices are insufficient (${JSON.stringify(decorationOptionCounts)})`);
  if (decorationApplied.model.icon !== "sprout" || decorationApplied.model.style !== "double-ring" || !decorationApplied.className?.includes("visual-decoration--double-ring")) issues.push(`edit: decoration icon or style was not applied (${JSON.stringify(decorationApplied)})`);
  if (decorationRemoved.decorationCount !== 0 || decorationRemoved.decorationVisible) issues.push(`edit: decoration was not removed cleanly (${JSON.stringify(decorationRemoved)})`);
  const untouchedIconBefore = await page.evaluate(() => {
    const model = window.EditorModules.donation.getContent("donation");
    const icon = document.querySelectorAll('.donation-section-layer:not([hidden]) .donation-card-icon')[3];
    return {
      model: JSON.stringify(model.cards[3]),
      background: getComputedStyle(icon).backgroundColor,
      borderRadius: getComputedStyle(icon).borderRadius
    };
  });
  await page.locator('.donation-section-layer:not([hidden]) .donation-card-icon').nth(3).click();
  await page.waitForSelector("#donationIconPickerModal:not([hidden])");
  await page.locator("#donationIconPickerCloseBtn").click();
  const untouchedIconAfter = await page.evaluate(() => {
    const model = window.EditorModules.donation.getContent("donation");
    const icon = document.querySelectorAll('.donation-section-layer:not([hidden]) .donation-card-icon')[3];
    return {
      model: JSON.stringify(model.cards[3]),
      background: getComputedStyle(icon).backgroundColor,
      borderRadius: getComputedStyle(icon).borderRadius,
      focused: document.activeElement === icon
    };
  });
  if (untouchedIconAfter.model !== untouchedIconBefore.model
    || untouchedIconAfter.background !== untouchedIconBefore.background
    || untouchedIconAfter.borderRadius !== untouchedIconBefore.borderRadius
    || untouchedIconAfter.borderRadius !== "50%"
    || !untouchedIconAfter.focused) {
    issues.push(`edit: closing the donation icon picker changed the untouched icon background (${JSON.stringify({ untouchedIconBefore, untouchedIconAfter })})`);
  }

  await page.locator('.donation-section-layer:not([hidden]) .donation-card-icon').first().click();
  await page.waitForSelector("#donationIconPickerModal:not([hidden])");
  await page.locator('[data-donation-theme-color="#9b4d60"]').click();
  const linkedColorResult = await page.evaluate(() => {
    const model = window.EditorModules.donation.getContent("donation");
    const card = model.cards[0];
    const cardElement = document.querySelector('.donation-section-layer:not([hidden]) .donation-card');
    const cta = document.querySelector('.donation-section-layer:not([hidden]) .donation-cta-input');
    return {
      backgroundColor: card.backgroundColor,
      accentColor: card.accentColor,
      ctaBackgroundColor: model.ctaBackgroundColor,
      renderedCardBackground: getComputedStyle(cardElement).backgroundColor,
      renderedCtaBackground: getComputedStyle(cta).backgroundColor,
      renderedCtaColor: getComputedStyle(cta).color,
      storedCtaColors: Object.values(model.textStyles).map((styles) => styles.cta.color),
      iconFocused: document.activeElement?.matches('[data-donation-icon-key]')
    };
  });
  if (linkedColorResult.accentColor !== "#9b4d60"
    || linkedColorResult.ctaBackgroundColor !== "#9b4d60"
    || !linkedColorResult.backgroundColor
    || linkedColorResult.renderedCardBackground === "rgba(0, 0, 0, 0)"
    || linkedColorResult.renderedCtaBackground !== "rgb(155, 77, 96)"
    || linkedColorResult.renderedCtaColor !== "rgb(255, 255, 255)"
    || linkedColorResult.storedCtaColors.some((color) => color !== "#ffffff")
    || !linkedColorResult.iconFocused) {
    issues.push(`edit: linked donation color did not update card, icon, CTA, and icon focus (${JSON.stringify(linkedColorResult)})`);
  }
  await page.locator("#donationBackgroundColor").evaluate((input) => {
    input.value = "#f1f5f9";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.locator("#donationAccentColor").evaluate((input) => {
    input.value = "#315f75";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.locator('[data-donation-icon-key="bank"]').click();
  await page.waitForSelector("#donationIconPickerModal", { state: "hidden" });
  await page.locator('.donation-section-layer:not([hidden]) [data-donation-field="cta"]').click();
  await page.locator("#inlineCtaBackgroundInput").evaluate((input) => {
    input.value = "#7c3aed";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const customCtaResult = await page.evaluate(() => ({
    stored: window.EditorModules.donation.getContent("donation").ctaBackgroundColor,
    background: getComputedStyle(document.querySelector('.donation-section-layer:not([hidden]) .donation-cta-input')).backgroundColor
  }));
  await page.locator("#inlineCtaBackgroundResetBtn").click();
  const editResult = await page.evaluate(async () => {
    const layer = document.querySelector(".donation-section-layer:not([hidden])");
    const beforeCount = layer.querySelectorAll(".donation-card").length;
    const beforeIds = [...layer.querySelectorAll(".donation-card")].map((card) => card.dataset.donationCardId);
    const perCardAddCount = layer.querySelectorAll('[data-donation-action="add-card-after"]').length;
    const globalAddVisible = Boolean(layer.querySelector('[data-donation-action="add-card"]'));
    layer.querySelector('.donation-card:first-child [data-donation-action="add-card-after"]').click();
    await new Promise((resolveWait) => setTimeout(resolveWait, 450));
    const afterAddLayer = document.querySelector(".donation-section-layer:not([hidden])");
    const afterAddCount = afterAddLayer.querySelectorAll(".donation-card").length;
    const afterIds = [...afterAddLayer.querySelectorAll(".donation-card")].map((card) => card.dataset.donationCardId);
    const insertedId = afterIds[1];
    const cardRects = [...afterAddLayer.querySelectorAll(".donation-card")].map((card) => card.getBoundingClientRect());
    const addRows = [];
    cardRects.forEach((rect) => {
      let row = addRows.find((entry) => Math.abs(entry.top - rect.top) < 3);
      if (!row) { row = { top: rect.top, count: 0 }; addRows.push(row); }
      row.count += 1;
    });
    afterAddLayer.querySelector(`[data-donation-card-id="${CSS.escape(insertedId)}"] [data-donation-action="delete-card"]`).click();
    await new Promise((resolveWait) => setTimeout(resolveWait, 450));
    const finalLayer = document.querySelector(".donation-section-layer:not([hidden])");
    const copiedId = window.EditorModules.sectionManager.addDonationAt("bottom", window.EditorModules.sectionManager.getOrder().length);
    const copiedCards = window.EditorModules.donation.getContent(copiedId).cards.length;
    window.EditorModules.sectionManager.deleteById(copiedId);
    return {
      beforeCount,
      afterAddCount,
      perCardAddCount,
      globalAddVisible,
      insertedAfterFirst: afterIds[0] === beforeIds[0] && afterIds[2] === beforeIds[1],
      finalCount: finalLayer.querySelectorAll(".donation-card").length,
      copiedCards,
      copiedDeleted: !window.EditorModules.sectionManager.getOrder().includes(copiedId),
      documentTypes: window.EditorModules.storage.createSectionDocument().sections.map((section) => section.type),
      addRowSizes: addRows.map((row) => row.count),
      icon: window.EditorModules.donation.getContent("donation").cards[0].icon,
      backgroundColor: window.EditorModules.donation.getContent("donation").cards[0].backgroundColor,
      accentColor: window.EditorModules.donation.getContent("donation").cards[0].accentColor,
      ctaBackgroundColor: window.EditorModules.donation.getContent("donation").ctaBackgroundColor,
      arrowCount: finalLayer.querySelectorAll(".donation-card-arrow").length,
      descriptionFitsContent: finalLayer.querySelector(".donation-description-input").getBoundingClientRect().width
        < finalLayer.querySelector(".donation-section-head").getBoundingClientRect().width - 40,
      titleFitsContent: finalLayer.querySelector(".donation-card-title").getBoundingClientRect().width
        < finalLayer.querySelector(".donation-card").getBoundingClientRect().width - 40,
      ctaBackground: getComputedStyle(finalLayer.querySelector(".donation-cta-input")).backgroundColor,
      ctaColor: getComputedStyle(finalLayer.querySelector(".donation-cta-input")).color
    };
  });
  editResult.toolbarLabel = toolbarLabel;
  editResult.customCtaResult = customCtaResult;
  console.log("edit", JSON.stringify(editResult));
  if (editResult.afterAddCount !== editResult.beforeCount + 1 || editResult.finalCount !== editResult.beforeCount) issues.push("edit: adding or deleting a donation card failed");
  if (editResult.perCardAddCount !== editResult.beforeCount || editResult.globalAddVisible || !editResult.insertedAfterFirst) issues.push("edit: per-card donation insertion controls are not aligned with the preview layout");
  if (editResult.copiedCards !== 4 || !editResult.copiedDeleted) issues.push("edit: duplicating or deleting a donation section failed");
  if (!editResult.documentTypes.includes("donation")) issues.push("edit: donation section is missing from saved document");
  if (!editResult.toolbarLabel?.includes("후원 안내 제목")) issues.push("edit: donation field is not connected to the inline toolbar");
  if (JSON.stringify(editResult.addRowSizes) !== JSON.stringify([5])) issues.push("edit: five donation methods did not fill one desktop row");
  if (editResult.icon !== "bank") issues.push("edit: icon picker did not update the donation icon");
  if (editResult.backgroundColor !== "#f1f5f9" || editResult.accentColor !== "#315f75") issues.push("edit: donation colors were not stored");
  if (editResult.customCtaResult.stored !== "#7c3aed" || editResult.customCtaResult.background !== "rgb(124, 58, 237)") issues.push("edit: donation CTA custom emphasis color was not applied");
  if (editResult.ctaBackgroundColor !== null) issues.push("edit: donation CTA did not return to the overall style");
  if (editResult.arrowCount !== 0) issues.push("edit: obsolete donation arrows are still rendered");
  if (!editResult.descriptionFitsContent || !editResult.titleFitsContent) issues.push("edit: donation text boxes do not fit their content");
  if (editResult.ctaBackground === "rgba(0, 0, 0, 0)" || editResult.ctaBackground === "rgb(255, 255, 255)" || editResult.ctaColor === editResult.ctaBackground) issues.push("edit: donation CTA contrast is invalid");

  await page.locator('.donation-section-layer:not([hidden]) .donation-card-icon').first().click();
  await page.waitForSelector("#donationIconPickerModal:not([hidden])");
  await page.locator("#donationColorResetBtn").click();
  const resetCardResult = await page.evaluate(() => {
    const card = window.EditorModules.donation.getContent("donation").cards[0];
    return { backgroundColor: card.backgroundColor, accentColor: card.accentColor };
  });
  console.log("card reset", JSON.stringify(resetCardResult));
  if (resetCardResult.backgroundColor !== null || resetCardResult.accentColor !== null) issues.push("edit: donation card did not return to the overall style");
  await page.locator("#donationIconPickerCloseBtn").click();
  const overallStyleResult = await page.evaluate(() => {
    setThemeCustomColor("#336699", { record: false });
    const model = window.EditorModules.donation.getContent("donation");
    const layer = document.querySelector(".donation-section-layer:not([hidden])");
    const cardElements = [...layer.querySelectorAll(".donation-card")];
    return {
      modelColors: model.cards.map((card) => ({ background: card.backgroundColor, accent: card.accentColor })),
      sectionBackground: layer.style.getPropertyValue("--donation-bg"),
      sectionAccent: layer.style.getPropertyValue("--donation-accent"),
      cardBackgrounds: cardElements.map((card) => card.style.getPropertyValue("--donation-card-bg")),
      cardAccents: cardElements.map((card) => card.style.getPropertyValue("--donation-card-accent")),
      themePaper: state.theme.paper,
      themeStrong: state.theme.strong
    };
  });
  const defaultCardIndexes = overallStyleResult.modelColors
    .map((colors, index) => colors.background === null && colors.accent === null ? index : -1)
    .filter((index) => index >= 0);
  if (overallStyleResult.sectionBackground !== overallStyleResult.themePaper
    || overallStyleResult.sectionAccent !== overallStyleResult.themeStrong
    || defaultCardIndexes.some((index) => overallStyleResult.cardBackgrounds[index] !== overallStyleResult.themePaper
      || overallStyleResult.cardAccents[index] !== overallStyleResult.themeStrong)) {
    issues.push(`edit: donation cards using the overall style did not follow the changed theme (${JSON.stringify(overallStyleResult)})`);
  }

  await page.evaluate(() => setViewport("phone"));
  await page.waitForTimeout(700);
  await page.locator('.donation-section-layer:not([hidden]) .donation-card-icon').first().click();
  await page.waitForSelector("#donationIconPickerModal:not([hidden])");
  const mobilePickerResult = await page.evaluate(() => {
    const stageRect = document.getElementById("stage").getBoundingClientRect();
    const modalRect = document.getElementById("donationIconPickerModal").getBoundingClientRect();
    return {
      insideStage: modalRect.left >= stageRect.left - 2
        && modalRect.right <= stageRect.right + 2
        && modalRect.top >= stageRect.top - 2
        && modalRect.bottom <= Math.min(stageRect.bottom, window.innerHeight) + 2,
      colorControlsVisible: Boolean(
        document.getElementById("donationBackgroundColor").offsetWidth
        && document.getElementById("donationAccentColor").offsetWidth
      )
    };
  });
  console.log("mobile picker", JSON.stringify(mobilePickerResult));
  if (!mobilePickerResult.insideStage || !mobilePickerResult.colorControlsVisible) issues.push("phone: donation icon and color picker exceeds the editable screen");
  await page.locator("#donationIconPickerCloseBtn").click();
  await page.locator('.donation-section-layer:not([hidden]) .donation-heart-mark').click();
  await page.waitForSelector("#decorationPickerModal:not([hidden])");
  const mobileDecorationPickerResult = await page.evaluate(() => {
    const stageRect = document.getElementById("stage").getBoundingClientRect();
    const modalRect = document.getElementById("decorationPickerModal").getBoundingClientRect();
    return {
      insideStage: modalRect.left >= stageRect.left - 2
        && modalRect.right <= stageRect.right + 2
        && modalRect.top >= stageRect.top - 2
        && modalRect.bottom <= Math.min(stageRect.bottom, window.innerHeight) + 2,
      icons: document.querySelectorAll("#decorationIconGrid [data-decoration-icon-key]").length,
      styles: document.querySelectorAll("#decorationStyleGrid [data-decoration-style-key]").length
    };
  });
  console.log("mobile decoration picker", JSON.stringify(mobileDecorationPickerResult));
  if (!mobileDecorationPickerResult.insideStage || mobileDecorationPickerResult.icons < 20 || mobileDecorationPickerResult.styles < 10) issues.push("phone: decoration picker exceeds the editable screen or lacks choices");
  await page.locator("#decorationPickerCloseBtn").click();
  await page.close();
} finally {
  await browser.close();
}

if (issues.length) {
  console.error(issues.join("\n"));
  process.exitCode = 1;
} else {
  console.log("donation browser tests OK");
}
