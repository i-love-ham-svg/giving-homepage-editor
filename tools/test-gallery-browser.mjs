import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const editorUrl = process.env.EDITOR_URL
  ?? pathToFileURL(resolve("outputs", "representative-greeting-editor.html")).href;
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
  await page.goto(`${editorUrl}?viewport=desktop&mode=edit&previewSection=gallery`, { waitUntil: "commit" });
  await page.waitForSelector(".gallery-section-layer:not([hidden]) .gallery-section-content");
  await page.waitForFunction(() => window.EditorModules?.gallery && window.EditorModules?.sectionManager);

  const menuResult = await page.evaluate(async () => {
    const button = [...document.querySelectorAll(".homepage-menu-link")]
      .find((item) => item.textContent.includes("갤러리"));
    button?.click();
    await new Promise((resolveWait) => requestAnimationFrame(() => requestAnimationFrame(resolveWait)));
    return {
      found: Boolean(button),
      linked: getActiveHomeMenuLinkedSectionIds(),
      visible: getVisibleSectionIds().filter(isSectionVisibleInCurrentView)
    };
  });
  if (!menuResult.found || !menuResult.linked.includes("gallery") || !menuResult.visible.includes("gallery")) {
    issues.push("gallery home-menu button is missing or not linked");
  }

  const themeIntegrationResult = await page.evaluate(async () => {
    const content = document.querySelector(".gallery-section-content");
    const activeCategory = document.querySelector(".gallery-category.active");
    const media = document.querySelector(".gallery-item-media");
    const item = document.querySelector(".gallery-item");
    const date = document.querySelector(".gallery-item-date");
    const tag = document.querySelector(".gallery-item-tag");
    const read = () => ({
      accent: getComputedStyle(document.documentElement).getPropertyValue("--accent-strong").trim(),
      category: getComputedStyle(activeCategory).backgroundColor,
      media: getComputedStyle(media).backgroundColor,
      surface: getComputedStyle(content).backgroundImage,
      itemSurface: getComputedStyle(item).backgroundColor,
      date: getComputedStyle(date).color,
      tag: getComputedStyle(tag).color
    });
    const warm = read();
    document.querySelector('[data-theme="blue"]')?.click();
    await new Promise((resolveWait) => requestAnimationFrame(() => requestAnimationFrame(resolveWait)));
    const blue = read();
    document.querySelector('[data-theme="warm"]')?.click();
    await new Promise((resolveWait) => requestAnimationFrame(() => requestAnimationFrame(resolveWait)));
    return { warm, blue };
  });
  if (themeIntegrationResult.warm.category === themeIntegrationResult.blue.category) {
    issues.push("gallery category color is not linked to the shared mood theme");
  }
  if (themeIntegrationResult.warm.media === themeIntegrationResult.blue.media) {
    issues.push("gallery photo background is not linked to the shared mood theme");
  }
  if (themeIntegrationResult.warm.surface === themeIntegrationResult.blue.surface) {
    issues.push("gallery surface is not linked to the shared mood theme");
  }
  if (themeIntegrationResult.warm.itemSurface === themeIntegrationResult.blue.itemSurface) {
    issues.push("gallery card background is not linked to the shared mood theme");
  }
  if (themeIntegrationResult.warm.date === themeIntegrationResult.blue.date
    || themeIntegrationResult.warm.tag === themeIntegrationResult.blue.tag) {
    issues.push("gallery card text colors are not linked to the shared mood theme");
  }

  const desktopStyles = await page.evaluate(() => {
    const select = document.querySelector('[data-gallery-setting="desktopStyle"]');
    return [...select.options].map((option) => option.value);
  });
  const mobileStyles = await page.evaluate(() => {
    const select = document.querySelector('[data-gallery-setting="mobileStyle"]');
    return [...select.options].map((option) => option.value);
  });
  if (desktopStyles.length !== 7) issues.push("desktop gallery styles are not seven choices");
  if (mobileStyles.length !== 5) issues.push("mobile gallery styles are not five choices");

  const expectedFeaturedCounts = {
    mosaic: 6,
    panorama: 4,
    collage: 3,
    focus: 1,
    "tape-pink": 5,
    "tape-nature": 5,
    "tape-yellow": 5
  };
  const desktopLayoutResults = {};
  for (const style of desktopStyles) {
    await page.selectOption('[data-gallery-setting="desktopStyle"]', style);
    await page.evaluate(() => new Promise((resolveWait) => requestAnimationFrame(() => requestAnimationFrame(resolveWait))));
    const applied = await page.getAttribute(".gallery-section-content", "data-desktop-style");
    if (applied !== style) issues.push(`desktop style did not apply: ${style}`);
    const layout = await page.evaluate(() => {
      const collage = document.querySelector(".gallery-hero-collage");
      const collageRect = collage?.getBoundingClientRect();
      const tiles = [...(collage?.querySelectorAll(".gallery-hero-tile") ?? [])]
        .filter((tile) => getComputedStyle(tile).display !== "none");
      const rects = tiles.map((tile) => {
        const rect = tile.getBoundingClientRect();
        return {
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          radius: getComputedStyle(tile).borderRadius,
          overflows: Boolean(collageRect && (rect.left < collageRect.left - 10 || rect.right > collageRect.right + 10 || rect.top < collageRect.top - 10 || rect.bottom > collageRect.bottom + 10))
        };
      });
      let overlapPairs = 0;
      for (let first = 0; first < tiles.length; first += 1) {
        const a = tiles[first].getBoundingClientRect();
        for (let second = first + 1; second < tiles.length; second += 1) {
          const b = tiles[second].getBoundingClientRect();
          const overlapWidth = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
          const overlapHeight = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
          if (overlapWidth * overlapHeight > 80) overlapPairs += 1;
        }
      }
      const decorations = [...document.querySelectorAll(".gallery-hero-decoration")]
        .filter((item) => getComputedStyle(item).display !== "none");
      return {
        featuredCount: Number(collage?.dataset.featuredCount),
        visibleTiles: tiles.length,
        distinctSizes: new Set(rects.map((rect) => `${rect.width}x${rect.height}`)).size,
        roundedTiles: rects.filter((rect) => rect.radius !== "0px").length,
        organicTiles: rects.filter((rect) => rect.radius.includes("%")).length,
        overlapPairs,
        overflowingTiles: rects.filter((rect) => rect.overflows).length,
        decorations: decorations.length,
        visibleTapes: tiles.filter((tile) => {
          const tape = tile.querySelector(".gallery-photo-tape");
          return tape && getComputedStyle(tape).display !== "none";
        }).length
      };
    });
    desktopLayoutResults[style] = layout;
    const expected = expectedFeaturedCounts[style];
    if (layout.featuredCount !== expected || layout.visibleTiles !== expected) issues.push(`${style}: expected ${expected} featured photos`);
    if (layout.distinctSizes < Math.min(2, expected)) issues.push(`${style}: featured photo shapes are not distinct`);
    if (layout.roundedTiles !== expected) issues.push(`${style}: featured photo corners are not rounded`);
    if (!style.startsWith("tape-") && layout.organicTiles !== expected) issues.push(`${style}: featured photo shapes are not organic`);
    if (style.startsWith("tape-") && layout.visibleTapes !== 5) issues.push(`${style}: five photo tapes are not visible`);
    if (expected > 1 && layout.overlapPairs < 1) issues.push(`${style}: featured photos do not overlap`);
    if (layout.overflowingTiles) issues.push(`${style}: featured photos overflow the collage`);
    if (layout.decorations < 3) issues.push(`${style}: fewer than three natural decorations are visible`);
  }

  const heroFrameResult = await page.evaluate(async () => {
    setMode("edit");
    setViewport("desktop");
    const tile = document.querySelector('.gallery-hero-tile[data-gallery-image-frame]');
    const itemId = tile?.dataset.galleryItemId;
    if (itemId) selectGalleryImage("gallery", itemId, "hero");
    await new Promise((resolveWait) => requestAnimationFrame(() => requestAnimationFrame(resolveWait)));
    const model = EditorModules.gallery.getContent("gallery");
    const before = structuredClone(model.items.find((item) => item.id === itemId)?.heroLayouts?.desktop);
    const size = document.getElementById("inlinePhotoFrameSizeRange");
    const angle = document.getElementById("inlineAngleRange");
    if (size) {
      size.value = "135";
      size.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (angle) {
      angle.value = "14";
      angle.dispatchEvent(new Event("input", { bubbles: true }));
    }
    const after = structuredClone(EditorModules.gallery.getContent("gallery").items.find((item) => item.id === itemId)?.heroLayouts?.desktop);
    return {
      itemId,
      selected: tile?.classList.contains("is-image-selected") ?? false,
      moveHandle: Boolean(tile?.querySelector('[data-gallery-frame-control="move"]')),
      resizeHandles: tile?.querySelectorAll('[data-gallery-frame-control="resize"]').length ?? 0,
      sizeVisible: size ? !size.closest("label").hidden : false,
      angleVisible: angle ? !angle.closest("label").hidden : false,
      before,
      after,
      cssScale: tile ? getComputedStyle(tile).scale : "",
      cssRotate: tile ? getComputedStyle(tile).rotate : ""
    };
  });
  if (!heroFrameResult.selected || !heroFrameResult.moveHandle || heroFrameResult.resizeHandles !== 4) issues.push("gallery hero direct move or corner resize controls are missing");
  if (!heroFrameResult.sizeVisible || !heroFrameResult.angleVisible) issues.push("gallery hero size or angle toolbar control is hidden");
  if (heroFrameResult.after?.scale !== 1.35 || heroFrameResult.after?.rotation !== 14) issues.push("gallery hero size or angle did not persist");
  if (!heroFrameResult.cssScale.includes("1.35") || !heroFrameResult.cssRotate.includes("14deg")) issues.push("gallery hero size or angle did not render");

  const readHeroDesktopLayout = () => page.evaluate((itemId) => {
    const item = EditorModules.gallery.getContent("gallery").items.find((entry) => entry.id === itemId);
    return structuredClone(item?.heroLayouts?.desktop);
  }, heroFrameResult.itemId);
  const dragBefore = await readHeroDesktopLayout();
  const moveHandle = page.locator('.gallery-hero-tile.is-image-selected [data-gallery-frame-control="move"]').first();
  await moveHandle.scrollIntoViewIfNeeded();
  const moveBox = await moveHandle.boundingBox();
  if (moveBox) {
    await page.mouse.move(moveBox.x + moveBox.width / 2, moveBox.y + moveBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(moveBox.x + moveBox.width / 2 + 36, moveBox.y + moveBox.height / 2 + 24, { steps: 5 });
    await page.mouse.up();
  }
  const dragAfterMove = await readHeroDesktopLayout();
  const resizeHandle = page.locator('.gallery-hero-tile.is-image-selected .gallery-frame-resize-se').first();
  await resizeHandle.scrollIntoViewIfNeeded();
  const resizeBox = await resizeHandle.boundingBox();
  if (resizeBox) {
    await page.mouse.move(resizeBox.x + resizeBox.width / 2, resizeBox.y + resizeBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(resizeBox.x + resizeBox.width / 2 + 28, resizeBox.y + resizeBox.height / 2 + 28, { steps: 5 });
    await page.mouse.up();
  }
  const dragAfterResize = await readHeroDesktopLayout();
  const heroDragResult = {
    moveHandleFound: Boolean(moveBox),
    resizeHandleFound: Boolean(resizeBox),
    before: dragBefore,
    afterMove: dragAfterMove,
    afterResize: dragAfterResize
  };
  if (!heroDragResult.moveHandleFound || Math.abs((dragAfterMove?.x ?? 0) - (dragBefore?.x ?? 0)) < 2 || Math.abs((dragAfterMove?.y ?? 0) - (dragBefore?.y ?? 0)) < 2) {
    issues.push("gallery hero move handle did not update the photo frame position");
  }
  if (!heroDragResult.resizeHandleFound || Math.abs((dragAfterResize?.scale ?? 0) - (dragAfterMove?.scale ?? 0)) < .02) {
    issues.push("gallery hero corner resize did not update the photo frame size");
  }

  const heroViewportResult = await page.evaluate(async (itemId) => {
    setViewport("phone");
    await new Promise((resolveWait) => requestAnimationFrame(() => requestAnimationFrame(resolveWait)));
    selectGalleryImage("gallery", itemId, "hero");
    const size = document.getElementById("inlinePhotoFrameSizeRange");
    const angle = document.getElementById("inlineAngleRange");
    size.value = "82";
    size.dispatchEvent(new Event("input", { bubbles: true }));
    angle.value = "-9";
    angle.dispatchEvent(new Event("input", { bubbles: true }));
    const phone = structuredClone(EditorModules.gallery.getContent("gallery").items.find((item) => item.id === itemId)?.heroLayouts?.phone);
    setViewport("desktop");
    await new Promise((resolveWait) => requestAnimationFrame(() => requestAnimationFrame(resolveWait)));
    const desktop = structuredClone(EditorModules.gallery.getContent("gallery").items.find((item) => item.id === itemId)?.heroLayouts?.desktop);
    return { phone, desktop };
  }, heroFrameResult.itemId);
  if (heroViewportResult.phone?.scale !== .82 || heroViewportResult.phone?.rotation !== -9 || heroViewportResult.desktop?.scale === .82) {
    issues.push("gallery hero desktop and mobile frame layouts are not independent");
  }

  const heroLayerResult = await page.evaluate(async () => {
    setMode("edit");
    setViewport("desktop");
    const model = EditorModules.gallery.getContent("gallery");
    model.desktopStyle = "tape-pink";
    renderGallerySection("gallery");
    const visibleTiles = [...document.querySelectorAll('.gallery-hero-tile[data-gallery-image-frame]')]
      .filter((tile) => getComputedStyle(tile).display !== "none");
    const tile = visibleTiles[Math.min(2, visibleTiles.length - 1)];
    const itemId = tile?.dataset.galleryItemId;
    if (!itemId) return null;
    const item = model.items.find((entry) => entry.id === itemId);
    item.image = null;
    renderGallerySection("gallery");
    selectGalleryImage("gallery", itemId, "hero");
    await new Promise((resolveWait) => requestAnimationFrame(() => requestAnimationFrame(resolveWait)));
    const upload = document.getElementById("inlineUploadBtn");
    const remove = document.getElementById("inlinePhotoDeleteBtn");
    const controls = {
      uploadVisible: !upload.hidden,
      uploadLabel: upload.textContent.trim(),
      deleteVisible: !remove.hidden,
      deleteDisabled: remove.disabled
    };
    moveSelectedLayer("front");
    await new Promise((resolveWait) => requestAnimationFrame(() => requestAnimationFrame(resolveWait)));
    const frontModel = EditorModules.gallery.getContent("gallery");
    const frontTile = document.querySelector(`.gallery-hero-tile[data-gallery-item-id="${CSS.escape(itemId)}"]`);
    const front = {
      order: frontModel.heroOrder.indexOf(itemId),
      z: Number(getComputedStyle(frontTile).zIndex),
      selected: frontTile.classList.contains("is-image-selected")
    };
    selectGalleryImage("gallery", itemId, "hero");
    moveSelectedLayer("back");
    await new Promise((resolveWait) => requestAnimationFrame(() => requestAnimationFrame(resolveWait)));
    const backModel = EditorModules.gallery.getContent("gallery");
    const backTile = document.querySelector(`.gallery-hero-tile[data-gallery-item-id="${CSS.escape(itemId)}"]`);
    return {
      itemId,
      ...controls,
      front,
      back: {
        order: backModel.heroOrder.indexOf(itemId),
        z: Number(getComputedStyle(backTile).zIndex),
        selected: backTile.classList.contains("is-image-selected")
      }
    };
  });
  if (!heroLayerResult?.uploadVisible || heroLayerResult.uploadLabel !== "사진 추가") {
    issues.push("gallery hero photo add control is missing or mislabeled");
  }
  if (!heroLayerResult?.deleteVisible || !heroLayerResult.deleteDisabled) {
    issues.push("gallery hero photo delete control is not visible for an empty selected photo");
  }
  if (heroLayerResult?.front.order < 1 || heroLayerResult?.front.z < 2 || !heroLayerResult?.front.selected) {
    issues.push("gallery hero bring-to-front did not expose the actual layer result");
  }
  if (heroLayerResult?.back.order !== 0 || heroLayerResult?.back.z !== 1 || !heroLayerResult?.back.selected) {
    issues.push("gallery hero send-to-back did not expose the actual back layer result");
  }

  const sharedToolResult = await page.evaluate(async () => {
    setMode("edit");
    setViewport("desktop");
    const headline = document.querySelector('[data-gallery-field="headline"]');
    headline.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
    await new Promise((resolveWait) => requestAnimationFrame(() => requestAnimationFrame(resolveWait)));
    const toolbar = document.getElementById("inlineToolbar");
    const toolbarVisibleBeforeDecoration = Boolean(toolbar && !toolbar.hidden);
    const sizeControl = document.getElementById("inlineFontSizeRange");
    const beforeSize = EditorModules.gallery.getContent("gallery").textStyles.desktop.headline.size;
    sizeControl.value = String(beforeSize + 2);
    sizeControl.dispatchEvent(new Event("input", { bubbles: true }));
    const afterSize = EditorModules.gallery.getContent("gallery").textStyles.desktop.headline.size;
    const autoFitBox = headline.closest(".gallery-base-text-box");
    const autoFitLayerRect = autoFitBox.closest(".gallery-custom-text-layer").getBoundingClientRect();
    const autoFitLayout = EditorModules.gallery.getContent("gallery").baseTextBoxes.headline.layouts.desktop;
    const autoFitMeasured = measureGalleryTextContent(headline, autoFitLayerRect, autoFitLayout);
    const baseAutoFit = Math.abs(autoFitBox.getBoundingClientRect().width - autoFitMeasured.width) <= 2
      && Math.abs(autoFitBox.getBoundingClientRect().height - autoFitMeasured.height) <= 2;
    const baseModel = EditorModules.gallery.getContent("gallery");
    const originalHeadline = baseModel.headline;
    const baseDesktopOriginal = structuredClone(baseModel.baseTextBoxes.headline.layouts.desktop);
    const basePhoneOriginal = structuredClone(baseModel.baseTextBoxes.headline.layouts.phone);
    const baseBox = headline.closest(".gallery-base-text-box");
    const baseControls = [...baseBox.querySelectorAll("[data-gallery-text-control]")];
    const baseDimensionControlsVisible = !document.getElementById("inlineGalleryTextWidthControl").hidden
      && !document.getElementById("inlineGalleryTextHeightControl").hidden;
    const baseWidthRange = document.getElementById("inlineGalleryTextWidthRange");
    const baseHeightRange = document.getElementById("inlineGalleryTextHeightRange");
    const baseFitButton = document.getElementById("inlineGalleryTextFitBtn");
    const baseFitButtonVisible = !baseFitButton.hidden;
    baseWidthRange.value = "80";
    baseWidthRange.dispatchEvent(new Event("input", { bubbles: true }));
    baseHeightRange.value = "60";
    baseHeightRange.dispatchEvent(new Event("input", { bubbles: true }));
    baseFitButton.click();
    const fittedLayout = EditorModules.gallery.getContent("gallery").baseTextBoxes.headline.layouts.desktop;
    const fittedBox = headline.closest(".gallery-base-text-box");
    const fittedLayerRect = fittedBox.closest(".gallery-custom-text-layer").getBoundingClientRect();
    const fittedMeasured = measureGalleryTextContent(headline, fittedLayerRect, fittedLayout);
    const baseFitButtonWorked = !fittedLayout.manualSize
      && Math.abs(fittedBox.getBoundingClientRect().width - fittedMeasured.width) <= 2
      && Math.abs(fittedBox.getBoundingClientRect().height - fittedMeasured.height) <= 2;
    baseWidthRange.value = "58";
    baseWidthRange.dispatchEvent(new Event("input", { bubbles: true }));
    baseHeightRange.value = "36";
    baseHeightRange.dispatchEvent(new Event("input", { bubbles: true }));
    const baseBeforeResize = structuredClone(EditorModules.gallery.getContent("gallery").baseTextBoxes.headline.layouts.desktop);
    const baseRect = baseBox.getBoundingClientRect();
    const baseSectionLayer = baseBox.closest(".gallery-section-layer");
    const baseResizeHandle = baseBox.querySelector('[data-gallery-text-control="se"]');
    baseResizeHandle.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true, button: 0, pointerId: 93, clientX: baseRect.right, clientY: baseRect.bottom
    }));
    baseSectionLayer.dispatchEvent(new PointerEvent("pointermove", {
      bubbles: true, pointerId: 93, clientX: baseRect.right + 24, clientY: baseRect.bottom + 12
    }));
    baseSectionLayer.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true, pointerId: 93, clientX: baseRect.right + 24, clientY: baseRect.bottom + 12
    }));
    const baseAfterResize = structuredClone(EditorModules.gallery.getContent("gallery").baseTextBoxes.headline.layouts.desktop);
    const baseMovedBox = document.querySelector('[data-gallery-base-text-field="headline"]');
    const baseMovedRect = baseMovedBox.getBoundingClientRect();
    const baseMoveHandle = baseMovedBox.querySelector('[data-gallery-text-control="move"]');
    baseMoveHandle.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true, button: 0, pointerId: 94,
      clientX: baseMovedRect.left + baseMovedRect.width / 2, clientY: baseMovedRect.top
    }));
    baseSectionLayer.dispatchEvent(new PointerEvent("pointermove", {
      bubbles: true, pointerId: 94,
      clientX: baseMovedRect.left + baseMovedRect.width / 2 + 20, clientY: baseMovedRect.top + 14
    }));
    baseSectionLayer.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true, pointerId: 94,
      clientX: baseMovedRect.left + baseMovedRect.width / 2 + 20, clientY: baseMovedRect.top + 14
    }));
    const baseDesktopMoved = structuredClone(EditorModules.gallery.getContent("gallery").baseTextBoxes.headline.layouts.desktop);
    setViewport("phone");
    await new Promise((resolveWait) => requestAnimationFrame(() => requestAnimationFrame(resolveWait)));
    const basePhoneWidthRange = document.getElementById("inlineGalleryTextWidthRange");
    basePhoneWidthRange.value = "76";
    basePhoneWidthRange.dispatchEvent(new Event("input", { bubbles: true }));
    const basePhoneChanged = structuredClone(EditorModules.gallery.getContent("gallery").baseTextBoxes.headline.layouts.phone);
    setViewport("desktop");
    await new Promise((resolveWait) => requestAnimationFrame(() => requestAnimationFrame(resolveWait)));
    const baseDesktopAfterReturn = structuredClone(EditorModules.gallery.getContent("gallery").baseTextBoxes.headline.layouts.desktop);
    const baseDeleteButton = document.getElementById("inlineIdentityDeleteBtn");
    const baseDeleteVisible = !baseDeleteButton.hidden && !baseDeleteButton.disabled;
    baseDeleteButton.click();
    const emptyHeadline = document.querySelector('[data-gallery-field="headline"]');
    const baseDeletedToPlaceholder = EditorModules.gallery.getContent("gallery").headline === ""
      && emptyHeadline.closest(".gallery-base-text-box")?.classList.contains("is-empty");
    emptyHeadline.value = originalHeadline;
    emptyHeadline.dispatchEvent(new Event("input", { bubbles: true }));
    const baseRestored = EditorModules.gallery.getContent("gallery").headline === originalHeadline
      && !emptyHeadline.closest(".gallery-base-text-box")?.classList.contains("is-empty");
    const liveBaseModel = getGalleryModel("gallery");
    Object.assign(liveBaseModel.baseTextBoxes.headline.layouts.desktop, baseDesktopOriginal);
    Object.assign(liveBaseModel.baseTextBoxes.headline.layouts.phone, basePhoneOriginal);
    applyGalleryBaseTextLayout("gallery", "headline");
    fitGalleryBaseTextToContent("gallery", "headline");
    emptyHeadline.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
    await new Promise((resolveWait) => requestAnimationFrame(() => requestAnimationFrame(resolveWait)));

    const addTextButton = document.getElementById("inlineIdentityAddBtn");
    const addTextVisible = !addTextButton.hidden;
    const beforeTextCount = EditorModules.gallery.getContent("gallery").customTexts.length;
    addTextButton.click();
    await new Promise((resolveWait) => requestAnimationFrame(() => requestAnimationFrame(resolveWait)));
    const afterAddTextCount = EditorModules.gallery.getContent("gallery").customTexts.length;
    const addedText = EditorModules.gallery.getContent("gallery").customTexts.at(-1);
    const customInput = document.querySelector(
      `[data-gallery-custom-text-id="${CSS.escape(addedText.id)}"] [data-gallery-custom-text-field="text"]`
    );
    const widthBefore = customInput.closest(".gallery-custom-text-box").getBoundingClientRect().width;
    customInput.value = "가로 길이가 입력한 문장에 맞춰 자연스럽게 늘어나는 텍스트 상자";
    customInput.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((resolveWait) => requestAnimationFrame(() => requestAnimationFrame(resolveWait)));
    const widthAfter = customInput.closest(".gallery-custom-text-box").getBoundingClientRect().width;
    const widthControl = document.getElementById("inlineGalleryTextWidthControl");
    const heightControl = document.getElementById("inlineGalleryTextHeightControl");
    const widthRange = document.getElementById("inlineGalleryTextWidthRange");
    const heightRange = document.getElementById("inlineGalleryTextHeightRange");
    const dimensionControlsVisible = !widthControl.hidden && !heightControl.hidden;
    widthRange.value = "72";
    widthRange.dispatchEvent(new Event("input", { bubbles: true }));
    heightRange.value = "28";
    heightRange.dispatchEvent(new Event("input", { bubbles: true }));
    const activeBox = customInput.closest(".gallery-custom-text-box");
    const heroCopyRect = document.querySelector(".gallery-hero-copy").getBoundingClientRect();
    const manualRect = activeBox.getBoundingClientRect();
    const controls = [...activeBox.querySelectorAll("[data-gallery-text-control]")];
    const beforeResizeLayout = structuredClone(EditorModules.gallery.getContent("gallery").customTexts.at(-1).layouts.desktop);
    const sectionLayer = activeBox.closest(".gallery-section-layer");
    const resizeHandle = activeBox.querySelector('[data-gallery-text-control="se"]');
    resizeHandle.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true, button: 0, pointerId: 91, clientX: manualRect.right, clientY: manualRect.bottom
    }));
    sectionLayer.dispatchEvent(new PointerEvent("pointermove", {
      bubbles: true, pointerId: 91, clientX: manualRect.right + 36, clientY: manualRect.bottom + 18
    }));
    sectionLayer.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true, pointerId: 91, clientX: manualRect.right + 36, clientY: manualRect.bottom + 18
    }));
    const afterResizeLayout = structuredClone(EditorModules.gallery.getContent("gallery").customTexts.at(-1).layouts.desktop);
    const movedBox = document.querySelector(`[data-gallery-custom-text-id="${CSS.escape(addedText.id)}"]`);
    const movedRect = movedBox.getBoundingClientRect();
    const moveHandle = movedBox.querySelector('[data-gallery-text-control="move"]');
    moveHandle.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true, button: 0, pointerId: 92, clientX: movedRect.left + movedRect.width / 2, clientY: movedRect.top
    }));
    sectionLayer.dispatchEvent(new PointerEvent("pointermove", {
      bubbles: true, pointerId: 92, clientX: movedRect.left + movedRect.width / 2 + 28, clientY: movedRect.top + 16
    }));
    sectionLayer.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true, pointerId: 92, clientX: movedRect.left + movedRect.width / 2 + 28, clientY: movedRect.top + 16
    }));
    const desktopLayout = structuredClone(EditorModules.gallery.getContent("gallery").customTexts.at(-1).layouts.desktop);
    setViewport("phone");
    await new Promise((resolveWait) => requestAnimationFrame(() => requestAnimationFrame(resolveWait)));
    const phoneBefore = structuredClone(EditorModules.gallery.getContent("gallery").customTexts.at(-1).layouts.phone);
    const phoneWidthRange = document.getElementById("inlineGalleryTextWidthRange");
    phoneWidthRange.value = "42";
    phoneWidthRange.dispatchEvent(new Event("input", { bubbles: true }));
    const phoneAfter = structuredClone(EditorModules.gallery.getContent("gallery").customTexts.at(-1).layouts.phone);
    setViewport("desktop");
    await new Promise((resolveWait) => requestAnimationFrame(() => requestAnimationFrame(resolveWait)));
    const desktopAfterReturn = structuredClone(EditorModules.gallery.getContent("gallery").customTexts.at(-1).layouts.desktop);
    const deleteTextButton = document.getElementById("inlineIdentityDeleteBtn");
    const deleteTextVisible = !deleteTextButton.hidden && !deleteTextButton.disabled;
    deleteTextButton.click();
    const afterTextCount = EditorModules.gallery.getContent("gallery").customTexts.length;

    const beforeDecorations = EditorModules.gallery.getContent("gallery").decorations.length;
    document.querySelector('[data-gallery-action="add-decoration"]').click();
    await new Promise((resolveWait) => requestAnimationFrame(() => requestAnimationFrame(resolveWait)));
    const afterAdd = EditorModules.gallery.getContent("gallery");
    const added = afterAdd.decorations.at(-1);
    const modalOpen = !document.getElementById("decorationPickerModal").hidden;
    const sizeRange = document.getElementById("decorationSizeRange");
    const colorInput = document.getElementById("decorationColorInput");
    sizeRange.value = "77";
    sizeRange.dispatchEvent(new Event("input", { bubbles: true }));
    colorInput.value = "#336b4b";
    colorInput.dispatchEvent(new Event("input", { bubbles: true }));
    const changed = EditorModules.gallery.getContent("gallery").decorations.find((item) => item.id === added.id);
    document.getElementById("decorationRemoveBtn").click();
    const afterRemove = EditorModules.gallery.getContent("gallery");
    return {
      toolbarVisible: toolbarVisibleBeforeDecoration,
      toolbarLabel: document.getElementById("inlineLayerName")?.textContent,
      sizeChanged: afterSize === beforeSize + 2,
      baseAutoFit,
      baseFitButtonVisible,
      baseFitButtonWorked,
      baseDimensionControlsVisible,
      baseHandlesVisible: baseControls.length === 5 && baseControls.every((control) => getComputedStyle(control).display !== "none"),
      baseResized: baseAfterResize.w > baseBeforeResize.w && baseAfterResize.h > baseBeforeResize.h,
      baseMoved: baseDesktopMoved.x > baseAfterResize.x && baseDesktopMoved.y > baseAfterResize.y,
      baseViewportLayoutSeparated: basePhoneChanged.w === 76
        && baseDesktopAfterReturn.w === baseDesktopMoved.w && baseDesktopAfterReturn.x === baseDesktopMoved.x,
      baseDeleteVisible,
      baseDeletedToPlaceholder,
      baseRestored,
      addTextVisible,
      deleteTextVisible,
      textAdded: afterAddTextCount === beforeTextCount + 1 && Boolean(addedText),
      textWidthExpanded: widthAfter > widthBefore + 20,
      dimensionControlsVisible,
      textExtendsIntoPhotoArea: manualRect.right > heroCopyRect.right + 20,
      textHandlesVisible: controls.length === 5 && controls.every((control) => getComputedStyle(control).display !== "none"),
      beforeResizeLayout,
      afterResizeLayout,
      desktopLayout,
      textResized: afterResizeLayout.w > beforeResizeLayout.w && afterResizeLayout.h > beforeResizeLayout.h,
      textMoved: desktopLayout.x > afterResizeLayout.x && desktopLayout.y > afterResizeLayout.y,
      viewportLayoutSeparated: phoneAfter.w === 42 && phoneAfter.w !== phoneBefore.w
        && desktopAfterReturn.w === desktopLayout.w && desktopAfterReturn.x === desktopLayout.x,
      textDeleted: afterTextCount === beforeTextCount,
      beforeDecorations,
      afterAddCount: afterAdd.decorations.length,
      modalOpen,
      decorationSizeChanged: changed?.sizes.desktop === 77,
      decorationColorChanged: changed?.color === "#336b4b",
      afterRemoveCount: afterRemove.decorations.length,
      modalClosed: document.getElementById("decorationPickerModal").hidden
    };
  });
  if (!sharedToolResult.toolbarVisible || !sharedToolResult.toolbarLabel?.includes("갤러리 제목")) issues.push("gallery headline shared text toolbar did not open");
  if (!sharedToolResult.sizeChanged) issues.push("gallery headline font size did not update");
  if (!sharedToolResult.baseAutoFit) issues.push("gallery base text box did not fit its rendered text");
  if (!sharedToolResult.baseFitButtonVisible || !sharedToolResult.baseFitButtonWorked) issues.push("gallery text fit button is missing or did not reset a manual box");
  if (!sharedToolResult.baseDimensionControlsVisible || !sharedToolResult.baseHandlesVisible) issues.push("gallery base text box controls are missing");
  if (!sharedToolResult.baseResized || !sharedToolResult.baseMoved) issues.push("gallery base text box move or corner resize failed");
  if (!sharedToolResult.baseViewportLayoutSeparated) issues.push("gallery base text desktop and mobile layouts are not independent");
  if (!sharedToolResult.baseDeleteVisible || !sharedToolResult.baseDeletedToPlaceholder || !sharedToolResult.baseRestored) issues.push("gallery base text delete or restore failed");
  if (!sharedToolResult.addTextVisible || !sharedToolResult.deleteTextVisible) issues.push("gallery custom text add or delete control is missing");
  if (!sharedToolResult.textAdded || !sharedToolResult.textDeleted) issues.push("gallery custom text add or delete failed");
  if (!sharedToolResult.textWidthExpanded) issues.push("gallery custom text box width did not follow its content");
  if (!sharedToolResult.dimensionControlsVisible) issues.push("gallery custom text width or height control is missing");
  if (!sharedToolResult.textExtendsIntoPhotoArea) issues.push("gallery custom text could not extend into the photo area");
  if (!sharedToolResult.textHandlesVisible || !sharedToolResult.textResized || !sharedToolResult.textMoved) issues.push("gallery custom text move or corner resize failed");
  if (!sharedToolResult.viewportLayoutSeparated) issues.push("gallery custom text desktop and mobile layouts are not independent");
  if (sharedToolResult.afterAddCount !== sharedToolResult.beforeDecorations + 1 || !sharedToolResult.modalOpen) issues.push("gallery decoration add or picker open failed");
  if (!sharedToolResult.decorationSizeChanged || !sharedToolResult.decorationColorChanged) issues.push("gallery decoration shared controls did not update");
  if (sharedToolResult.afterRemoveCount !== sharedToolResult.beforeDecorations || !sharedToolResult.modalClosed) issues.push("gallery decoration delete failed");

  await page.locator(".gallery-hero").scrollIntoViewIfNeeded();
  const dragCandidate = await page.evaluate(() => {
    const offsets = [.2, .35, .5, .65, .8];
    const decorations = [...document.querySelectorAll('.gallery-hero-decoration[data-visual-decoration-id]')];
    for (const element of decorations) {
      const rect = element.getBoundingClientRect();
      for (const yOffset of offsets) {
        for (const xOffset of offsets) {
          const point = { x: rect.left + rect.width * xOffset, y: rect.top + rect.height * yOffset };
          const hit = document.elementFromPoint(point.x, point.y)?.closest('[data-visual-decoration-id]');
          if (hit === element) return { id: element.dataset.visualDecorationId, point };
        }
      }
    }
    return null;
  });
  const decorationDragBefore = dragCandidate ? await page.evaluate((id) => {
    const item = EditorModules.gallery.getContent("gallery").decorations.find((decoration) => decoration.id === id);
    return item?.layouts.desktop ?? null;
  }, dragCandidate.id) : null;
  const decorationLocator = dragCandidate
    ? page.locator(`.gallery-hero-decoration[data-visual-decoration-id="${dragCandidate.id}"]`)
    : null;
  const hitTarget = dragCandidate ? await page.evaluate(({ x, y }) => {
    const element = document.elementFromPoint(x, y);
    return {
      tag: element?.tagName,
      visualId: element?.closest('[data-visual-decoration-id]')?.dataset.visualDecorationId ?? null,
      className: element?.className?.baseVal ?? element?.className ?? null
    };
  }, dragCandidate.point) : null;
  if (dragCandidate && decorationLocator) {
    await page.mouse.move(dragCandidate.point.x, dragCandidate.point.y);
    await page.mouse.down();
    const started = await decorationLocator.evaluate((element) => element.classList.contains("is-dragging"));
    await page.mouse.move(dragCandidate.point.x + 48, dragCandidate.point.y + 24, { steps: 5 });
    await page.mouse.up();
    hitTarget.started = started;
  }
  const decorationDragAfter = dragCandidate ? await page.evaluate((id) => {
    const item = EditorModules.gallery.getContent("gallery").decorations.find((decoration) => decoration.id === id);
    return item?.layouts.desktop ?? null;
  }, dragCandidate.id) : null;
  const decorationDragged = Boolean(decorationDragBefore && decorationDragAfter) && (
    Math.abs(decorationDragAfter.x - decorationDragBefore.x) > .1
    || Math.abs(decorationDragAfter.y - decorationDragBefore.y) > .1
  );
  const decorationDragResult = { before: decorationDragBefore, after: decorationDragAfter, hitTarget, decorationDragged };
  if (!decorationDragged) issues.push("gallery decoration drag did not update its saved position");

  const editResult = await page.evaluate(() => {
    const sectionId = "gallery";
    const before = EditorModules.gallery.getContent(sectionId);
    const categoryInput = document.querySelector('.gallery-category-input[data-category-id="environment"]');
    categoryInput?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    const categoryToolbarOpened = !document.getElementById("inlineToolbar").hidden;
    const categoryAddButton = document.getElementById("inlineGalleryCategoryAddBtn");
    const categoryDeleteButton = document.getElementById("inlineGalleryCategoryDeleteBtn");
    const categoryCommandsVisible = !categoryAddButton.hidden && !categoryDeleteButton.hidden;
    categoryAddButton?.click();
    const firstCard = document.querySelector('.gallery-item[data-gallery-item-id]');
    const firstItemId = firstCard?.dataset.galleryItemId ?? null;
    const addItemButton = firstCard?.querySelector('[data-gallery-action="add-item-after"]');
    addItemButton?.click();
    const after = EditorModules.gallery.getContent(sectionId);
    const firstItemIndex = after.items.findIndex((item) => item.id === firstItemId);
    const insertedAfterFirst = firstItemIndex >= 0
      && after.items[firstItemIndex + 1]?.id !== before.items[firstItemIndex + 1]?.id;
    const duplicateId = EditorModules.sectionManager.addGalleryAt("bottom", EditorModules.sectionManager.getOrder().length);
    const copied = EditorModules.gallery.getContent(duplicateId);
    EditorModules.sectionManager.deleteById(duplicateId);
    return {
      categoryInputFound: Boolean(categoryInput),
      categoryToolbarOpened,
      categoryCommandsVisible,
      addItemButtonFound: Boolean(addItemButton),
      categoryAdded: after.categories.length === before.categories.length + 1,
      itemAdded: after.items.length === before.items.length + 1,
      insertedAfterFirst,
      copiedItems: copied.items.length,
      duplicateDeleted: !EditorModules.sectionManager.getOrder().includes(duplicateId),
      documentTypes: EditorModules.storage.createSectionDocument().sections.map((section) => section.type)
    };
  });
  if (!editResult.categoryInputFound || !editResult.categoryToolbarOpened || !editResult.categoryCommandsVisible || !editResult.addItemButtonFound) issues.push("gallery inline edit controls disappeared after shared decoration editing");
  if (!editResult.categoryAdded || !editResult.itemAdded || !editResult.insertedAfterFirst) issues.push("gallery inline category or item addition failed");
  if (!editResult.duplicateDeleted || editResult.copiedItems < 7) issues.push("gallery section copy/delete failed");
  if (!editResult.documentTypes.includes("gallery")) issues.push("gallery is missing from saved section document");

  const paginationResult = await page.evaluate(async () => {
    setMode("view");
    setViewport("desktop");
    let model = EditorModules.gallery.getContent("gallery");
    while (model.items.length < 22) model = window.EditorGalleryManager.addItem(model);
    EditorModules.gallery.setContent("gallery", model);
    await new Promise((resolveWait) => requestAnimationFrame(() => requestAnimationFrame(resolveWait)));

    const getDesktopLayout = () => {
      const grid = document.querySelector(".gallery-section-layer:not([hidden]) .gallery-grid");
      const cards = [...grid.querySelectorAll(".gallery-item")];
      const rows = [];
      cards.forEach((card) => {
        const rect = card.getBoundingClientRect();
        let row = rows.find((entry) => Math.abs(entry.top - rect.top) < 4);
        if (!row) {
          row = { top: rect.top, cards: [] };
          rows.push(row);
        }
        row.cards.push(rect);
      });
      const gridRect = grid.getBoundingClientRect();
      return {
        count: cards.length,
        rowCounts: rows.map((row) => row.cards.length),
        rowsFillWidth: rows.every((row) => {
          const left = Math.min(...row.cards.map((rect) => rect.left));
          const right = Math.max(...row.cards.map((rect) => rect.right));
          return Math.abs(left - gridRect.left) < 3 && Math.abs(right - gridRect.right) < 3;
        })
      };
    };

    const desktopBefore = getDesktopLayout();
    const desktopLoadButton = document.querySelector('[data-gallery-action="load-more"]');
    desktopLoadButton?.click();
    await new Promise((resolveWait) => requestAnimationFrame(() => requestAnimationFrame(resolveWait)));
    const desktopAfter = getDesktopLayout();

    setViewport("phone");
    model = EditorModules.gallery.getContent("gallery");
    model.mobileStyle = "journal";
    EditorModules.gallery.setContent("gallery", model);
    await new Promise((resolveWait) => requestAnimationFrame(() => requestAnimationFrame(resolveWait)));
    const journalBefore = document.querySelectorAll(".gallery-section-layer:not([hidden]) .gallery-grid .gallery-item").length;
    const journalLoadButton = document.querySelector('[data-gallery-action="load-more"]');
    journalLoadButton?.click();
    await new Promise((resolveWait) => requestAnimationFrame(() => requestAnimationFrame(resolveWait)));
    const journalAfter = document.querySelectorAll(".gallery-section-layer:not([hidden]) .gallery-grid .gallery-item").length;

    model = EditorModules.gallery.getContent("gallery");
    model.mobileStyle = "poster";
    EditorModules.gallery.setContent("gallery", model);
    await new Promise((resolveWait) => requestAnimationFrame(() => requestAnimationFrame(resolveWait)));
    const layer = document.querySelector(".gallery-section-layer:not([hidden])");
    const posterCard = layer.querySelector(".gallery-grid .gallery-item");
    const posterBody = posterCard?.querySelector(".gallery-item-body");
    const posterDate = posterCard?.querySelector(".gallery-item-date");
    const posterDescription = posterCard?.querySelector(".gallery-item-description");
    const posterTitle = posterCard?.querySelector(".gallery-item-title");
    const categoryStrip = layer.querySelector(".gallery-categories");
    const cardCategory = posterCard?.querySelector(".gallery-item-category-select");
    const openButton = posterCard?.querySelector(".gallery-item-open");
    return {
      desktopBefore,
      desktopAfter,
      desktopLoadButtonFound: Boolean(desktopLoadButton),
      journalBefore,
      journalAfter,
      journalLoadButtonFound: Boolean(journalLoadButton),
      posterOverlay: Boolean(
        posterBody && getComputedStyle(posterBody).position === "absolute"
        && posterDate && getComputedStyle(posterDate).display === "none"
        && posterDescription && getComputedStyle(posterDescription).display === "none"
        && posterTitle && getComputedStyle(posterTitle).color === "rgb(255, 255, 255)"
      ),
      mobileCategoriesHidden: Boolean(
        categoryStrip && getComputedStyle(categoryStrip).display === "none"
        && cardCategory && getComputedStyle(cardCategory).display === "none"
      ),
      cardDetailReady: Boolean(openButton && getComputedStyle(openButton).display !== "none")
    };
  });
  if (paginationResult.desktopBefore.count !== 10 || paginationResult.desktopBefore.rowCounts.some((count) => count > 5)) issues.push("desktop gallery does not start with two rows of at most five cards");
  if (!paginationResult.desktopBefore.rowsFillWidth) issues.push("desktop gallery leaves unused width in an incomplete row");
  if (!paginationResult.desktopLoadButtonFound || paginationResult.desktopAfter.count !== 20) issues.push("desktop gallery load-more does not reveal the next two rows");
  if (!paginationResult.journalLoadButtonFound || paginationResult.journalBefore !== 5 || paginationResult.journalAfter !== 10) issues.push("mobile journal load-more does not reveal five cards at a time");
  if (!paginationResult.posterOverlay || !paginationResult.mobileCategoriesHidden || !paginationResult.cardDetailReady) issues.push("mobile poster overlay, hidden categories, or detail-link structure is missing");

  const mobileControlResult = await page.evaluate(() => {
    setMode("edit");
    setViewport("phone");
    const layer = document.querySelector(".gallery-section-layer:not([hidden])");
    const desktopControl = layer?.querySelector(".gallery-desktop-style-control");
    const mobileControl = layer?.querySelector('[data-gallery-setting="mobileStyle"]')?.closest("label");
    return {
      desktopHidden: Boolean(desktopControl && getComputedStyle(desktopControl).display === "none"),
      mobileVisible: Boolean(mobileControl && getComputedStyle(mobileControl).display !== "none")
    };
  });
  if (!mobileControlResult.desktopHidden) issues.push("mobile gallery still shows the PC style selector");
  if (!mobileControlResult.mobileVisible) issues.push("mobile gallery style selector is not visible");

  const responsiveResults = {};
  for (const viewport of ["phoneSmall", "phone", "tablet"]) {
    responsiveResults[viewport] = {};
    for (const style of mobileStyles) {
      await page.evaluate(({ viewport, style }) => {
        setMode("view");
        setViewport(viewport);
        const model = EditorModules.gallery.getContent("gallery");
        model.mobileStyle = style;
        EditorModules.gallery.setContent("gallery", model);
      }, { viewport, style });
      await page.waitForTimeout(220);
      const result = await page.evaluate(() => {
        const stage = document.getElementById("stage");
        const layer = document.querySelector(".gallery-section-layer:not([hidden])");
        const content = layer?.querySelector(".gallery-section-content");
        const stageRect = stage?.getBoundingClientRect();
        const layerRect = layer?.getBoundingClientRect();
        const cards = [...(layer?.querySelectorAll(".gallery-item") ?? [])];
        const posterTiles = [...(layer?.querySelectorAll(".gallery-hero-tile") ?? [])]
          .filter((tile) => getComputedStyle(tile).display !== "none");
        let posterOverlapPairs = 0;
        for (let first = 0; first < posterTiles.length; first += 1) {
          const a = posterTiles[first].getBoundingClientRect();
          for (let second = first + 1; second < posterTiles.length; second += 1) {
            const b = posterTiles[second].getBoundingClientRect();
            const overlapWidth = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
            const overlapHeight = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
            if (overlapWidth * overlapHeight > 40) posterOverlapPairs += 1;
          }
        }
        const journalGrid = layer?.querySelector(".gallery-grid");
        return {
          style: content?.dataset.mobileStyle,
          insideStage: Boolean(stageRect && layerRect && layerRect.left >= stageRect.left - 2 && layerRect.right <= stageRect.right + 2),
          contentFits: Boolean(content && layerRect && content.scrollHeight <= layerRect.height + 12),
          cardOverflow: cards.filter((card) => {
            const rect = card.getBoundingClientRect();
            return rect.left < layerRect.left - 2 || rect.right > layerRect.right + 2;
          }).length,
          clippedFieldDetails: [...(layer?.querySelectorAll("textarea.gallery-field") ?? [])]
            .filter((field) => field.scrollHeight > field.clientHeight + 3)
            .map((field) => ({
              field: field.dataset.galleryField || field.dataset.galleryItemField || field.dataset.galleryCustomTextField || "unknown",
              className: field.className,
              scrollHeight: field.scrollHeight,
              clientHeight: field.clientHeight,
              value: field.value
            })),
          posterTiles: posterTiles.length,
          posterOrganicTiles: posterTiles.filter((tile) => getComputedStyle(tile).borderRadius.includes("%")).length,
          posterOverlapPairs,
          visibleTapes: posterTiles.filter((tile) => {
            const tape = tile.querySelector(".gallery-photo-tape");
            return tape && getComputedStyle(tape).display !== "none";
          }).length,
          tapeTheme: (() => {
            const tape = posterTiles[0]?.querySelector(".gallery-photo-tape");
            if (!tape) return "";
            const computed = getComputedStyle(tape);
            return `${computed.backgroundImage}|${computed.backgroundColor}`;
          })(),
          journalPathVisible: Boolean(journalGrid && getComputedStyle(journalGrid, "::before").maskImage !== "none"),
          journalTiltedCards: cards.filter((card) => getComputedStyle(card).transform !== "none").length
        };
      });
      result.clippedFields = result.clippedFieldDetails.length;
      responsiveResults[viewport][style] = result;
      if (!result.insideStage) issues.push(`${viewport}/${style}: gallery exceeds stage width`);
      if (!result.contentFits) issues.push(`${viewport}/${style}: gallery section clips content`);
      if (result.cardOverflow) issues.push(`${viewport}/${style}: gallery cards overflow`);
      if (result.clippedFields) issues.push(`${viewport}/${style}: gallery text is clipped`);
      if ((style === "poster" || style === "journal") && result.visibleTapes !== 0) issues.push(`${viewport}/${style}: tape from the desktop style leaked into mobile`);
      if (style === "poster" && result.posterTiles !== 6) issues.push(`${viewport}/${style}: poster does not show six photos`);
      if (style === "poster" && result.posterOrganicTiles !== 6) issues.push(`${viewport}/${style}: poster photos are not organic shapes`);
      if (style === "poster" && result.posterOverlapPairs < 1) issues.push(`${viewport}/${style}: poster photos do not overlap`);
      if (style.startsWith("tape-") && result.posterTiles !== 5) issues.push(`${viewport}/${style}: taped headline does not show five photos`);
      if (style.startsWith("tape-") && result.visibleTapes !== 5) issues.push(`${viewport}/${style}: five photo tapes are not visible`);
      if (style.startsWith("tape-") && result.posterOverlapPairs < 1) issues.push(`${viewport}/${style}: taped photos do not overlap`);
      if (style === "tape-pink" && !result.tapeTheme.includes("repeating-linear-gradient")) issues.push(`${viewport}/${style}: pink striped tape theme is missing`);
      if (style === "tape-nature" && !result.tapeTheme.includes("rgba(174, 188, 124")) issues.push(`${viewport}/${style}: green tape theme is missing`);
      if (style === "tape-yellow" && !result.tapeTheme.includes("rgb(237, 177, 45)")) issues.push(`${viewport}/${style}: yellow tape theme is missing`);
      if (style === "journal" && (!result.journalPathVisible || result.journalTiltedCards < 4)) issues.push(`${viewport}/${style}: activity path or angled photos are missing`);
    }
  }

  console.log(JSON.stringify({ themeIntegrationResult, desktopStyles, desktopLayoutResults, mobileStyles, heroFrameResult, heroDragResult, heroViewportResult, sharedToolResult, decorationDragResult, editResult, paginationResult, mobileControlResult, responsiveResults }, null, 2));
} finally {
  await browser.close();
}

if (issues.length) {
  console.error(issues.join("\n"));
  process.exitCode = 1;
} else {
  console.log("gallery browser tests OK");
}
