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

async function exerciseCategoryToolbar(type) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", (error) => issues.push(`${type}: ${error.message}`));
  await page.goto(`${editorUrl}?viewport=desktop&mode=edit&previewSection=${type}`, { waitUntil: "commit" });
  await page.waitForSelector(`.${type === "program" ? "program" : "gallery"}-section-layer:not([hidden])`);
  await page.waitForTimeout(300);

  const before = await page.evaluate((sectionType) => {
    if (sectionType === "program") {
      const model = EditorModules.program.getContent("program");
      const category = model.categories.find((entry) => entry.id !== "all");
      selectProgramCategoryField("program", category.id);
      return { categoryId: category.id, count: model.categories.length, index: model.categories.findIndex((entry) => entry.id === category.id) };
    }
    const model = EditorModules.gallery.getContent("gallery");
    const category = model.categories.find((entry) => entry.id !== "all");
    selectGalleryCategoryField("gallery", category.id);
    return { categoryId: category.id, count: model.categories.length, index: model.categories.findIndex((entry) => entry.id === category.id) };
  }, type);
  await page.waitForTimeout(120);

  const expectedLabels = type === "program"
    ? ["\uBCF4\uAE30", "+ \uBD84\uC57C \uCD94\uAC00", "\u00D7 \uBD84\uC57C \uC0AD\uC81C"]
    : ["\uBCF4\uAE30", "+ \uBD84\uB958 \uCD94\uAC00", "\u00D7 \uBD84\uB958 \uC0AD\uC81C"];
  const toolbar = await page.evaluate(() => {
    const buttons = [
      document.getElementById("inlineCategoryViewBtn"),
      document.getElementById("inlineGalleryCategoryAddBtn"),
      document.getElementById("inlineGalleryCategoryDeleteBtn")
    ];
    return {
      labels: buttons.map((button) => button?.textContent.trim()),
      visible: buttons.every((button) => button && !button.hidden),
      expanded: !state.toolbar.collapsed && !document.getElementById("inlineToolbar").hidden
    };
  });
  if (!toolbar.visible || !toolbar.expanded) issues.push(`${type}: category toolbar buttons are not visible`);
  if (type === "program") {
    const inlineControls = await page.locator(".program-category-view, .program-category-delete, .program-category-add").count();
    const editableNames = await page.locator('[data-category-field="label"]').count();
    if (inlineControls !== 0) issues.push("program: duplicate view/delete/add controls remain inside category tabs");
    if (editableNames !== before.count) issues.push("program: category name fields are missing in edit mode");
  }
  if (toolbar.labels.join("|") !== expectedLabels.join("|")) {
    issues.push(`${type}: category toolbar labels are incorrect (${toolbar.labels.join("|")})`);
  }

  await page.locator("#inlineCategoryViewBtn").click();
  const viewed = await page.evaluate((sectionType) => sectionType === "program"
    ? EditorModules.program.getContent("program").activeCategoryId
    : EditorModules.gallery.getContent("gallery").activeCategoryId, type);
  if (viewed !== before.categoryId) issues.push(`${type}: view command did not activate the selected category`);
  const viewState = await page.locator("#inlineCategoryViewBtn").evaluate((button) => ({ active: button.classList.contains("active"), pressed: button.getAttribute("aria-pressed") }));
  if (!viewState.active || viewState.pressed !== "true") issues.push(`${type}: view button did not show the active category state`);

  await page.locator("#inlineGalleryCategoryAddBtn").click();
  const afterAdd = await page.evaluate((sectionType) => {
    const model = sectionType === "program"
      ? EditorModules.program.getContent("program")
      : EditorModules.gallery.getContent("gallery");
    const selected = sectionType === "program" ? getSelectedProgramCategory() : getSelectedGalleryField();
    return {
      count: model.categories.length,
      selectedId: selected?.categoryId,
      index: model.categories.findIndex((category) => category.id === selected?.categoryId)
    };
  }, type);
  if (afterAdd.count !== before.count + 1) issues.push(`${type}: add command did not add one category`);
  if (afterAdd.index !== before.index + 1) issues.push(`${type}: new category was not inserted immediately after the selected category`);

  await page.locator("#inlineGalleryCategoryDeleteBtn").click();
  const afterDelete = await page.evaluate((sectionType) => sectionType === "program"
    ? EditorModules.program.getContent("program").categories.length
    : EditorModules.gallery.getContent("gallery").categories.length, type);
  if (afterDelete !== before.count) issues.push(`${type}: delete command did not remove the added category`);

  await page.evaluate(({ sectionType, categoryId }) => {
    if (sectionType === "program") selectProgramCategoryField("program", categoryId);
    else selectGalleryCategoryField("gallery", categoryId);
  }, { sectionType: type, categoryId: before.categoryId });
  await page.waitForTimeout(550);
  await page.evaluate(() => window.dispatchEvent(new Event("scroll")));
  await page.waitForTimeout(120);
  const collapsed = await page.evaluate(() => ({
    state: state.toolbar.collapsed,
    toolbarHidden: document.getElementById("inlineToolbar").hidden,
    floatVisible: !document.getElementById("inlineToolbarFloat").hidden
  }));
  if (!collapsed.state || !collapsed.toolbarHidden || !collapsed.floatVisible) {
    issues.push(`${type}: category toolbar did not collapse to the floating button after scrolling`);
  }

  await page.close();
  return { before, toolbar, viewed, afterAdd, afterDelete, collapsed };
}

try {
  const results = {
    program: await exerciseCategoryToolbar("program"),
    gallery: await exerciseCategoryToolbar("gallery")
  };
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}

if (issues.length) {
  console.error(issues.join("\n"));
  process.exitCode = 1;
} else {
  console.log("category toolbar browser tests OK");
}
