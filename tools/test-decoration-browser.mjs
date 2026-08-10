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
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

try {
  await page.goto(`${editorUrl}?viewport=desktop&mode=edit&previewSection=donation`, { waitUntil: "commit" });
  await page.waitForSelector('.donation-section-layer:not([hidden]) .donation-heart-mark', { timeout: 60000 });
  await page.locator('.donation-section-layer:not([hidden]) .donation-heart-mark').click();
  await page.waitForSelector("#decorationPickerModal:not([hidden])", { timeout: 30000 });
  const counts = await page.evaluate(() => ({
    icons: document.querySelectorAll("#decorationIconGrid [data-decoration-icon-key]").length,
    stickers: document.querySelectorAll("#decorationStickerGrid [data-decoration-icon-key]").length,
    natureStickers: document.querySelectorAll('#decorationStickerGrid [data-sticker-category="nature"]').length,
    earthStickers: document.querySelectorAll('#decorationStickerGrid [data-sticker-category="earth"]').length,
    dailyStickers: document.querySelectorAll('#decorationStickerGrid [data-sticker-category="daily"]').length,
    stickerCategories: document.querySelectorAll("#decorationStickerCategories [data-decoration-sticker-category]").length,
    styles: document.querySelectorAll("#decorationStyleGrid [data-decoration-style-key]").length
  }));
  if (counts.stickers < 20) throw new Error(`sticker choices are insufficient ${JSON.stringify(counts)}`);
  if (counts.natureStickers !== 30 || counts.earthStickers !== 0 || counts.dailyStickers !== 0 || counts.stickerCategories < 7) throw new Error(`sticker category paging failed ${JSON.stringify(counts)}`);
  if (counts.icons < 20 || counts.styles < 10) throw new Error(`insufficient choices ${JSON.stringify(counts)}`);

  const resizeHandle = page.locator("#decorationPickerResizeHandle");
  const resizeBox = await resizeHandle.boundingBox();
  const dialogBeforeResize = await page.locator("#decorationPickerModal .decoration-picker-dialog").boundingBox();
  if (!resizeBox || !dialogBeforeResize) throw new Error("desktop decoration resize handle missing");
  await page.mouse.move(resizeBox.x + resizeBox.width / 2, resizeBox.y + resizeBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(resizeBox.x + resizeBox.width / 2 + 120, resizeBox.y + resizeBox.height / 2 + 90, { steps: 8 });
  await page.mouse.up();
  const dialogAfterResize = await page.locator("#decorationPickerModal .decoration-picker-dialog").boundingBox();
  if (!dialogAfterResize || dialogAfterResize.width < dialogBeforeResize.width + 80 || dialogAfterResize.height < dialogBeforeResize.height + 60) {
    throw new Error(`desktop decoration resize failed ${JSON.stringify({ dialogBeforeResize, dialogAfterResize })}`);
  }

  const desktopHeader = await page.evaluate(() => {
    const head = document.getElementById("decorationPickerHead");
    const title = document.getElementById("decorationPickerTitle");
    const settings = head.querySelector(".decoration-header-settings");
    const color = head.querySelector(".decoration-color-setting");
    const size = head.querySelector(".decoration-size-setting");
    const close = document.getElementById("decorationPickerCloseBtn");
    const centers = [color, size, close].map((element) => {
      const rect = element.getBoundingClientRect();
      return rect.top + rect.height / 2;
    });
    return {
      settingsInHeader: settings?.parentElement === head,
      titleHidden: title.getBoundingClientRect().width <= 1,
      colorLabelVisible: color.textContent.includes("색상"),
      oneRow: Math.max(...centers) - Math.min(...centers) <= 2,
      noOverflow: head.scrollWidth <= head.clientWidth + 2,
      compactScrollableGrids: ["decorationIconGrid", "decorationStyleGrid"].every((id) => {
        const grid = document.getElementById(id);
        const style = getComputedStyle(grid);
        return style.display === "grid" && style.overflowY === "auto" && style.overflowX === "hidden";
      })
    };
  });
  if (!desktopHeader.settingsInHeader || !desktopHeader.titleHidden || !desktopHeader.colorLabelVisible
    || !desktopHeader.oneRow || !desktopHeader.noOverflow || !desktopHeader.compactScrollableGrids) {
    throw new Error(`desktop decoration header layout failed ${JSON.stringify(desktopHeader)}`);
  }

  await page.locator('[data-decoration-carousel-target="decorationIconGrid"]').click();
  await page.locator('[data-decoration-carousel-target="decorationStyleGrid"]').click();
  await page.waitForTimeout(400);
  const carouselMotion = await page.evaluate(() => ({
    icon: document.getElementById("decorationIconGrid").scrollTop,
    style: document.getElementById("decorationStyleGrid").scrollTop
  }));
  if (carouselMotion.icon <= 0 || carouselMotion.style < 0) throw new Error(`carousel more failed ${JSON.stringify(carouselMotion)}`);

  await page.locator('[data-decoration-icon-key="sprout"]').click();
  await page.locator('[data-decoration-style-key="double-ring"]').click();
  const applied = await page.evaluate(() => ({
    decoration: window.EditorModules.donation.getContent("donation").decorations[0],
    className: document.querySelector('.donation-section-layer:not([hidden]) .donation-heart-mark')?.className
  }));
  if (applied.decoration.icon !== "sprout" || applied.decoration.style !== "double-ring") throw new Error(`apply failed ${JSON.stringify(applied)}`);
  await page.locator('[data-decoration-sticker-category="nature"]').click();
  await page.locator('[data-decoration-icon-key="sticker-nature-friend-leaf"]').click();
  const stickerApplied = await page.evaluate(() => window.EditorModules.donation.getContent("donation").decorations[0].icon);
  if (stickerApplied !== "sticker-nature-friend-leaf") throw new Error(`sticker apply failed ${stickerApplied}`);
  await page.locator('[data-decoration-sticker-category="earth"]').click();
  await page.locator('[data-decoration-icon-key="sticker-earth-outline-globe"]').click();
  const earthStickerApplied = await page.evaluate(() => window.EditorModules.donation.getContent("donation").decorations[0].icon);
  if (earthStickerApplied !== "sticker-earth-outline-globe") throw new Error(`earth sticker apply failed ${earthStickerApplied}`);
  await page.locator('[data-decoration-sticker-category="daily"]').click();
  await page.locator('[data-decoration-icon-key="sticker-daily-color-plane-flight"]').click();
  const dailyStickerApplied = await page.evaluate(() => window.EditorModules.donation.getContent("donation").decorations[0].icon);
  if (dailyStickerApplied !== "sticker-daily-color-plane-flight") throw new Error(`daily sticker apply failed ${dailyStickerApplied}`);
  await page.locator('[data-decoration-sticker-category="neon"]').click();
  await page.locator('[data-decoration-icon-key="sticker-imported-17-01"]').click();
  const importedStickerApplied = await page.evaluate(() => window.EditorModules.donation.getContent("donation").decorations[0].icon);
  if (importedStickerApplied !== "sticker-imported-17-01") throw new Error(`imported sticker apply failed ${importedStickerApplied}`);

  await page.locator("#decorationColorInput").evaluate((input) => {
    input.value = "#2563eb";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.locator("#decorationApplySectionStyleBtn").click();
  const linkedStyle = await page.evaluate(() => {
    const items = window.EditorModules.donation.getContent("donation").decorations;
    return items.every((item) => item.color === items[0].color && item.style === items[0].style);
  });
  if (!linkedStyle) throw new Error("section decoration style linking failed");
  await page.locator("#decorationSizeRange").evaluate((input) => {
    input.value = "155";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.waitForTimeout(120);
  const editorVisibility = await page.evaluate(() => {
    const decorationRect = document.querySelector('.donation-section-layer:not([hidden]) .donation-heart-mark').getBoundingClientRect();
    const dialogRect = document.querySelector("#decorationPickerModal .decoration-picker-dialog").getBoundingClientRect();
    const overlap = decorationRect.left < dialogRect.right
      && decorationRect.right > dialogRect.left
      && decorationRect.top < dialogRect.bottom
      && decorationRect.bottom > dialogRect.top;
    return {
      overlap,
      modalBackground: getComputedStyle(document.getElementById("decorationPickerModal")).backgroundColor,
      pointerEvents: getComputedStyle(document.getElementById("decorationPickerModal")).pointerEvents
    };
  });
  if (editorVisibility.overlap || editorVisibility.pointerEvents !== "none") throw new Error(`editor still covers decoration ${JSON.stringify(editorVisibility)}`);
  await page.locator("#decorationPickerCloseBtn").click();
  const decorationButton = page.locator('.donation-section-layer:not([hidden]) .donation-heart-mark').first();
  const box = await decorationButton.boundingBox();
  if (!box) throw new Error("decoration bounding box missing");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 45, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  const adjusted = await page.evaluate(() => {
    const item = window.EditorModules.donation.getContent("donation").decorations[0];
    return { color: item.color, size: item.sizes.desktop, layout: item.layouts.desktop };
  });
  if (adjusted.color !== "#2563eb" || adjusted.size !== 155 || adjusted.layout.x <= 50 || adjusted.layout.y <= 90) throw new Error(`size, color, or drag failed ${JSON.stringify(adjusted)}`);

  await decorationButton.click();
  await page.waitForSelector("#decorationPickerModal:not([hidden])");

  await page.locator("#decorationRemoveBtn").click();
  const removed = await page.evaluate(() => ({
    decorationCount: window.EditorModules.donation.getContent("donation").decorations.length,
    decorationVisible: Boolean(document.querySelector('.donation-section-layer:not([hidden]) .donation-heart-mark'))
  }));
  if (removed.decorationCount !== 0 || removed.decorationVisible) throw new Error(`remove failed ${JSON.stringify(removed)}`);

  await page.locator('.donation-section-layer:not([hidden]) .donation-decoration-add').click();
  await page.waitForSelector("#decorationPickerModal:not([hidden])");
  const defaultStyle = await page.evaluate(() => window.EditorModules.donation.getContent("donation").decorations.at(-1)?.style);
  if (defaultStyle !== "plain") throw new Error(`new decoration default style is not transparent: ${defaultStyle}`);
  await page.locator('[data-decoration-icon-key="heart"]').click();
  await page.locator('[data-decoration-style-key="soft-circle"]').click();
  await page.locator("#decorationAddBtn").click();
  const addedCount = await page.evaluate(() => window.EditorModules.donation.getContent("donation").decorations.length);
  if (addedCount !== 1) throw new Error(`add failed: ${addedCount}`);

  const appearanceControl = page.locator('.section-appearance-control[data-section-id="donation"]');
  await appearanceControl.locator('[data-section-appearance-action="toggle"]').click();
  await appearanceControl.locator('[data-section-appearance-action="preset"][data-preset="sky"]').click();
  const sectionAppearance = await page.evaluate(() => {
    const layer = document.querySelector('.donation-section-layer:not([hidden])');
    const surface = document.querySelector('.section-theme-surface[data-section-id="donation"]');
    return {
      hasSurface: Boolean(surface),
      background: surface?.style.getPropertyValue("--section-theme-background"),
      accent: layer?.style.getPropertyValue("--accent"),
      themed: layer?.dataset.sectionCustomTheme
    };
  });
  if (!sectionAppearance.hasSurface || sectionAppearance.background !== "#eef7fb" || sectionAppearance.accent !== "#2f6f91" || sectionAppearance.themed !== "true") {
    throw new Error(`section appearance preset failed ${JSON.stringify(sectionAppearance)}`);
  }
  await appearanceControl.locator('[data-section-appearance-action="add-decoration"]').click();
  await page.waitForSelector("#decorationPickerModal:not([hidden])");
  const pageDecorationPlacement = await page.evaluate(() => {
    const decoration = document.querySelector('.page-decoration-layer .donation-heart-mark');
    const section = document.querySelector('.donation-section-layer:not([hidden])');
    const decorationRect = decoration?.getBoundingClientRect();
    const sectionRect = section?.getBoundingClientRect();
    return {
      exists: Boolean(decoration),
      frontLayer: getComputedStyle(document.getElementById("pageDecorationLayer")).zIndex,
      insideSection: Boolean(decorationRect && sectionRect && decorationRect.top < sectionRect.bottom && decorationRect.bottom > sectionRect.top)
    };
  });
  if (!pageDecorationPlacement.exists || pageDecorationPlacement.frontLayer !== "100" || !pageDecorationPlacement.insideSection) {
    throw new Error(`page decoration section placement failed ${JSON.stringify(pageDecorationPlacement)}`);
  }
  await page.locator("#decorationPickerCloseBtn").click();
  await page.locator("#saveBtn").click();
  await page.waitForTimeout(700);
  const savedAppearance = await page.evaluate(() => JSON.parse(localStorage.getItem("sacwcWebsiteEditor") || "{}").content?.sectionAppearances?.donation);
  if (savedAppearance?.background !== "#eef7fb" || savedAppearance?.accent !== "#2f6f91") throw new Error(`section appearance persistence failed ${JSON.stringify(savedAppearance)}`);

  await page.evaluate(() => setViewport("phone"));
  await page.waitForTimeout(500);
  await page.locator('.donation-section-layer:not([hidden]) .donation-heart-mark').first().click();
  await page.waitForSelector("#decorationPickerModal:not([hidden])");
  const mobile = await page.evaluate(() => {
    const stageRect = document.getElementById("stage").getBoundingClientRect();
    const modalRect = document.getElementById("decorationPickerModal").getBoundingClientRect();
    const dialogRect = document.querySelector("#decorationPickerModal .decoration-picker-dialog").getBoundingClientRect();
    const header = document.getElementById("decorationPickerHead");
    const headerSettings = header.querySelector(".decoration-header-settings");
    const color = header.querySelector(".decoration-color-setting");
    const size = header.querySelector(".decoration-size-setting");
    const grip = header.querySelector(".decoration-picker-grip");
    const close = document.getElementById("decorationPickerCloseBtn");
    const controlCenters = [color, size, grip, close].map((element) => {
      const rect = element.getBoundingClientRect();
      return rect.top + rect.height / 2;
    });
    const first = window.EditorModules.donation.getContent("donation").decorations[0];
    const firstElement = document.querySelector('.donation-section-layer:not([hidden]) .donation-heart-mark');
    const decorationElements = [...document.querySelectorAll('.donation-section-layer:not([hidden]) .donation-heart-mark')];
    const editedDecorationRect = decorationElements.at(-1)?.getBoundingClientRect();
    const overlapsEditedDecoration = editedDecorationRect
      ? editedDecorationRect.left < dialogRect.right
        && editedDecorationRect.right > dialogRect.left
        && editedDecorationRect.top < dialogRect.bottom
        && editedDecorationRect.bottom > dialogRect.top
      : true;
    const iconGrid = document.getElementById("decorationIconGrid");
    const styleGrid = document.getElementById("decorationStyleGrid");
    const firstIcon = iconGrid.querySelector("button");
    const iconRect = iconGrid.getBoundingClientRect();
    const styleRect = styleGrid.getBoundingClientRect();
    return {
      insideStage: modalRect.left >= stageRect.left - 2
        && modalRect.right <= stageRect.right + 2
        && modalRect.top >= stageRect.top - 2
        && modalRect.bottom <= Math.min(stageRect.bottom, window.innerHeight) + 2,
      noDocumentOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2,
      noHeaderOverflow: header.scrollWidth <= header.clientWidth + 2
        && headerSettings.scrollWidth <= headerSettings.clientWidth + 2,
      headerWidth: [header.clientWidth, header.scrollWidth],
      settingsWidth: [headerSettings.clientWidth, headerSettings.scrollWidth],
      controlsOneRow: Math.max(...controlCenters) - Math.min(...controlCenters) <= 2,
      compactDialog: dialogRect.height <= 390,
      editedDecorationVisible: !overlapsEditedDecoration,
      mobileCarouselColumns: firstIcon ? Math.round(iconGrid.clientWidth / firstIcon.getBoundingClientRect().width) : 0,
      bothCarouselsVisible: iconRect.top >= dialogRect.top && iconRect.bottom <= dialogRect.bottom + 2
        && styleRect.top >= dialogRect.top && styleRect.bottom <= dialogRect.bottom + 2,
      carouselRects: {
        dialog: { top: dialogRect.top, bottom: dialogRect.bottom },
        icon: { top: iconRect.top, bottom: iconRect.bottom },
        style: { top: styleRect.top, bottom: styleRect.bottom }
      },
      moveButtonVisible: grip.getBoundingClientRect().width >= 30,
      storedPhoneSize: first.sizes.phone,
      renderedSize: Math.round(firstElement.getBoundingClientRect().height / Math.max(window.EditorModules.state?.scale || 1, .1))
    };
  });
  if (!mobile.insideStage || !mobile.noDocumentOverflow || !mobile.noHeaderOverflow || !mobile.controlsOneRow
    || !mobile.compactDialog || !mobile.editedDecorationVisible || mobile.mobileCarouselColumns < 5
    || !mobile.bothCarouselsVisible || !mobile.moveButtonVisible
    || mobile.storedPhoneSize !== 50) throw new Error(`mobile overflow or layout separation failed ${JSON.stringify(mobile)}`);

  const moveGrip = page.locator("#decorationPickerHead .decoration-picker-grip");
  const gripBox = await moveGrip.boundingBox();
  const modalBeforeMove = await page.locator("#decorationPickerModal").boundingBox();
  if (!gripBox || !modalBeforeMove) throw new Error("mobile decoration move handle missing");
  const moveDelta = modalBeforeMove.y + modalBeforeMove.height + 70 < 950 ? 60 : -60;
  await page.mouse.move(gripBox.x + gripBox.width / 2, gripBox.y + gripBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(gripBox.x + gripBox.width / 2, gripBox.y + gripBox.height / 2 + moveDelta, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(120);
  const modalAfterMove = await page.locator("#decorationPickerModal").boundingBox();
  const mobileMove = {
    deltaX: modalAfterMove ? Math.round(modalAfterMove.x - modalBeforeMove.x) : 999,
    deltaY: modalAfterMove ? Math.round(modalAfterMove.y - modalBeforeMove.y) : 0
  };
  if (Math.abs(mobileMove.deltaX) > 2 || Math.abs(mobileMove.deltaY) < 30) throw new Error(`mobile vertical move failed ${JSON.stringify(mobileMove)}`);
  await page.locator("#decorationPickerCloseBtn").click();
  const responsiveAppearance = [];
  for (const viewport of ["tablet", "phoneSmall"]) {
    await page.evaluate((nextViewport) => setViewport(nextViewport), viewport);
    await page.waitForTimeout(420);
    const result = await page.evaluate((nextViewport) => {
      const stageRect = document.getElementById("stage").getBoundingClientRect();
      const trigger = document.querySelector('.section-appearance-control[data-section-id="donation"] .section-appearance-trigger');
      const triggerRect = trigger?.getBoundingClientRect();
      const decoration = document.querySelector('.page-decoration-layer .donation-heart-mark');
      return {
        viewport: nextViewport,
        triggerVisible: Boolean(triggerRect && triggerRect.width > 0 && triggerRect.left >= stageRect.left - 2 && triggerRect.right <= stageRect.right + 2),
        surfaceVisible: Boolean(document.querySelector('.section-theme-surface[data-section-id="donation"]')),
        decorationVisible: Boolean(decoration && decoration.getBoundingClientRect().width > 0),
        noOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2
      };
    }, viewport);
    if (!result.triggerVisible || !result.surfaceVisible || !result.decorationVisible || !result.noOverflow) {
      throw new Error(`responsive section appearance failed ${JSON.stringify(result)}`);
    }
    responsiveAppearance.push(result);
  }
  if (errors.length) throw new Error(`page errors: ${errors.join(" | ")}`);
  console.log("decoration browser", JSON.stringify({ counts, dialogBeforeResize, dialogAfterResize, desktopHeader, carouselMotion, applied, editorVisibility, adjusted, removed, defaultStyle, mobile, mobileMove, responsiveAppearance }));
  console.log("decoration browser tests OK");
} finally {
  await browser.close();
}
