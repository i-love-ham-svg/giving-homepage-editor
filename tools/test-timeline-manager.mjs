import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const managerPath = resolve("outputs", "editor-timeline-manager.js");
const source = readFileSync(managerPath, "utf8");
const editorSource = readFileSync(resolve("outputs", "representative-greeting-editor.html"), "utf8");
const context = { structuredClone, window: {} };

vm.createContext(context);
vm.runInContext(source, context, { filename: managerPath });

const manager = context.window.EditorTimelineManager;
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };

assert(manager.isSection("history"), "base history section id should be valid");
assert(manager.isSection("history3"), "duplicated history section id should be valid");
assert(!manager.isSection("process"), "process should not be a history section");

const model = manager.createDefaultModel();
const normalizedImageEvent = manager.normalizeModel({ groups: [{ id: "g", events: [{ id: "e", image: { dataUrl: "./assets/generated/example.png", fit: "cover", scale: 1.8, opacity: 52 } }] }] }).groups[0].events[0];
assert(normalizedImageEvent.image.fit === "cover", "history image fit should persist");
assert(normalizedImageEvent.image.scale === 1.8, "history image scale should persist");
assert(normalizedImageEvent.image.opacity === 52, "history image opacity should persist");
assert(model.groups.length === 4, "default history should have four month groups");
assert(model.groups[0].events.length === 3 && model.groups[1].events.length === 3, "2026 official groups should include the added agreements");
assert(model.groups.slice(2).every((group) => group.events.length === 2), "archive groups should preserve their two events");
assert(model.textStyles.phone.headline.size > 0, "phone headline style should exist");
assert(model.ctaButton === "전체 연혁 보기", "default history CTA button copy should exist");
assert(manager.VIEWPORTS.every((viewport) => model.textStyles[viewport].ctaButton.size > 0), "history CTA button styles should exist in every viewport");
const customCta = manager.normalizeModel({ groups: [], ctaButton: "전체 기록 확인", textStyles: { desktop: { ctaButton: { size: 23, color: "#123456", font: "rounded" } } } });
assert(customCta.ctaButton === "전체 기록 확인", "history CTA button copy should survive normalization");
assert(customCta.textStyles.desktop.ctaButton.size === 23, "history CTA button style should survive normalization");
assert(model.groups[0].events[0].textStyles.desktop.title.size > 0, "event text styles should be independent");
assert(model.groups.flatMap((group) => group.events).every((event) => event.image?.dataUrl?.startsWith("./assets/concept/")), "official history defaults should use disclosed concept assets");
assert(model.groups.flatMap((group) => group.events).every((event) => event.image?.alt?.includes("콘셉트 이미지")), "history concept images should retain disclosure alt text");
assert(Object.keys(manager.ICONS).length >= 8, "history icon library should offer useful choices");

const colored = manager.normalizeModel({ groups: [{ periodColor: "#123abc", events: [{}] }] });
assert(colored.groups[0].periodColor === "#123abc", "month title background color should be preserved");
const unsafeColor = manager.normalizeModel({ groups: [{ periodColor: "red;position:fixed", events: [{}] }] });
assert(unsafeColor.groups[0].periodColor === "", "invalid month title background color should be rejected");

const addedGroup = manager.addGroup(model);
assert(addedGroup.groups.length === 5, "addGroup should append a month group");
assert(model.groups.length === 4, "addGroup should not mutate the source model");

const groupId = model.groups[0].id;
const addedEvent = manager.addEvent(model, groupId);
assert(addedEvent.groups[0].events.length === 4, "addEvent should append an event to its group");
const removedEvent = manager.removeEvent(addedEvent, groupId, addedEvent.groups[0].events[0].id);
assert(removedEvent.groups[0].events.length === 3, "removeEvent should remove the selected event");

const moved = manager.moveItem(model.groups, model.groups[3].id, "up");
assert(moved[2].id === model.groups[3].id, "moveItem should reorder month groups");

const uneven = manager.addEvent(manager.addEvent(model, model.groups[0].id), model.groups[0].id);
const distribution = manager.distributeGroups(uneven.groups);
assert(distribution.columns.flat().length === uneven.groups.length, "desktop distribution should contain every month group");
assert(new Set(distribution.columns.flat()).size === uneven.groups.length, "desktop distribution should not duplicate month groups");

const paginationSource = [
  { id: "month-a", events: Array.from({ length: 6 }, (_, index) => ({ id: `event-a-${index}` })) },
  { id: "month-b", events: Array.from({ length: 14 }, (_, index) => ({ id: `event-b-${index}` })) }
];
const firstHistoryPage = manager.paginateGroups(paginationSource, 8);
assert(firstHistoryPage.total === 20, "pagination should count every history event");
assert(firstHistoryPage.visibleCount === 8 && firstHistoryPage.hasMore, "first history page should expose eight events");
assert(firstHistoryPage.groups[0].events.length === 6 && firstHistoryPage.groups[1].events.length === 2, "pagination should preserve month boundaries while slicing events");
const secondHistoryPage = manager.paginateGroups(paginationSource, 16);
assert(secondHistoryPage.visibleCount === 16 && secondHistoryPage.hasMore, "the second history page should expose sixteen events");
const finalHistoryPage = manager.paginateGroups(paginationSource, 24);
assert(finalHistoryPage.visibleCount === 20 && !finalHistoryPage.hasMore, "the final page should reveal all remaining events");

const fewer = manager.removeGroup(model, model.groups[0].id);
assert(fewer.groups.length === 3, "removeGroup should remove the selected month group");
assert(manager.estimateHeight(model, "phone") > manager.estimateHeight(fewer, "phone"), "fewer groups should reduce mobile height");
assert(manager.estimateHeight(model, "phone") > manager.estimateHeight(model, "desktop"), "mobile history should reserve stacked-card height");

assert(/data-history-field="ctaButton"[^>]*>\$\{escapeHtml\(model\.ctaButton\)\}<\/textarea>/.test(editorSource), "history editor should expose the CTA button through the existing section field contract");
assert(/data-history-action="show-all"[^>]*data-history-display-field="ctaButton"[^>]*>\$\{escapeHtml\(model\.ctaButton\)\}<\/button>/.test(editorSource), "history public view should retain an actionable CTA button");
assert(/if \(action === "show-all"\)[\s\S]*?historyVisibleCounts\.set\(sectionId, total\);[\s\S]*?renderHistorySection\(sectionId\);/.test(editorSource), "history CTA should reveal the full archive in place");
assert(/ctaButton:\s*"하단 버튼 문구"/.test(editorSource), "history CTA button should have an inline-toolbar label");
assert(/\["eyebrow", "headline", "archiveLabel", "description", "ctaTitle", "ctaDescription", "ctaButton"\]\.forEach[\s\S]*?data-history-display-field/.test(editorSource), "history edit and public CTA should receive the same viewport text style");
assert(/if \(event\.target\.dataset\.historyField\) model\[event\.target\.dataset\.historyField\] = event\.target\.value;/.test(editorSource), "history CTA button should reuse the existing save/history input path");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("timeline manager tests OK");
}
