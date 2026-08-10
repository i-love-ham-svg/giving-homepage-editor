import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../outputs/editor-essential-manager.js", import.meta.url), "utf8");
const context = { window: {}, structuredClone };
vm.createContext(context);
vm.runInContext(source, context);

const manager = context.window.EditorEssentialManager;
assert.ok(manager);
assert.equal(manager.BASE_SECTION_IDS.length, 7);
assert.equal(manager.isSection("facility"), true);
assert.equal(manager.isSection("essential3"), true);
assert.equal(manager.isSection("program"), false);
assert.equal(manager.isBaseSection("footer"), true);
assert.deepEqual(Array.from(manager.FOOTER_LAYOUTS), ["info", "simple", "compact", "split"]);

for (const template of manager.BASE_SECTION_IDS) {
  const model = manager.createDefaultModel(template);
  assert.equal(model.template, template);
  assert.ok(model.label.length > 0);
  assert.ok(model.headline.length > 0);
  assert.ok(model.items.length > 0);
  assert.equal(model.textStyles.desktop.headline.font, "serif");
  assert.ok(model.textStyles.desktop.headline.size >= 28);
  assert.equal(model.items[0].textStyles.desktop.title.font, "sans");
  assert.ok(model.desktopFirstRowCount >= 1 && model.desktopFirstRowCount <= 4);
  if (model.details.length) assert.equal(model.details[0].textStyles.desktop.value.font, "sans");
  assert.ok(manager.estimateHeight(model, "desktop") >= (template === "footer" ? 300 : 430));
  assert.ok(manager.estimateHeight(model, "phone") >= manager.estimateHeight(model, "desktop") || template === "footer");
}

const facility = manager.createDefaultModel("facility");
assert.equal(facility.layoutStyle, "info");
assert.deepEqual(Array.from(manager.getBalancedRowSizes(4, 3)), [3, 1]);
assert.deepEqual(Array.from(manager.getBalancedRowSizes(5, 3)), [3, 2]);
assert.deepEqual(Array.from(manager.getBalancedRowSizes(7, 3)), [3, 2, 2]);
assert.deepEqual(Array.from(manager.getBalancedRowSizes(4, 1)), [1, 3]);
assert.equal(manager.getBalancedItemLayout(4, 3)[3].rowSize, 1);
const addedItem = manager.addItem(facility, facility.items[0].id);
assert.equal(addedItem.items.length, facility.items.length + 1);
assert.equal(facility.items.length, 5);
const movedItems = manager.moveItem(addedItem.items, addedItem.items[1].id, "down");
assert.equal(movedItems[2].id, addedItem.items[1].id);
const removedItem = manager.removeItem(addedItem, addedItem.items[0].id);
assert.equal(removedItem.items.length, facility.items.length);

const location = manager.createDefaultModel("location");
const addedDetail = manager.addDetail(location, location.details[0].id);
assert.equal(addedDetail.details.length, location.details.length + 1);
const removedDetail = manager.removeDetail(addedDetail, addedDetail.details[1].id);
assert.equal(removedDetail.details.length, location.details.length);

const footer = manager.createDefaultModel("footer");
assert.equal(footer.layoutStyle, "split");
assert.deepEqual(JSON.parse(JSON.stringify(footer.footerLayoutControls)), {
  desktop: { columns: 2, scale: 100 },
  phoneSmall: { columns: 1, scale: 100 },
  phone: { columns: 1, scale: 100 },
  tablet: { columns: 2, scale: 100 },
  mobile: { columns: 1, scale: 100 }
});
assert.deepEqual(Array.from(footer.items, (item) => item.documentKey), ["privacy", "email", "directions"]);
assert.deepEqual(JSON.parse(JSON.stringify(footer.items[0].textStyleOverrides)), {
  desktop: {},
  phoneSmall: {},
  phone: {},
  tablet: {}
});
const footerWithMobileTitleOverride = manager.normalizeModel({
  ...footer,
  items: footer.items.map((item, index) => index === 0 ? {
    ...item,
    textStyleOverrides: { phone: { title: true }, phoneSmall: { title: false } },
    textStyles: {
      ...item.textStyles,
      phone: { ...item.textStyles.phone, title: { ...item.textStyles.phone.title, size: 13 } }
    }
  } : item)
}, "footer");
assert.equal(footerWithMobileTitleOverride.items[0].textStyleOverrides.phone.title, true);
assert.equal(footerWithMobileTitleOverride.items[0].textStyleOverrides.phoneSmall.title, false);
assert.equal(footerWithMobileTitleOverride.items[0].textStyles.phone.title.size, 13);
assert.deepEqual(Object.keys(footer.footerDocuments), ["privacy", "email", "directions"]);
assert.equal(footer.footerDocuments.privacy.effectiveDate, "2021-06-22");
assert.match(footer.footerDocuments.privacy.content, /개인정보의 처리 목적/);
assert.match(footer.footerDocuments.email.content, /무단으로 수집/);
assert.match(footer.footerDocuments.directions.content, /송악로 656/);
const editedFooterDocument = manager.normalizeModel({
  ...footer,
  footerDocuments: { ...footer.footerDocuments, privacy: { ...footer.footerDocuments.privacy, officer: "담당자 수정" } }
}, "footer");
assert.equal(editedFooterDocument.footerDocuments.privacy.officer, "담당자 수정");
for (const layoutStyle of manager.FOOTER_LAYOUTS) {
  const footerVariant = manager.normalizeModel({ ...footer, layoutStyle }, "footer");
  assert.equal(footerVariant.layoutStyle, layoutStyle);
  assert.ok(manager.estimateHeight(footerVariant, "desktop") >= 300);
}
assert.equal(manager.normalizeModel({ ...footer, layoutStyle: "unknown" }, "footer").layoutStyle, "split");
const normalizedFooterControls = manager.normalizeModel({
  ...footer,
  footerLayoutControls: {
    desktop: { columns: 9, scale: 160 },
    tablet: { columns: 3, scale: 90 },
    mobile: { columns: 2, scale: 85 },
    phoneSmall: { columns: 0, scale: 20 }
  }
}, "footer").footerLayoutControls;
assert.deepEqual(JSON.parse(JSON.stringify(normalizedFooterControls.desktop)), { columns: 4, scale: 130 });
assert.deepEqual(JSON.parse(JSON.stringify(normalizedFooterControls.tablet)), { columns: 3, scale: 90 });
assert.deepEqual(JSON.parse(JSON.stringify(normalizedFooterControls.phone)), { columns: 1, scale: 85 });
assert.deepEqual(JSON.parse(JSON.stringify(normalizedFooterControls.phoneSmall)), { columns: 1, scale: 80 });

const normalized = manager.normalizeModel({ template: "notice", items: [], details: [], headline: "직접 입력" });
assert.equal(normalized.template, "notice");
assert.equal(normalized.headline, "직접 입력");
assert.equal(normalized.items.length, 0);

const facilityDetailSelector = manager.normalizeModel({
  template: "facility",
  facilityDetailKind: "selector",
  facilityDetailSizingVersion: 2,
  facilityDetailSelectedItemId: "floor-2f",
  items: [
    { id: "floor-1f", badge: "1F", title: "1층" },
    { id: "floor-2f", badge: "2F", title: "2층" }
  ],
  details: []
});
assert.equal(facilityDetailSelector.facilityDetailKind, "selector");
assert.equal(facilityDetailSelector.facilityDetailSizingVersion, 2);
assert.equal(facilityDetailSelector.facilityDetailSelectedItemId, "floor-2f");
assert.equal(facilityDetailSelector.items[0].imageFit, "cover");
assert.equal(facilityDetailSelector.items[0].imageScale, 1);
assert.equal(facilityDetailSelector.items[0].imageOpacity, 100);
const facilityImagePresentation = manager.normalizeModel({
  template: "facility",
  facilityDetailKind: "selector",
  items: [{ id: "floor-photo", imageUrl: "data:image/png;base64,AA==", imageFit: "contain", imageScale: 2.2, imageOpacity: 45 }],
  details: []
});
assert.equal(facilityImagePresentation.items[0].imageFit, "contain");
assert.equal(facilityImagePresentation.items[0].imageScale, 2.2);
assert.equal(facilityImagePresentation.items[0].imageOpacity, 45);
const facilityDetailAfterDelete = manager.removeItem(facilityDetailSelector, "floor-2f");
assert.equal(facilityDetailAfterDelete.facilityDetailSelectedItemId, "floor-1f");
assert.equal(manager.normalizeModel({ template: "facility", facilityDetailKind: "unknown" }).facilityDetailKind, "");

const notice = manager.createDefaultModel("notice");
assert.equal(notice.items.length, 10);
assert.equal(notice.items[0].id, "notice-official-1549");
assert.equal(notice.items[9].id, "notice-official-1532");
assert.ok(notice.items.some((item) => item.detailBlocks.some((block) => block.type === "table")));
assert.ok(notice.items.some((item) => item.detailBlocks.some((block) => block.type === "attachment")));
assert.ok(notice.items.some((item) => item.detailBlocks.some((block) => block.type === "image")));
assert.ok(notice.items[0].detailContent.length > 0);
assert.equal(notice.items[0].detailBlocks[0].type, "paragraph");
assert.equal(notice.items[0].detailBlocks[0].text, notice.items[0].detailContent);
const legacyNotice = manager.normalizeModel({
  template: "notice",
  items: [{ id: "legacy-notice", title: "기존 공지", description: "기존 요약" }]
});
assert.equal(legacyNotice.items[0].detailContent, "기존 요약");
const detailedNotice = manager.normalizeModel({
  template: "notice",
  items: [{ id: "detailed-notice", title: "상세 공지", description: "요약", detailContent: "첫째 줄\n둘째 줄" }]
});
assert.equal(detailedNotice.items[0].detailContent, "첫째 줄\n둘째 줄");
assert.equal(detailedNotice.items[0].detailBlocks[0].text, "첫째 줄\n둘째 줄");

const richNotice = manager.normalizeModel({
  template: "notice",
  items: [{
    id: "rich-notice",
    title: "블록 공지",
    detailBlocks: [
      { id: "block-1", type: "heading", text: "세부 제목" },
      { id: "block-2", type: "highlight", text: "중요 안내" },
      { id: "block-3", type: "image", caption: "현장 사진", media: { type: "image/png", url: "/board-media/image-1", name: "photo.png" } },
      { id: "block-4", type: "video", caption: "안내 영상", media: { type: "video/mp4", url: "/board-media/video-1", name: "guide.mp4" } }
    ]
  }]
});
assert.deepEqual(Array.from(richNotice.items[0].detailBlocks, (block) => block.type), ["heading", "highlight", "image", "video"]);
assert.equal(richNotice.items[0].detailBlocks[2].media.url, "/board-media/image-1");
assert.equal(richNotice.items[0].detailBlocks[3].media.kind, "video");
assert.equal(manager.normalizeNoticeMedia({ url: "javascript:alert(1)" }).url, "");
assert.equal(manager.normalizeNoticeMedia({ url: "./assets/official-sacwc/facility-floor-guide.png" }).url, "./assets/official-sacwc/facility-floor-guide.png");
assert.equal(manager.normalizeNoticeBlock({ type: "unknown", text: "안전한 본문" }).type, "paragraph");
const styledNoticeBlock = manager.normalizeNoticeBlock({
  type: "highlight",
  text: "스타일 강조",
  fontSize: 31,
  color: "#ABCDEF",
  font: "rounded",
  textAlign: "right",
  linkUrl: "https://www.sacwc.kr/"
});
assert.equal(styledNoticeBlock.fontSize, 31);
assert.equal(styledNoticeBlock.color, "#abcdef");
assert.equal(styledNoticeBlock.font, "rounded");
assert.equal(styledNoticeBlock.textAlign, "right");
assert.equal(styledNoticeBlock.linkUrl, "https://www.sacwc.kr/");
const tableNoticeBlock = manager.normalizeNoticeBlock({ type: "table" });
const decorationNoticeBlock = manager.normalizeNoticeBlock({
  type: "decoration",
  decorationIcon: "heart",
  decorationStyle: "soft-circle",
  decorationColor: "#356b55",
  decorationSize: 72,
  decorationAlign: "right"
});
assert.equal(decorationNoticeBlock.type, "decoration");
assert.equal(decorationNoticeBlock.decorationIcon, "heart");
assert.equal(decorationNoticeBlock.decorationStyle, "soft-circle");
assert.equal(decorationNoticeBlock.decorationColor, "#356b55");
assert.equal(decorationNoticeBlock.decorationSize, 72);
assert.equal(decorationNoticeBlock.decorationAlign, "right");
assert.equal(tableNoticeBlock.type, "table");
assert.equal(tableNoticeBlock.rows.length, 3);
assert.equal(tableNoticeBlock.rows[0].length, 3);
assert.equal(tableNoticeBlock.tableWidth, 100);
assert.equal(tableNoticeBlock.tableAlign, "left");
assert.equal(Math.round(tableNoticeBlock.columnWidths.reduce((sum, width) => sum + width, 0)), 100);
assert.equal(tableNoticeBlock.rowHeights.length, 3);
assert.equal(tableNoticeBlock.cellStyles[0].length, 3);
const customTableNoticeBlock = manager.normalizeNoticeBlock({
  type: "table",
  tableAlign: "right",
  rows: [["이름", "내용"], ["첫째", "안내"]]
});
assert.deepEqual(Array.from(customTableNoticeBlock.rows, (row) => Array.from(row)), [["이름", "내용"], ["첫째", "안내"]]);
assert.equal(customTableNoticeBlock.tableAlign, "right");

const styled = manager.normalizeModel({
  template: "facility",
  textStyles: { desktop: { headline: { size: 64, color: "#ABCDEF", font: "rounded" } } },
  items: [{
    title: "스타일 테스트",
    textStyles: { desktop: { title: { size: 29, color: "#123456", font: "batang" } } }
  }]
});
assert.equal(styled.textStyles.desktop.headline.size, 64);
assert.equal(styled.textStyles.desktop.headline.color, "#abcdef");
assert.equal(styled.textStyles.desktop.headline.font, "rounded");
assert.equal(styled.items[0].textStyles.desktop.title.size, 29);
assert.equal(styled.items[0].textStyles.desktop.title.font, "batang");

console.log("essential manager tests OK");
