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

const nextFrame = (page) => page.evaluate(() => new Promise((resolveWait) => requestAnimationFrame(() => requestAnimationFrame(resolveWait))));
const countCards = (page) => page.locator(".gallery-section-layer:not([hidden]) .gallery-grid .gallery-item").count();

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", (error) => issues.push(`page error: ${error.message}`));
  await page.goto(`${editorUrl}?viewport=desktop&mode=edit&previewSection=gallery&v=gallery-editing-regression`, { waitUntil: "commit" });
  await page.waitForSelector(".gallery-section-layer:not([hidden]) .gallery-section-content");
  await page.waitForFunction(() => window.EditorModules?.gallery && window.EditorGalleryManager);

  await page.evaluate(() => {
    setMode("edit");
    setViewport("desktop");
    let model = EditorModules.gallery.getContent("gallery");
    model.activeCategoryId = "all";
    while (model.items.length < 22) model = EditorGalleryManager.addItem(model);
    EditorModules.gallery.setContent("gallery", model);
  });
  await nextFrame(page);

  const desktopEditCount = await countCards(page);
  if (desktopEditCount !== 22) issues.push(`desktop edit mode hides cards: ${desktopEditCount}/22`);
  if (await page.locator('[data-gallery-action="toggle-pagination-preview"]').count()) issues.push("obsolete edit-mode pagination preview control is still visible");

  const desktopArrangement = await page.evaluate(async () => {
    const original = structuredClone(EditorModules.gallery.getContent("gallery"));
    const model = structuredClone(original);
    model.items = model.items.slice(0, 11);
    EditorModules.gallery.setContent("gallery", model);
    await new Promise((resolveWait) => requestAnimationFrame(() => requestAnimationFrame(resolveWait)));
    const grid = document.querySelector(".gallery-grid");
    const cards = [...grid.querySelectorAll(".gallery-item")];
    const rowCounts = Object.values(cards.reduce((rows, card) => {
      const top = Math.round(card.getBoundingClientRect().top);
      rows[top] = (rows[top] || 0) + 1;
      return rows;
    }, {}));
    const lastWidth = cards.at(-1).getBoundingClientRect().width;
    const gridWidth = grid.getBoundingClientRect().width;
    EditorModules.gallery.setContent("gallery", original);
    await new Promise((resolveWait) => requestAnimationFrame(() => requestAnimationFrame(resolveWait)));
    return { rowCounts, lastWidth, gridWidth };
  });
  if (desktopArrangement.rowCounts.join(",") !== "5,3,3" || desktopArrangement.lastWidth >= desktopArrangement.gridWidth / 2) {
    issues.push(`desktop remainder cards are unbalanced: ${JSON.stringify(desktopArrangement)}`);
  }

  const editTypography = await page.evaluate(() => {
    const categoryInput = document.querySelector(".gallery-category-input");
    const ctaEditor = document.querySelector(".gallery-cta-editor");
    const ctaInput = document.querySelector(".gallery-cta-input");
    return {
      categoryHeight: categoryInput.getBoundingClientRect().height,
      categoryWidth: categoryInput.closest(".gallery-category").getBoundingClientRect().width,
      categoryFont: getComputedStyle(categoryInput).fontSize,
      ctaHeight: ctaEditor.getBoundingClientRect().height,
      ctaWidth: ctaEditor.getBoundingClientRect().width,
      ctaFont: getComputedStyle(ctaInput).fontSize,
      ctaArrow: getComputedStyle(ctaEditor, "::after").content
    };
  });
  const cardInsertResult = await page.evaluate(async () => {
    const original = structuredClone(EditorModules.gallery.getContent("gallery"));
    const originalIds = original.items.map((item) => item.id);
    const firstCard = document.querySelector(".gallery-grid .gallery-item");
    const firstId = firstCard?.dataset.galleryItemId;
    const media = firstCard?.querySelector(".gallery-item-media");
    const categorySelect = firstCard?.querySelector(".gallery-item-category-select");
    const addButton = firstCard?.querySelector('[data-gallery-action="add-item-after"]');
    const selectOverlay = Boolean(categorySelect && categorySelect.parentElement === media)
      && getComputedStyle(categorySelect).position === "absolute";
    addButton?.click();
    await new Promise((resolveWait) => requestAnimationFrame(() => requestAnimationFrame(resolveWait)));
    const insertedModel = EditorModules.gallery.getContent("gallery");
    const insertedId = insertedModel.items[1]?.id;
    const result = {
      firstId,
      addButton: Boolean(addButton),
      selectOverlay,
      insertedAfterFirst: insertedModel.items[0]?.id === firstId
        && Boolean(insertedId)
        && !originalIds.includes(insertedId),
      cardCount: document.querySelectorAll(".gallery-grid .gallery-item").length
    };
    EditorModules.gallery.setContent("gallery", original);
    await new Promise((resolveWait) => requestAnimationFrame(() => requestAnimationFrame(resolveWait)));
    return result;
  });
  if (!cardInsertResult.addButton || !cardInsertResult.selectOverlay || !cardInsertResult.insertedAfterFirst || cardInsertResult.cardCount !== 23) {
    issues.push(`gallery per-card insert or category overlay failed: ${JSON.stringify(cardInsertResult)}`);
  }

  await page.evaluate(() => setMode("view"));
  await nextFrame(page);
  const viewTypography = await page.evaluate(() => {
    const category = document.querySelector(".gallery-category-view");
    const cta = document.querySelector(".gallery-load-more");
    return {
      categoryHeight: category.getBoundingClientRect().height,
      categoryWidth: category.closest(".gallery-category").getBoundingClientRect().width,
      categoryFont: getComputedStyle(category).fontSize,
      ctaHeight: cta.getBoundingClientRect().height,
      ctaWidth: cta.getBoundingClientRect().width,
      ctaFont: getComputedStyle(cta).fontSize,
      ctaArrow: getComputedStyle(cta, "::after").content
    };
  });
  if (Math.abs(editTypography.categoryHeight - viewTypography.categoryHeight) > 1 || Math.abs(editTypography.categoryWidth - viewTypography.categoryWidth) > 1 || editTypography.categoryFont !== viewTypography.categoryFont
    || Math.abs(editTypography.ctaHeight - viewTypography.ctaHeight) > 2 || Math.abs(editTypography.ctaWidth - viewTypography.ctaWidth) > 2
    || editTypography.ctaFont !== viewTypography.ctaFont || editTypography.ctaArrow !== viewTypography.ctaArrow) {
    issues.push(`gallery edit/view typography mismatch: ${JSON.stringify({ editTypography, viewTypography })}`);
  }
  const desktopPreviewCount = await countCards(page);
  const editLoadVisible = await page.locator('[data-gallery-action="load-more"]').isVisible();
  if (desktopPreviewCount !== 10 || !editLoadVisible) issues.push("desktop preview pagination did not start at 10 cards");
  await page.click('[data-gallery-action="load-more"]');
  await nextFrame(page);
  if (await countCards(page) !== 20) issues.push("desktop preview did not reveal the next 10 cards");
  const desktopSecondLoadVisible = await page.locator('[data-gallery-action="load-more"]').isVisible();
  if (!desktopSecondLoadVisible) issues.push("desktop load-more disappeared before the final cards");
  await page.click('[data-gallery-action="load-more"]');
  await nextFrame(page);
  const desktopFinalCount = await countCards(page);
  const desktopLoadGone = await page.locator('[data-gallery-action="load-more"]').count() === 0;
  if (desktopFinalCount !== 22 || !desktopLoadGone) issues.push(`desktop load-more did not finish cleanly: ${desktopFinalCount}/22, hidden=${desktopLoadGone}`);
  await page.evaluate(() => setMode("edit"));
  await nextFrame(page);
  if (await countCards(page) !== 22) issues.push("desktop edit mode did not restore all cards");

  const categoryBefore = await page.evaluate(() => EditorModules.gallery.getContent("gallery").categories.length);
  await page.click('.gallery-category-input[data-category-id="environment"]');
  await page.waitForSelector("#inlineToolbar:not([hidden])");
  const categoryToolbar = await page.evaluate(() => ({
    addVisible: !document.getElementById("inlineGalleryCategoryAddBtn").hidden,
    deleteVisible: !document.getElementById("inlineGalleryCategoryDeleteBtn").hidden,
    label: document.getElementById("inlineLayerName").textContent
  }));
  await page.click("#inlineGalleryCategoryAddBtn");
  await nextFrame(page);
  const addedCategoryId = await page.evaluate(() => EditorModules.gallery.getContent("gallery").categories.at(-1).id);
  const categoryInput = page.locator(`.gallery-category-input[data-category-id="${addedCategoryId}"]`);
  await categoryInput.fill("새 활동 분야");
  await categoryInput.blur();
  await nextFrame(page);
  const categoryLinkResult = await page.evaluate((categoryId) => {
    const model = EditorModules.gallery.getContent("gallery");
    const category = model.categories.find((entry) => entry.id === categoryId);
    const input = document.querySelector(`.gallery-category-input[data-category-id="${categoryId}"]`);
    const optionLabels = [...document.querySelectorAll(`.gallery-item-category-select option[value="${categoryId}"]`)].map((option) => option.textContent);
    const firstItem = model.items[0];
    firstItem.categoryId = categoryId;
    EditorModules.gallery.setContent("gallery", model);
    return {
      modelLabel: category?.label,
      inputLabel: input?.value,
      optionLabels,
      assignedItemId: firstItem.id
    };
  }, addedCategoryId);
  await nextFrame(page);
  await page.click(`.gallery-category-input[data-category-id="${addedCategoryId}"]`);
  await page.waitForSelector("#inlineGalleryCategoryDeleteBtn:not([hidden])");
  await page.click("#inlineGalleryCategoryDeleteBtn");
  await nextFrame(page);
  const categoryResult = await page.evaluate(({ before, categoryId, itemId }) => {
    const model = EditorModules.gallery.getContent("gallery");
    const assigned = model.items.find((item) => item.id === itemId);
    return {
      before,
      after: model.categories.length,
      removed: !model.categories.some((item) => item.id === categoryId),
      itemReassigned: assigned?.categoryId !== categoryId,
      separateModalGone: !document.getElementById("galleryCategoryModal")
    };
  }, { before: categoryBefore, categoryId: addedCategoryId, itemId: categoryLinkResult.assignedItemId });
  if (!categoryToolbar.addVisible || !categoryToolbar.deleteVisible || !categoryToolbar.label.includes("갤러리 분류")
    || categoryLinkResult.modelLabel !== "새 활동 분야" || categoryLinkResult.inputLabel !== "새 활동 분야"
    || !categoryLinkResult.optionLabels.length || categoryLinkResult.optionLabels.some((label) => label !== "새 활동 분야")
    || categoryResult.after !== categoryResult.before || !categoryResult.removed || !categoryResult.itemReassigned || !categoryResult.separateModalGone) {
    issues.push(`gallery inline category editing or card linkage failed: ${JSON.stringify({ categoryToolbar, categoryLinkResult, categoryResult })}`);
  }

  const dateResult = await page.evaluate(async () => {
    const month = document.querySelector('[data-gallery-field="monthLabel"]');
    month.value = "현재 진행 중인 기록";
    month.dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelector('[data-gallery-action="toggle-month-label"]').click();
    await new Promise((resolveWait) => requestAnimationFrame(() => requestAnimationFrame(resolveWait)));
    const monthHidden = EditorModules.gallery.getContent("gallery").showMonthLabel === false;
    document.querySelector('[data-gallery-action="toggle-month-label"]').click();
    await new Promise((resolveWait) => requestAnimationFrame(() => requestAnimationFrame(resolveWait)));

    const firstCard = document.querySelector(".gallery-grid .gallery-item");
    const itemId = firstCard.dataset.galleryItemId;
    const date = firstCard.querySelector('[data-gallery-item-field="date"]');
    date.value = "상시 운영";
    date.dispatchEvent(new Event("input", { bubbles: true }));
    firstCard.querySelector('[data-gallery-action="toggle-date"]').click();
    await new Promise((resolveWait) => requestAnimationFrame(() => requestAnimationFrame(resolveWait)));
    const cardHidden = EditorModules.gallery.getContent("gallery").items.find((item) => item.id === itemId)?.showDate === false;
    document.querySelector(`[data-gallery-item-id="${itemId}"] [data-gallery-action="toggle-date"]`).click();
    await new Promise((resolveWait) => requestAnimationFrame(() => requestAnimationFrame(resolveWait)));
    const model = EditorModules.gallery.getContent("gallery");
    const item = model.items.find((entry) => entry.id === itemId);
    return {
      monthHidden,
      monthVisible: model.showMonthLabel,
      monthText: model.monthLabel,
      cardHidden,
      cardVisible: item.showDate,
      cardText: item.date,
      itemId
    };
  });
  if (!dateResult.monthHidden || !dateResult.monthVisible || dateResult.monthText !== "현재 진행 중인 기록") issues.push("gallery date heading edit/hide/restore failed");
  if (!dateResult.cardHidden || !dateResult.cardVisible || dateResult.cardText !== "상시 운영") issues.push("gallery card date edit/hide/restore failed");

  const cardToolbarResult = await page.evaluate(async (itemId) => {
    const title = document.querySelector(`[data-gallery-item-id="${itemId}"] [data-gallery-item-field="title"]`);
    title.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
    await new Promise((resolveWait) => requestAnimationFrame(() => requestAnimationFrame(resolveWait)));
    const model = EditorModules.gallery.getContent("gallery");
    const item = model.items.find((entry) => entry.id === itemId);
    const before = item.textStyles.desktop.title.size;
    const range = document.getElementById("inlineFontSizeRange");
    range.value = String(before + 3);
    range.dispatchEvent(new Event("input", { bubbles: true }));
    return {
      toolbarVisible: !document.getElementById("inlineToolbar").hidden,
      label: document.getElementById("inlineLayerName").textContent,
      changed: EditorModules.gallery.getContent("gallery").items.find((entry) => entry.id === itemId).textStyles.desktop.title.size === before + 3
    };
  }, dateResult.itemId);
  if (!cardToolbarResult.toolbarVisible || !cardToolbarResult.label.includes("카드 제목") || !cardToolbarResult.changed) issues.push("gallery card text toolbar did not edit the selected card independently");

  await page.evaluate((itemId) => {
    const model = EditorModules.gallery.getContent("gallery");
    const item = model.items.find((entry) => entry.id === itemId);
    item.image = {
      name: "test.png",
      dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      naturalWidth: 1,
      naturalHeight: 1,
      fit: "cover",
      scale: 1,
      x: 0,
      y: 0,
      opacity: 100
    };
    EditorModules.gallery.setContent("gallery", model);
  }, dateResult.itemId);
  await nextFrame(page);
  const imageFrame = page.locator(`[data-gallery-item-id="${dateResult.itemId}"] [data-gallery-image-frame]`);
  await imageFrame.scrollIntoViewIfNeeded();
  await nextFrame(page);
  const frameBox = await imageFrame.boundingBox();
  if (frameBox) {
    await page.mouse.move(frameBox.x + frameBox.width / 2, frameBox.y + frameBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(frameBox.x + frameBox.width / 2 + 18, frameBox.y + frameBox.height / 2 + 12, { steps: 3 });
    await page.mouse.up();
  }
  await nextFrame(page);
  const panResult = await page.evaluate((itemId) => {
    const image = EditorModules.gallery.getContent("gallery").items.find((entry) => entry.id === itemId).image;
    return { x: image.x, y: image.y };
  }, dateResult.itemId);
  const imageToolbarResult = await page.evaluate(async (itemId) => {
    document.getElementById("inlinePhotoFitBtn").click();
    document.getElementById("inlinePhotoFillBtn").click();
    document.getElementById("inlinePhotoZoomInBtn").click();
    const opacity = document.getElementById("inlinePhotoOpacityRange");
    opacity.value = "72";
    opacity.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((resolveWait) => setTimeout(resolveWait, 220));
    const item = EditorModules.gallery.getContent("gallery").items.find((entry) => entry.id === itemId);
    const rendered = document.querySelector(`.gallery-grid .gallery-item[data-gallery-item-id="${itemId}"] [data-gallery-media-item-id="${itemId}"]`);
    return {
      toolbarVisible: !document.getElementById("inlineToolbar").hidden,
      label: document.getElementById("inlineLayerName").textContent,
      uploadVisible: !document.getElementById("inlineUploadBtn").hidden,
      fitVisible: !document.getElementById("inlinePhotoFitBtn").hidden,
      opacityVisible: !document.getElementById("inlinePhotoOpacityControl").hidden,
      deleteVisible: !document.getElementById("inlinePhotoDeleteBtn").hidden,
      legacyButtons: document.querySelectorAll(".gallery-image-upload").length,
      scale: item.image.scale,
      x: item.image.x,
      y: item.image.y,
      opacity: item.image.opacity,
      fit: item.image.fit,
      renderedOpacity: getComputedStyle(rendered).opacity
    };
  }, dateResult.itemId);
  if (!imageToolbarResult.toolbarVisible || !imageToolbarResult.label.includes("사진 편집") || !imageToolbarResult.uploadVisible || !imageToolbarResult.fitVisible || !imageToolbarResult.opacityVisible || !imageToolbarResult.deleteVisible || imageToolbarResult.legacyButtons !== 0 || imageToolbarResult.scale <= 1 || imageToolbarResult.opacity !== 72 || imageToolbarResult.fit !== "cover" || Math.abs(Number(imageToolbarResult.renderedOpacity) - .72) > .04 || (frameBox && panResult.x === 0 && panResult.y === 0)) issues.push(`gallery image toolbar or direct pan failed: ${JSON.stringify({ ...imageToolbarResult, panResult })}`);

  const heroLayerResult = await page.evaluate(async () => {
    const beforeModel = EditorModules.gallery.getContent("gallery");
    const itemId = beforeModel.items[0].id;
    const itemOrder = beforeModel.items.map((item) => item.id);
    const tile = document.querySelector(`.gallery-hero-tile[data-gallery-item-id="${itemId}"]`);
    tile?.focus();
    tile?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await new Promise((resolveWait) => requestAnimationFrame(() => requestAnimationFrame(resolveWait)));
    const toolbar = document.getElementById("inlineToolbar");
    const front = document.getElementById("inlineFrontBtn");
    const back = document.getElementById("inlineBackBtn");
    const initial = {
      tileFound: Boolean(tile),
      uploadInput: Boolean(tile?.querySelector(".gallery-image-input")),
      imageMatchesCard: tile?.querySelector("img")?.src === document.querySelector(`.gallery-item[data-gallery-item-id="${itemId}"] img`)?.src,
      toolbarVisible: !toolbar.hidden,
      label: document.getElementById("inlineLayerName").textContent,
      uploadVisible: !document.getElementById("inlineUploadBtn").hidden,
      frontVisible: !front.hidden,
      backVisible: !back.hidden,
      selected: tile?.classList.contains("is-image-selected")
    };
    front.click();
    await new Promise((resolveWait) => requestAnimationFrame(() => requestAnimationFrame(resolveWait)));
    const frontModel = EditorModules.gallery.getContent("gallery");
    const frontTile = document.querySelector(`.gallery-hero-tile[data-gallery-item-id="${itemId}"]`);
    const afterFront = {
      index: frontModel.heroOrder.indexOf(itemId),
      zIndex: Number(getComputedStyle(frontTile).zIndex)
    };
    document.getElementById("inlineBackBtn").click();
    await new Promise((resolveWait) => requestAnimationFrame(() => requestAnimationFrame(resolveWait)));
    const backModel = EditorModules.gallery.getContent("gallery");
    const backTile = document.querySelector(`.gallery-hero-tile[data-gallery-item-id="${itemId}"]`);
    return {
      initial,
      itemOrderUnchanged: itemOrder.join("|") === backModel.items.map((item) => item.id).join("|"),
      afterFront,
      afterBack: {
        index: backModel.heroOrder.indexOf(itemId),
        zIndex: Number(getComputedStyle(backTile).zIndex)
      }
    };
  });
  if (!heroLayerResult.initial.tileFound || !heroLayerResult.initial.uploadInput || !heroLayerResult.initial.imageMatchesCard || !heroLayerResult.initial.toolbarVisible || !heroLayerResult.initial.label.includes("상단 사진 편집") || !heroLayerResult.initial.uploadVisible || !heroLayerResult.initial.frontVisible || !heroLayerResult.initial.backVisible || !heroLayerResult.initial.selected || !heroLayerResult.itemOrderUnchanged || heroLayerResult.afterFront.index !== 5 || heroLayerResult.afterFront.zIndex !== 6 || heroLayerResult.afterBack.index !== 0 || heroLayerResult.afterBack.zIndex !== 1) issues.push(`gallery hero photo editing or layer order failed: ${JSON.stringify(heroLayerResult)}`);

  const mobilePagination = await page.evaluate(async () => {
    setViewport("phone");
    setMode("view");
    const model = EditorModules.gallery.getContent("gallery");
    model.mobileStyle = "journal";
    EditorModules.gallery.setContent("gallery", model);
    await new Promise((resolveWait) => requestAnimationFrame(() => requestAnimationFrame(resolveWait)));
    const before = document.querySelectorAll(".gallery-grid .gallery-item").length;
    const steps = [before];
    let guard = 0;
    while (document.querySelector('[data-gallery-action="load-more"]') && guard < 10) {
      document.querySelector('[data-gallery-action="load-more"]').click();
      await new Promise((resolveWait) => requestAnimationFrame(() => requestAnimationFrame(resolveWait)));
      steps.push(document.querySelectorAll(".gallery-grid .gallery-item").length);
      guard += 1;
    }
    const final = document.querySelectorAll(".gallery-grid .gallery-item").length;
    const exhausted = !document.querySelector('[data-gallery-action="load-more"]');
    setMode("edit");
    await new Promise((resolveWait) => requestAnimationFrame(() => requestAnimationFrame(resolveWait)));
    const editAll = document.querySelectorAll(".gallery-grid .gallery-item").length;
    return { before, after: steps[1], final, exhausted, editAll, steps };
  });
  if (mobilePagination.before !== 5 || mobilePagination.after !== 10 || mobilePagination.final !== 22 || !mobilePagination.exhausted || mobilePagination.editAll !== 22) issues.push(`mobile journal pagination/edit visibility failed: ${JSON.stringify(mobilePagination)}`);

  const mobileCategoryControls = await page.evaluate(() => {
    const strip = document.querySelector(".gallery-categories");
    return {
      stripHidden: Boolean(strip) && getComputedStyle(strip).display === "none",
      separateModalGone: !document.getElementById("galleryCategoryModal"),
      styleBarCategoryButtonGone: !document.querySelector('.gallery-style-bar [data-gallery-action="open-category-editor"]')
    };
  });
  if (!mobileCategoryControls.stripHidden || !mobileCategoryControls.separateModalGone || !mobileCategoryControls.styleBarCategoryButtonGone) {
    issues.push(`mobile gallery category controls are not simplified: ${JSON.stringify(mobileCategoryControls)}`);
  }

  const mobileImageFrame = page.locator(`[data-gallery-item-id="${dateResult.itemId}"] [data-gallery-image-frame]`);
  await mobileImageFrame.scrollIntoViewIfNeeded();
  await mobileImageFrame.click();
  await nextFrame(page);
  const mobileImageToolbar = await page.evaluate(() => {
    const toolbar = document.getElementById("inlineToolbar");
    const toolbarRect = toolbar.getBoundingClientRect();
    const stageRect = document.getElementById("stage").getBoundingClientRect();
    return {
      visible: !toolbar.hidden,
      mobileSheet: toolbar.classList.contains("mobile-sheet"),
      fitVisible: !document.getElementById("inlinePhotoFitBtn").hidden,
      uploadVisible: !document.getElementById("inlineUploadBtn").hidden,
      insideViewport: toolbarRect.left >= 0 && toolbarRect.right <= innerWidth && toolbarRect.top >= 0 && toolbarRect.bottom <= innerHeight,
      insideStage: toolbarRect.left >= stageRect.left - 1 && toolbarRect.right <= stageRect.right + 1
    };
  });
  if (!mobileImageToolbar.visible || !mobileImageToolbar.mobileSheet || !mobileImageToolbar.fitVisible || !mobileImageToolbar.uploadVisible || !mobileImageToolbar.insideViewport || !mobileImageToolbar.insideStage) issues.push(`mobile gallery image toolbar escaped the device frame: ${JSON.stringify(mobileImageToolbar)}`);

  const posterBalance = await page.evaluate(async () => {
    setMode("view");
    const model = EditorModules.gallery.getContent("gallery");
    model.mobileStyle = "poster";
    EditorModules.gallery.setContent("gallery", model);
    await new Promise((resolveWait) => requestAnimationFrame(() => requestAnimationFrame(resolveWait)));
    const cards = [...document.querySelectorAll(".gallery-grid .gallery-item")];
    const grid = document.querySelector(".gallery-grid");
    const gridRect = grid.getBoundingClientRect();
    const midpoint = gridRect.left + gridRect.width / 2;
    const leftBottom = Math.max(...cards.filter((card) => card.getBoundingClientRect().left < midpoint).map((card) => card.getBoundingClientRect().bottom));
    const rightBottom = Math.max(...cards.filter((card) => card.getBoundingClientRect().left >= midpoint).map((card) => card.getBoundingClientRect().bottom));
    let guard = 0;
    while (document.querySelector('[data-gallery-action="load-more"]') && guard < 10) {
      document.querySelector('[data-gallery-action="load-more"]').click();
      await new Promise((resolveWait) => requestAnimationFrame(() => requestAnimationFrame(resolveWait)));
      guard += 1;
    }
    return {
      count: cards.length,
      remainder: grid.dataset.posterRemainder,
      bottomDifference: Math.abs(leftBottom - rightBottom),
      categoriesHidden: getComputedStyle(document.querySelector(".gallery-categories")).display === "none",
      final: document.querySelectorAll(".gallery-grid .gallery-item").length,
      exhausted: !document.querySelector('[data-gallery-action="load-more"]')
    };
  });
  if (posterBalance.count !== 6 || posterBalance.bottomDifference > 8 || !posterBalance.categoriesHidden || posterBalance.final !== 22 || !posterBalance.exhausted) issues.push(`mobile poster grid/load-more failed: ${JSON.stringify(posterBalance)}`);

  const decorationResult = await page.evaluate(async () => {
    setMode("edit");
    setViewport("desktop");
    await new Promise((resolveWait) => requestAnimationFrame(() => requestAnimationFrame(resolveWait)));
    const footer = document.querySelector(".gallery-footer");
    footer.scrollIntoView({ block: "center" });
    await new Promise((resolveWait) => requestAnimationFrame(() => requestAnimationFrame(resolveWait)));
    const before = EditorModules.gallery.getContent("gallery").decorations.length;
    document.querySelector('[data-gallery-action="add-decoration"]').click();
    await new Promise((resolveWait) => requestAnimationFrame(() => requestAnimationFrame(resolveWait)));
    const model = EditorModules.gallery.getContent("gallery");
    const added = model.decorations.at(-1);
    const element = document.querySelector(`[data-visual-decoration-id="${added.id}"]`);
    const rect = element.getBoundingClientRect();
    const styleBar = document.querySelector(".gallery-style-bar");
    return {
      countAdded: model.decorations.length === before + 1,
      y: added.layouts.desktop.y,
      nearViewportCenter: Math.abs((rect.top + rect.bottom) / 2 - innerHeight / 2) < 180,
      stickyTools: getComputedStyle(styleBar).position === "sticky",
      modalOpen: !document.getElementById("decorationPickerModal").hidden
    };
  });
  if (!decorationResult.countAdded || decorationResult.y <= 600 || !decorationResult.nearViewportCenter) issues.push(`gallery decoration was not added near the visible section center: ${JSON.stringify(decorationResult)}`);
  if (!decorationResult.stickyTools || !decorationResult.modalOpen) issues.push("gallery tools do not follow scrolling or decoration picker did not open");

  console.log(JSON.stringify({ desktopEditCount, categoryResult, dateResult, cardToolbarResult, imageToolbarResult, heroLayerResult, mobilePagination, mobileCategoryControls, mobileImageToolbar, posterBalance, decorationResult }, null, 2));
} finally {
  await browser.close();
}

if (issues.length) {
  console.error(issues.join("\n"));
  process.exitCode = 1;
} else {
  console.log("gallery editing browser tests OK");
}
