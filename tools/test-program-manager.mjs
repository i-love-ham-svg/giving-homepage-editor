import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const managerPath = path.resolve("outputs/editor-program-manager.js");
const code = fs.readFileSync(managerPath, "utf8");
const editorHtml = fs.readFileSync(path.resolve("outputs/representative-greeting-editor.html"), "utf8");
const context = { structuredClone, window: {} };
vm.createContext(context);
vm.runInContext(code, context, { filename: managerPath });

const manager = context.window.EditorProgramManager;
assert.equal(typeof manager, "object");
assert.equal(manager.isSection("program"), true);
assert.equal(manager.isSection("program3"), true);

const defaults = manager.createDefaultModel();
assert.equal(defaults.textStyles.desktop.headline.size, 48);
assert.equal(defaults.textStyles.phone.description.size, 15);
assert.equal(defaults.textStyles.desktop.monthlyCount.size, 32);
assert.equal(defaults.textStyles.phone.summaryNote.size, 11);
assert.equal(defaults.monthlyLabel, "이번 달 운영 프로그램");
assert.equal(defaults.recruitingLabel, "모집 중 프로그램");
assert.equal(defaults.monthlyIcon, "calendar");
assert.equal(defaults.recruitingIcon, "users");
assert.equal(manager.SUMMARY_ICON_KEYS.includes("heart"), true);
const defaultSummaryCounts = manager.getSummaryCounts(defaults);
assert.equal(defaultSummaryCounts.total, 4);
assert.equal(defaultSummaryCounts.recruiting, 3);

const changedSummary = structuredClone(defaults);
changedSummary.cards[3].status = "모집 중";
changedSummary.cards.push({ ...changedSummary.cards[0], id: "program-card-5" });
const changedSummaryCounts = manager.getSummaryCounts(changedSummary);
assert.equal(changedSummaryCounts.total, 5);
assert.equal(changedSummaryCounts.recruiting, 5);
assert.equal(defaults.categories[0].textStyles.desktop.size, 15);
assert.equal(defaults.categories[0].textStyles.phone.size, 12);

const normalizedDefaultCards = manager.normalizeModel(defaults);
assert.equal(normalizedDefaultCards.cards[0].textStyles.desktop.headline.size, 22);
assert.equal(normalizedDefaultCards.cards[0].textStyles.phone.description.size, 12);
assert.equal(normalizedDefaultCards.cards[0].targetLabel, "대상");
assert.equal(normalizedDefaultCards.cards[0].scheduleLabel, "일정");
assert.equal(normalizedDefaultCards.cards[0].ctaBackground, "#fffdf9");
assert.equal(normalizedDefaultCards.cards[1].ctaBackground, "#8e5735");
assert.equal(normalizedDefaultCards.cards[1].textStyles.desktop.cta.color, "#ffffff");
assert.equal(normalizedDefaultCards.cards[0].textStyles.desktop.targetLabel.size, 13);
assert.equal(manager.getReadableTextColor("#ffffff", "#8e5735"), "#8e5735");
assert.equal(manager.getReadableTextColor("#b47c50", "#8e5735"), "#1d120f");

const normalized = manager.normalizeModel({
  headline: "새 프로그램",
  textStyles: {
    desktop: {
      headline: { size: 61, color: "#123456", font: "serif" }
    },
    phone: {
      description: { size: 19, color: "#654321", font: "rounded" },
      recruitingCount: { size: 31, color: "#ff5500", font: "sans" }
    }
  }
});

assert.equal(normalized.textStyles.desktop.headline.size, 61);
assert.equal(normalized.textStyles.desktop.headline.color, "#123456");
assert.equal(normalized.textStyles.desktop.headline.font, "serif");
assert.equal(normalized.textStyles.phone.description.size, 19);
assert.equal(normalized.textStyles.phone.recruitingCount.size, 31);
assert.equal(normalized.textStyles.phone.recruitingCount.color, "#ff5500");
assert.equal(normalized.textStyles.mobile, normalized.textStyles.phone);
assert.equal(normalized.textStyles.tablet.headline.size, 40);

const restored = manager.normalizeModel(normalized);
assert.equal(restored.textStyles.desktop.headline.size, 61);
assert.equal(restored.textStyles.phone.description.font, "rounded");

const legacyIcons = manager.normalizeModel({ monthlyIcon: "월", recruitingIcon: "중" });
assert.equal(legacyIcons.monthlyIcon, "calendar");
assert.equal(legacyIcons.recruitingIcon, "users");
const invalidIcons = manager.normalizeModel({ monthlyIcon: "없는 아이콘", recruitingIcon: "" });
assert.equal(invalidIcons.monthlyIcon, "calendar");
assert.equal(invalidIcons.recruitingIcon, "users");

const categorized = manager.normalizeModel({
  categories: [
    {
      id: "all",
      label: "모든 프로그램",
      textStyles: {
        desktop: { size: 23, color: "#112233", font: "serif" },
        mobile: { size: 18, color: "#334455", font: "rounded" }
      }
    },
    { id: "education", label: "교육" },
    { id: "care", label: "돌봄" }
  ],
  cards: [
    { id: "card-1", categoryId: "education", headline: "교육 프로그램" },
    { id: "card-2", categoryId: "missing", headline: "분류 복구 프로그램" },
    { id: "card-3", categoryId: "all", headline: "전체 분류 복구 프로그램" }
  ]
});
assert.equal(categorized.categories[0].label, "모든 프로그램");
assert.equal(categorized.categories[0].textStyles.desktop.size, 23);
assert.equal(categorized.categories[0].textStyles.desktop.color, "#112233");
assert.equal(categorized.categories[0].textStyles.phone.size, 18);
assert.equal(categorized.categories[0].textStyles.mobile, categorized.categories[0].textStyles.phone);
assert.equal(categorized.cards[0].categoryId, "education");
assert.equal(categorized.cards[1].categoryId, "education");
assert.equal(categorized.cards[2].categoryId, "education");

const styledCard = manager.normalizeModel({
  categories: [{ id: "all", label: "전체" }, { id: "education", label: "교육" }],
  cards: [{
    id: "styled-card",
    categoryId: "education",
    targetLabel: "참여 대상",
    scheduleLabel: "운영 시간",
    ctaBackground: "#123456",
    image: { name: "sample.png", dataUrl: "data:image/png;base64,AA==", naturalWidth: 10, naturalHeight: 20 },
    textStyles: { phone: { headline: { size: 33, color: "#123456", font: "serif" } } }
  }]
});
assert.equal(styledCard.cards[0].image.name, "sample.png");
assert.equal(styledCard.cards[0].targetLabel, "참여 대상");
assert.equal(styledCard.cards[0].scheduleLabel, "운영 시간");
assert.equal(styledCard.cards[0].ctaBackground, "#123456");
assert.equal(styledCard.cards[0].textStyles.phone.headline.size, 33);
assert.equal(styledCard.cards[0].textStyles.phone.headline.color, "#123456");

assert.match(editorHtml, /bindProgramImageInputs\(sectionId\);/);
assert.match(editorHtml, /input\.addEventListener\("change", \(\) => handleProgramImageInput\(sectionId, input\)\)/);
assert.match(editorHtml, /data-card-field="targetLabel"/);
assert.match(editorHtml, /data-card-field="scheduleLabel"/);
assert.match(editorHtml, /id="inlineCtaBackgroundInput"/);
assert.match(editorHtml, /\.program-card-image img\s*\{[^}]*object-fit:\s*contain/s);

const missingAllCategory = manager.normalizeModel({
  categories: [{ id: "education", label: "교육" }],
  cards: []
});
assert.equal(missingAllCategory.categories[0].id, "all");
assert.equal(missingAllCategory.categories[0].textStyles.tablet.size, 14);

console.log("program manager tests OK");
