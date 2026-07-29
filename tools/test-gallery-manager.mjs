import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const managerPath = path.resolve("outputs/editor-gallery-manager.js");
const code = fs.readFileSync(managerPath, "utf8");
const editorHtml = fs.readFileSync(path.resolve("outputs/representative-greeting-editor.html"), "utf8");
const context = { structuredClone, window: {} };
vm.createContext(context);
vm.runInContext(code, context, { filename: managerPath });

const manager = context.window.EditorGalleryManager;
assert.equal(typeof manager, "object");
assert.equal(manager.isSection("gallery"), true);
assert.equal(manager.isSection("gallery12"), true);
assert.equal(manager.DESKTOP_STYLES.length, 7);
assert.deepEqual(Array.from(manager.DESKTOP_STYLES, (style) => style.featuredCount), [6, 4, 3, 1, 5, 5, 5]);
assert.equal(manager.MOBILE_STYLES.length, 5);

const defaults = manager.createDefaultModel();
assert.equal(defaults.desktopStyle, "mosaic");
assert.equal(manager.getFeaturedCount(defaults), 6);
assert.equal(manager.getFeaturedCount({ desktopStyle: "focus" }), 1);
assert.equal(manager.getFeaturedCount({ desktopStyle: "tape-pink" }), 5);
assert.equal(manager.getFeaturedCount({ desktopStyle: "tape-nature" }), 5);
assert.equal(manager.getFeaturedCount({ desktopStyle: "tape-yellow" }), 5);
assert.equal(defaults.mobileStyle, "poster");
assert.equal(defaults.categories.length, 5);
assert.equal(defaults.items.length, 6);
assert.deepEqual(Array.from(defaults.heroOrder), Array.from(defaults.items, (item) => item.id));
assert.equal(defaults.decorations.length, 5);
assert.equal(defaults.textStyles.desktop.headline.size, 42);
assert.equal(defaults.customTexts.length, 0);
assert.equal(defaults.decorations[0].layouts.desktop.x, 34);
assert.equal(defaults.decorations[0].rotation, -14);
assert.equal(defaults.showMonthLabel, true);
assert.deepEqual(Object.keys(defaults.items[0].heroLayouts), ["desktop", "phoneSmall", "phone", "tablet"]);
assert.deepEqual({ ...defaults.items[0].heroLayouts.desktop }, { x: 0, y: 0, scale: 1, rotation: 0 });
assert.deepEqual(Array.from(manager.BASE_TEXT_FIELDS), ["eyebrow", "headline", "description"]);
assert.deepEqual(Array.from(Object.keys(defaults.baseTextBoxes.headline.layouts)), ["desktop", "phoneSmall", "phone", "tablet"]);
assert.deepEqual({ ...defaults.baseTextBoxes.eyebrow.layouts.desktop }, { x: 2, y: 24, w: 30, h: 8, manualSize: false });
assert.deepEqual({ ...defaults.baseTextBoxes.headline.layouts.phone }, { x: 4, y: 12, w: 90, h: 40, manualSize: false });

const normalized = manager.normalizeModel({
  desktopStyle: "collage",
  mobileStyle: "journal",
  activeCategoryId: "education",
  categories: [
    { id: "all", label: "전체" },
    { id: "education", label: "교육 활동" }
  ],
  items: [{
    id: "photo-1",
    categoryId: "education",
    title: "환경 수업",
    image: { name: "lesson.png", dataUrl: "data:image/png;base64,AA==", naturalWidth: 400, naturalHeight: 300 },
    heroLayouts: {
      desktop: { x: 42, y: -18, scale: 1.4, rotation: 12 },
      phone: { x: -11, y: 25, scale: .72, rotation: -7 }
    }
  }]
});
assert.equal(normalized.desktopStyle, "collage");
assert.equal(normalized.mobileStyle, "journal");
assert.equal(normalized.items[0].image.name, "lesson.png");
assert.deepEqual({ ...normalized.items[0].heroLayouts.desktop }, { x: 42, y: -18, scale: 1.4, rotation: 12 });
assert.deepEqual({ ...normalized.items[0].heroLayouts.phone }, { x: -11, y: 25, scale: .72, rotation: -7 });
assert.deepEqual({ ...normalized.items[0].heroLayouts.tablet }, { x: 0, y: 0, scale: 1, rotation: 0 });
assert.equal(manager.getVisibleItems(normalized).length, 1);
const baseTextLayoutNormalized = manager.normalizeModel({
  ...defaults,
  baseTextBoxes: {
    headline: { layouts: { desktop: { x: 94, y: 95, w: 80, h: 50, manualSize: true } } }
  }
});
assert.deepEqual(
  { ...baseTextLayoutNormalized.baseTextBoxes.headline.layouts.desktop },
  { x: 94, y: 95, w: 6, h: 5, manualSize: true }
);
assert.deepEqual(
  { ...baseTextLayoutNormalized.baseTextBoxes.headline.layouts.phone },
  { x: 4, y: 12, w: 90, h: 40, manualSize: false }
);

const normalizedTags = manager.normalizeModel({
  ...defaults,
  items: [{ ...defaults.items[0], tag: "#환경, #함께 #교육 #초과" }]
});
assert.equal(normalizedTags.items[0].tag, "#환경 #함께 #교육");
const editableLabels = manager.normalizeModel({
  ...defaults,
  showMonthLabel: false,
  monthLabel: "상시 운영",
  items: [{
    ...defaults.items[0],
    date: "접수 중",
    showDate: false,
    textStyles: { desktop: { title: { size: 31, color: "#123456", font: "sans" } } }
  }],
  decorations: [{
    ...defaults.decorations[0],
    layouts: { ...defaults.decorations[0].layouts, desktop: { x: 42, y: 1450 } }
  }]
});
assert.equal(editableLabels.showMonthLabel, false);
assert.equal(editableLabels.monthLabel, "상시 운영");
assert.equal(editableLabels.items[0].date, "접수 중");
assert.equal(editableLabels.items[0].showDate, false);
assert.equal(editableLabels.items[0].textStyles.desktop.title.size, 31);
assert.equal(editableLabels.decorations[0].layouts.desktop.y, 1450);

const added = manager.addItem(defaults);
assert.equal(added.items.length, 7);
assert.equal(added.heroOrder.at(-1), added.items.at(-1).id);
assert.equal(added.activeCategoryId, "all");
const insertedAfterFirst = manager.addItem(defaults, defaults.items[0].id);
assert.equal(insertedAfterFirst.items.length, 7);
assert.equal(insertedAfterFirst.items[0].id, defaults.items[0].id);
assert.equal(insertedAfterFirst.items[1].id.startsWith("gallery-item-"), true);
assert.equal(defaults.items.some((item) => item.id === insertedAfterFirst.items[1].id), false);
assert.equal(insertedAfterFirst.heroOrder.indexOf(insertedAfterFirst.items[1].id), insertedAfterFirst.heroOrder.indexOf(defaults.items[0].id) + 1);
const removed = manager.removeItem(added, added.items.at(-1).id);
assert.equal(removed.items.length, 6);
assert.equal(removed.heroOrder.includes(added.items.at(-1).id), false);
const movedHero = manager.moveHeroLayer(defaults, defaults.items[0].id, "front");
assert.equal(movedHero.heroOrder.at(5), defaults.items[0].id);
const movedHeroBack = manager.moveHeroLayer(movedHero, defaults.items[0].id, "back");
assert.equal(movedHeroBack.heroOrder[0], defaults.items[0].id);

const textAdded = manager.addTextBox(defaults);
assert.equal(textAdded.customTexts.length, 1);
assert.equal(textAdded.customTexts[0].text, "새 텍스트");
assert.equal(textAdded.customTexts[0].styles.desktop.size, 20);
assert.deepEqual(Object.keys(textAdded.customTexts[0].layouts), ["desktop", "phoneSmall", "phone", "tablet"]);
assert.deepEqual(
  { ...textAdded.customTexts[0].layouts.desktop },
  { x: 2, y: 64, w: 30, h: 14, manualSize: false }
);
const customTextLayoutNormalized = manager.normalizeModel({
  ...defaults,
  customTexts: [{
    id: "gallery-text-8",
    text: "크기 조절",
    layouts: {
      desktop: { x: 92, y: 94, w: 80, h: 60, manualSize: true },
      phone: { x: 12, y: 22, w: 66, h: 28 }
    }
  }]
});
assert.deepEqual(
  { ...customTextLayoutNormalized.customTexts[0].layouts.desktop },
  { x: 92, y: 94, w: 8, h: 6, manualSize: true }
);
assert.deepEqual(
  { ...customTextLayoutNormalized.customTexts[0].layouts.phone },
  { x: 12, y: 22, w: 66, h: 28, manualSize: false }
);
const textRemoved = manager.removeTextBox(textAdded, textAdded.customTexts[0].id);
assert.equal(textRemoved.customTexts.length, 0);

const categoryAdded = manager.addCategory(defaults);
const addedCategory = categoryAdded.categories.at(-1);
assert.equal(categoryAdded.categories.length, defaults.categories.length + 1);
assert.equal(categoryAdded.activeCategoryId, "all");
const insertAfterId = defaults.categories.find((category) => category.id !== "all").id;
const insertedCategory = manager.addCategory(defaults, "\uC120\uD0DD \uB2E4\uC74C \uBD84\uB958", insertAfterId);
const insertAfterIndex = insertedCategory.categories.findIndex((category) => category.id === insertAfterId);
assert.equal(insertedCategory.categories[insertAfterIndex + 1].label, "\uC120\uD0DD \uB2E4\uC74C \uBD84\uB958");

const categoryRenamed = manager.renameCategory(categoryAdded, addedCategory.id, "새 활동 분야");
assert.equal(categoryRenamed.categories.at(-1).label, "새 활동 분야");
categoryRenamed.items[0].categoryId = addedCategory.id;
const categoryRemoved = manager.removeCategory(categoryRenamed, addedCategory.id);
assert.equal(categoryRemoved.categories.length, defaults.categories.length);
assert.equal(categoryRemoved.categories.some((category) => category.id === addedCategory.id), false);
assert.notEqual(categoryRemoved.items[0].categoryId, addedCategory.id);
const finalAssignable = manager.normalizeModel({ ...defaults, categories: [{ id: "all", label: "전체" }, { id: "only", label: "유일" }] });
assert.equal(manager.removeCategory(finalAssignable, "only").categories.length, 2);

const decorationAdded = manager.addDecoration(defaults, "desktop");
assert.equal(decorationAdded.decorations.length, 6);
const addedDecoration = decorationAdded.decorations.at(-1);
assert.equal(addedDecoration.layouts.desktop.x >= 2, true);
const decorationRemoved = manager.removeDecoration(decorationAdded, addedDecoration.id);
assert.equal(decorationRemoved.decorations.length, 5);
const zeroRotation = manager.normalizeModel({
  ...defaults,
  decorations: [{ id: "zero", icon: "heart", style: "plain", x: 50, y: 80, size: 40, rotation: 0 }]
});
assert.equal(zeroRotation.decorations[0].rotation, 0);
assert.ok(manager.estimateHeight(defaults, "desktop") > 600);
assert.ok(manager.estimateHeight({ ...defaults, mobileStyle: "journal" }, "phone") > 1000);

assert.match(editorHtml, /editor-gallery-manager\.js/);
assert.match(editorHtml, /data-gallery-setting="desktopStyle"/);
assert.match(editorHtml, /data-gallery-setting="mobileStyle"/);
assert.match(editorHtml, /data-gallery-action="add-item"/);
assert.match(editorHtml, /data-gallery-category-field="label"/);
assert.match(editorHtml, /id="inlineGalleryCategoryAddBtn"/);
assert.match(editorHtml, /id="inlineGalleryCategoryDeleteBtn"/);
assert.ok(manager.TEXT_DEFAULTS.desktop.categoryLabel);
assert.match(editorHtml, /section\.type === "gallery"/);

console.log("gallery manager tests OK");
