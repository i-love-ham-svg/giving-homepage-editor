import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const pages = [
  ["facility-detail.html", "facility", "/about/facility"],
  ["program-schedule.html", "schedule", "/programs/schedule"],
  ["case-management-detail.html", "case", "/programs/case-management"],
  ["organization-staff.html", "organization", "/about/organization"],
  ["video-archive.html", "video", "/news/videos"],
  ["online-application.html", "application", "/programs/application"]
];

for (const [file, page, target] of pages) {
  const html = readFileSync(join(root, "outputs", file), "utf8");
  assert.match(html, new RegExp(`data-page="${page}"`));
  assert.match(html, new RegExp(`url=${target.replaceAll("/", "\\/")}`));
  assert.match(html, /location\.replace/);
  assert.doesNotMatch(html, /representative-greeting-editor|detail-pages\.js|editor-detail-bundle-data\.js/);
}

const script = readFileSync(join(root, "outputs", "detail-pages.js"), "utf8");
assert.doesNotThrow(() => new Function(script), "detail-pages.js syntax should be valid");
assert.match(script, /program-schedule-original\.jpg/);
assert.match(script, /dataset\.applicationEndpoint/);
assert.match(script, /deliveryMode === "demo"[\s\S]*?신청 접수 완료가 아니며/);
assert.match(script, /const deliveryMode = applicationEndpoint \? "live" : "demo"[\s\S]*?heroHeadline = deliveryMode === "live"[\s\S]*?"온라인 신청서 임시 작성"/);
assert.doesNotMatch(script, /hero\("ONLINE APPLICATION", "간편하게 상담·프로그램을 신청하세요"/);
assert.match(script, /applicationEndpoint[\s\S]*?fetch\(applicationEndpoint/);
assert.match(script, /sessionStorage\.setItem\("songak-application-draft"[\s\S]*?expiresAt/);
assert.match(script, /function scheduleApplicationDraftExpiry\(expiresAt\)[\s\S]*?clearApplicationDraftExpiryTimer\(\)[\s\S]*?window\.setTimeout\(removeApplicationDraft, remaining\)/);
assert.match(script, /function createDraftReceipt\(data\)[\s\S]*?scheduleApplicationDraftExpiry\(expiresAt\)/, "each new application draft should reset its expiry timer");
assert.match(script, /namedItem\("consent"\)[\s\S]*?if \(!event\.currentTarget\.checked\) removeApplicationDraft\(\)/, "withdrawing consent should delete the application draft and timer");
assert.match(script, /addEventListener\("pagehide", clearApplicationDraftExpiryTimer[\s\S]*?addEventListener\("pageshow", scheduleStoredApplicationDraftExpiry\)/, "application draft timers should not leak across page lifecycle changes");
assert.doesNotMatch(script, /localStorage\.setItem\("songak-application-drafts"/);
assert.match(script, /if \(!form\.reportValidity\(\)\)/);
assert.match(script, /서버 연결에 실패해 접수되지 않았습니다[\s\S]*?개인정보는 자동 저장하지 않았습니다/);
assert.match(script, /function getPublishedDetailModel\(kind\)[\s\S]*?SongakDetailBundles[\s\S]*?songak-detail-publish-payload/);
for (const kind of ["hero", "steps", "support", "consult"]) assert.match(script, new RegExp(`getPublishedDetailModel\\("${kind}"\\)`));
assert.match(script, /function applyApplicationModelFields\(form, model\)[\s\S]*?contracts = \[[\s\S]*?name: "type"[\s\S]*?name: "message"[\s\S]*?control\.required = Boolean\(item\.required\)/);
assert.match(script, /applyApplicationModelFields\(form, formModel\)/);
assert.match(script, /aria-controls="floor-panel-/);
assert.match(script, /role="tabpanel" aria-labelledby="floor-tab-[\s\S]*? hidden/);
assert.match(script, /const keyMap = \{ ArrowLeft:[\s\S]*?ArrowRight:[\s\S]*?Home:[\s\S]*?End:/);
assert.match(script, /detail-breadcrumb/);
assert.match(script, /aria-live="polite"/);
assert.equal((script.match(/img\.youtube\.com/g) || []).length >= 1, true);

const editorHtml = readFileSync(join(root, "outputs", "representative-greeting-editor.html"), "utf8");
assert.match(editorHtml, /name="consent"/);
assert.match(editorHtml, /name="website"[^>]*tabindex="-1"[^>]*autocomplete="off"/);
assert.doesNotMatch(editorHtml, /name="privacy-consent"/);
assert.match(editorHtml, /function persistDetailPublishPayload\(\)[\s\S]*?songak-detail-publish-payload/);
assert.match(editorHtml, /data-main-intro-cta="program"[\s\S]*?data-main-intro-cta="consult"/);
assert.match(editorHtml, /\.main-intro-cta-row button \{[^}]*min-height:max\(48px, var\(--touch-target, 44px\)\)/);
assert.match(editorHtml, /const sectionId = row\.dataset\.sectionId \|\| "mainIntro";[\s\S]*?const visible = isSectionVisibleInCurrentView\(sectionId\);[\s\S]*?row\.hidden = !visible;[\s\S]*?control\.tabIndex = visible \? 0 : -1;/);
assert.match(editorHtml, /const row = cta\.closest\("\.main-intro-cta-row"\);[\s\S]*?if \(!row \|\| row\.hidden\) return;/);
assert.match(editorHtml, /navigateToHomeMenuSection\("home-menu-business-program"\)[\s\S]*?openApplicationInsideCurrentPage\("case"\)/);
assert.match(editorHtml, /class="donation-view-only" href="\/programs\/application\?type=donation"/);
assert.match(editorHtml, /localStorage\.setItem\(saveStorageKey[\s\S]*?persistDetailPublishPayload\(\)/);
assert.match(editorHtml, /legacyIntroBody[\s\S]*?saved\.content\.mainIntroBody = explicitIntroBody/);
assert.match(editorHtml, /legacyRole\?\.text === "직원" && legacyName\?\.text === "일동"[\s\S]*?legacyRole\.text = "관장"[\s\S]*?legacyName\.text = "김형철"/);
assert.match(editorHtml, /signatureText === "송악사회복지관 직원일동"[\s\S]*?signatureText = "김형철"/);
assert.match(editorHtml, /essential-cta essential-edit-only/);
assert.match(editorHtml, /sectionOrder: \["mainIntro", "program", "schedule", "process", "facility", "greeting", "organization", "history", "volunteer", "donation", "notice", "gallery", "location", "footer"\]/);
const supplementSource = editorHtml.match(/function registerOfficialSupplementSections\(\) \{[\s\S]*?\n    \}/)?.[0] || "";
assert.match(supplementSource, /\["essential2", createOfficialMissionModel\(\), 1\]/);
assert.match(supplementSource, /\["essential6"[\s\S]*?, 4\]/);
assert.match(supplementSource, /\["essential3"[\s\S]*?, 17\]/);
assert.doesNotMatch(supplementSource, /essential8|createOfficialVisitorBoardModel/);
assert.match(
  editorHtml,
  /function openHomeMenuDetailPage\(externalUrl\)[\s\S]*?window\.location\.assign\(targetUrl\);\s*}/,
  "detail-page menu links should navigate the current tab reliably"
);

console.log("detail pages and integrated application form tests OK");
