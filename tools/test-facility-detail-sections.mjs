import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync(new URL("../outputs/representative-greeting-editor.html", import.meta.url), "utf8");

assert.match(
  html,
  /\.essential-section-content\[data-facility-detail-kind\][\s\S]*?height:\s*100%;[\s\S]*?min-height:\s*0;/,
  "시설 상세형 콘텐츠는 관리 레이어 전체 높이를 채워야 합니다."
);

for (const kind of ["hero", "guide", "selector", "callout"]) {
  assert.match(html, new RegExp(`facilityDetailKind:\\s*"${kind}"`));
  assert.match(html, new RegExp(`addFacilityDetail${kind[0].toUpperCase()}${kind.slice(1)}`));
}

assert.match(html, /data-section-style-action="original"/);
assert.match(html, /data-section-style-action="detail"/);
assert.match(html, /class="section-style-choice-trigger"[\s\S]*?스타일 · \$\{activeStyleLabel\}/);
assert.match(html, /\.section-style-choice \{[\s\S]*?z-index: 110;[\s\S]*?top: calc\(var\(--home-menu-height, 44px\) \+ 14px\);[\s\S]*?right: 18px;/);
assert.match(html, /\.section-style-choice-trigger \{[\s\S]*?min-height: 44px;/);
assert.doesNotMatch(html, /chooser\.className = "section-style-choice essential-edit-only"/);
assert.match(html, /if \(target\.closest\?\.\("\.section-style-choice"\)\) return;/);
assert.match(html, /presentationType === "facility"\) setFacilityPresentationMode\("single"\)/);
assert.match(html, /presentationType === "facility"\) setFacilityPresentationMode\("detail"\)/);
assert.doesNotMatch(html, /id="topFacilityModeSingleBtn"/);
assert.doesNotMatch(html, /id="topFacilityModeDetailBtn"/);
assert.match(html, /function setFacilityPresentationMode/);
const facilityPresentationSource = html.match(/function setFacilityPresentationMode[\s\S]*?function addFacilityDetailSectionAt/)?.[0] || "";
assert.doesNotMatch(facilityPresentationSource, /clearHomeMenuView/);
assert.match(facilityPresentationSource, /state\.essentialSections\[sectionId\]\.heights = \{\}/);
assert.match(facilityPresentationSource, /if \(useDetail\) refreshEssentialSizing\(\)/);
assert.match(html, /state\.hiddenSections\.facility = useDetail/);
assert.match(html, /data-facility-detail-kind/);
assert.match(html, /facility-detail-selector-nav/);
assert.match(html, /facility-detail-hero-inner/);
assert.match(html, /facility-detail-guide-grid/);
assert.match(html, /facility-detail-floor-symbol/);
assert.match(html, /facility-detail-space-chip/);
assert.match(html, /facility-detail-callout/);
assert.match(html, /facility-detail-hero-inner\s*\{[\s\S]*?padding:\s*clamp\(48px, 6vw, 76px\)/);
assert.match(html, /facility-detail-guide-inner,[\s\S]*?padding:\s*clamp\(30px, 4vw, 48px\)/);
assert.match(html, /model\?\.facilityDetailKind \|\| model\?\.detailPageKind/);
assert.match(html, /const facilityFallbacks = \{ hero: 430, guide: 300, selector: 560, callout: 280 \}/);
assert.match(html, /function getEssentialMinimumHeightPx\(viewport, model\)[\s\S]*?if \(isEmbeddedDetail\) return key === "desktop" \? 180 : 220;/);
assert.match(html, /if \(state\.mode !== "edit" && !options\.allowViewMode\) return;/);
assert.match(html, /releaseLayerHeight:\s*true,\s*allowViewMode:\s*true/);
assert.match(html, /facilityDetailDesignVersion:\s*6/);
assert.match(html, /facilityDetailSizingVersion:\s*2/);
assert.match(html, /Number\(model\.facilityDetailSizingVersion \|\| 0\) < 2/);
assert.match(html, /child\.offsetTop \+ child\.offsetHeight/);
assert.match(html, /extraHeight:\s*2,\s*releaseLayerHeight:\s*true/);
assert.match(html, /facilityDetailSecondaryCta/);
assert.match(html, /주차장\(장애인 주차 포함\) · 농구장/);
assert.match(html, /jump-facility-detail-selector/);
assert.match(html, /href="\/programs\/application\?type=facility"/);
assert.match(html, /시설현황 상세 4개 섹션을 추가했습니다/);
assert.match(html, /function selectFacilityCategory/);
assert.match(html, /kind: "facility-floor"/);
assert.match(html, /addLabel: "\+ 층 추가"/);
assert.match(html, /deleteLabel: "× 층 삭제"/);
assert.match(html, /function applyEssentialImageTransform/);
assert.match(html, /imageFit/);
assert.match(html, /imageScale/);
assert.match(html, /imageOpacity/);
assert.match(html, /if \(state\.mode === "edit"\) \{\s*selectFacilityCategory/);

// Facility selector interaction regressions. These assertions intentionally
// cover the event-handler branches as well as the rendered controls: a visual
// selector can otherwise look correct while editing, keyboard, or persistence
// behavior silently regresses.
const facilityRendererSource = html.match(
  /function renderFacilityDetailSpaceChips[\s\S]*?function renderDetailBundleHeading/
)?.[0] || "";
const essentialBindingSource = html.match(
  /function bindEssentialSectionEvents[\s\S]*?function registerEssentialSection/
)?.[0] || "";

assert.match(
  essentialBindingSource,
  /const previousIds = new Set\(model\.items\.map[\s\S]*?find\(\(item\) => !previousIds\.has\(item\.id\)\)[\s\S]*?facilityDetailSelectedItemId = nextFacilitySelection/,
  "시설 selector에서 새 층을 추가하면 새 항목이 자동 선택되어야 합니다."
);
assert.match(
  essentialBindingSource,
  /if \(state\.mode === "edit"\) \{[\s\S]*?selectFacilityCategory\(sectionId, model\.facilityDetailSelectedItemId\)/,
  "보기 모드에서 층 탭을 선택해도 편집 막대를 열면 안 되고, 편집 모드에서는 목록 막대를 열어야 합니다."
);
assert.match(
  essentialBindingSource,
  /state\.mode === "edit" && imageTarget[\s\S]*?\(event\.key === "Enter" \|\| event\.key === " "\)[\s\S]*?selectEssentialImage\(sectionId, itemId\)/,
  "편집 모드의 시설 사진은 Enter와 Space 키로 편집 선택할 수 있어야 합니다."
);
assert.match(
  essentialBindingSource,
  /const facilitySpaceInput = event\.target\.closest\("\[data-facility-space-index\]"\)[\s\S]*?syncFacilitySpaceInputs\(itemElement, item\)/,
  "chip input을 입력하는 동안 canonical meta가 실시간 동기화되어야 합니다."
);
assert.match(
  facilityRendererSource,
  /split\(\/\\s\*\[·\|\]\\s\*\/\)[\s\S]*?list\.replaceChildren\(\)[\s\S]*?input\.dataset\.facilitySpaceIndex[\s\S]*?add\.dataset\.facilitySpaceAdd/,
  "공간 목록 렌더러는 같은 surface의 native input과 추가 버튼을 만들어야 합니다."
);
assert.doesNotMatch(html, /\.stage\.edit-mode \.facility-detail-floor-copy \.essential-item-meta:focus[\s\S]*?position:\s*relative/, "숨은 raw meta textarea는 focus되어도 노출되면 안 됩니다.");
assert.match(essentialBindingSource, /event\.key === "Escape"[\s\S]*?facilitySpaceOriginal[\s\S]*?event\.key === "Enter"/, "chip은 Escape 취소와 Enter 이동을 지원해야 합니다.");
assert.match(
  essentialBindingSource,
  /addEventListener\("focusin"[\s\S]*?facilitySpaceOriginal = spaceInput\.value/,
  "each chip edit session must refresh its Escape rollback value from the latest committed surface value"
);
assert.match(
  essentialBindingSource,
  /securityRuntime\.validateImageFile\(file\)[\s\S]*?reader\.addEventListener\("error"[\s\S]*?securityRuntime\.isSafeImageDataUrl\(dataUrl\)[\s\S]*?validateImageDimensions[\s\S]*?optimizeDataUrlForStorage/,
  "시설 사진은 형식·읽기 오류·data URL·크기 검증 후 저장 용량에 맞게 최적화해야 합니다."
);
assert.match(
  essentialBindingSource,
  /action === "delete-item"[\s\S]*?essentialRuntime\.removeItem\(model, itemId\)[\s\S]*?facilityDetailSelectedItemId/,
  "시설 층 삭제 후 selector의 selected ID를 정규화된 모델 값으로 유지해야 합니다."
);
assert.match(
  essentialBindingSource,
  /if \(nextFacilitySelection && state\.mode === "edit"\)[\s\S]*?focus\(\)[\s\S]*?select\(\)/,
  "추가·삭제 후 유효한 선택 항목으로 포커스와 텍스트 선택을 복구해야 합니다."
);

assert.match(html, /if \(sectionId === "footer"\) return !isHomeMenuEmptyPageActive\(\)/, "상세 메뉴에서도 footer가 보여야 합니다.");
assert.match(html, /data-program-image-target role="button" tabindex="0"/);
assert.match(html, /data-history-image-target role="button" tabindex="0"/);
assert.match(html, /function getSelectedManagedImage/);
assert.match(html, /function deleteSelectedGreetingAsset/);
assert.match(html, /function applyConceptImageDefaults/);
assert.match(html, /if \(!model\.assets\.photo\?\.dataUrl\) model\.assets\.photo = structuredClone\(portrait\)/, "저장된 대표사진을 덮어쓰지 않아야 합니다.");
assert.match(html, /if \(!item\.imageUrl && facilityImages\[item\.id\]\)/, "저장된 시설사진을 덮어쓰지 않아야 합니다.");
assert.match(html, /if \(!event\.image\?\.dataUrl && historyImages\.has\(event\.title\)\)/, "저장된 연혁사진을 덮어쓰지 않아야 합니다.");
assert.match(html, /editor\.toolbar\.portrait-photo|selectedPart === "photo"/);

assert.match(html, /if \(sectionId === "footer"\) return !isHomeMenuEmptyPageActive\(\)/, "상세 메뉴에서도 footer가 보여야 합니다.");
assert.match(html, /data-program-image-target role="button" tabindex="0"/);
assert.match(html, /data-history-image-target role="button" tabindex="0"/);
assert.match(html, /function getSelectedManagedImage/);
assert.match(html, /function deleteSelectedGreetingAsset/);

console.log("facility detail section tests OK");
