import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync("outputs/representative-greeting-editor.html", "utf8");
const colorManager = readFileSync("outputs/editor-color-picker-manager.js", "utf8");

const coordinatedOpeners = [
  ["menu editor", /function openHomeMenuEditor\(\)[\s\S]*?prepareEditorModalOpen\("menu-editor"\)/],
  ["photo refine", /async function openPhotoRefineEditor\(\)[\s\S]*?prepareEditorModalOpen\("photo-refine"\)/],
  ["notice detail", /function openEssentialNoticeDetail\([\s\S]*?prepareEditorModalOpen\("notice-detail"\)/],
  ["notice composer", /openEssentialNoticeComposer = function \([\s\S]*?prepareEditorModalOpen\("notice-composer"\)/],
  ["notice child text", /function openNoticeTextEditor\([\s\S]*?prepareEditorModalOpen\("notice-text-editor", \{ preserveNoticeComposer: true \}\)/],
  ["footer document", /function openFooterDocumentModal\([\s\S]*?prepareEditorModalOpen\("footer-document"\)/],
  ["process picker", /function openProcessIconPicker\([\s\S]*?prepareEditorModalOpen\("process-icon-picker"\)/],
  ["history picker", /function openHistoryIconPicker\([\s\S]*?prepareEditorModalOpen\("history-icon-picker"\)/],
  ["donation picker", /function openDonationIconPicker\([\s\S]*?prepareEditorModalOpen\("donation-icon-picker"\)/],
  ["decoration picker", /function openDecorationPicker\([\s\S]*?prepareEditorModalOpen\("decoration-picker"/],
  ["staff section manager", /function openStaffSectionManager\(\)[\s\S]*?prepareEditorModalOpen\("staff-section-manager"\)/],
  ["SNS config", /action === "open-social-config"[\s\S]*?prepareEditorModalOpen\("sns-auth-config"\)[\s\S]*?showModal/],
];

for (const [label, pattern] of coordinatedOpeners) {
  assert.match(html, pattern, `${label} must enter the shared modal coordinator before opening`);
}

assert.match(html, /preserveNoticeComposer: isNoticeDecorationSection\(sectionId\)/, "notice decoration preserves only its composer parent");
assert.match(html, /\["notice-composer", "footer-document", "photo-refine"\]/, "draft-bearing surfaces are protected from implicit replacement");
assert.match(html, /현재 편집창에서 저장 또는 취소를 먼저 선택해 주세요\./, "blocked replacement has beginner-readable recovery guidance");
assert.match(html, /role="dialog" aria-modal="false" aria-labelledby="menuEditorModalTitle"/, "menu editor exposes dialog semantics");
assert.match(html, /id="essentialNoticeTextEditorModal" role="region"/, "notice text inspector is an embedded region, not a second modal");
assert.match(html, /essentialNoticeComposerModal\.appendChild\(essentialNoticeTextEditorModal\)/, "notice text inspector is mounted inside its composer canvas");
assert.match(html, /function closeEditorTransientSurface\(\)/, "transient surfaces close before blocking dialogs on Escape");
assert.match(html, /event\.key !== "Escape"[\s\S]*?closeEditorTransientSurface\(\)[\s\S]*?closeTopmostEditorModal\(\)/, "one Escape coordinator respects transient-before-dialog priority");
assert.match(html, /prepareEditorTransientOpen\(\)[\s\S]*?\.section-style-choice-menu/, "section style/appearance menus participate in the transient contract");
assert.match(html, /details\.sns-auth-image-picker\[open\], details\.sns-auth-layout-picker\[open\]/, "SNS details pickers participate in the transient contract");

assert.match(colorManager, /cancelAll:[\s\S]*?closePalette\(\)/, "color manager can cancel sampling and palette together");
assert.match(colorManager, /get paletteOpen\(\)/, "color manager exposes palette state without DOM-state guessing");

const staticMarkup = html.slice(0, html.indexOf("<script>"));
const duplicateIds = [...staticMarkup.matchAll(/\bid="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((id, index, ids) => ids.indexOf(id) !== index);
assert.deepEqual(duplicateIds, [], `editor must not contain duplicate IDs: ${duplicateIds.join(", ")}`);

console.log("editor modal single-active contract static tests OK");
