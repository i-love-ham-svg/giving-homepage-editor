import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync(new URL("../outputs/representative-greeting-editor.html", import.meta.url), "utf8");

[
  'id="staffRoleExitBtn"',
  'id="staffViewportSwitch"',
  'id="staffSectionManager"',
  'id="staffSectionSelect"',
  'id="staffSectionList"',
  'function renderStaffSectionManager()',
  'function setStaffSectionVisibility(sectionId, visible)',
  'function moveStaffSection(sectionId, direction)',
  'function getActiveDetailPresentationContext(sectionId = state.activeSection)',
  'function syncSectionStyleChoice()',
  'data-section-style-action="original"',
  'data-section-style-action="detail"',
  'window.SongakEditorAccess',
  'body.staff-editor-role .topbar',
  'body.staff-editor-role .staff-editor-dock',
  'body.staff-role-preview .staff-creator-return'
].forEach((needle) => assert.ok(html.includes(needle), `missing staff editor hook: ${needle}`));

const staffDockMarkup = html.match(/<div class="staff-editor-dock"[\s\S]*?<\/div>/)?.[0] || "";
assert.ok(staffDockMarkup, "staff editor dock markup missing");
assert.doesNotMatch(staffDockMarkup, /섹션 구성|제작자 화면|staffSectionManagerBtn|staffRoleExitBtn/);
assert.match(staffDockMarkup, /staffViewportSwitch[\s\S]*data-staff-viewport="desktop"[\s\S]*data-staff-viewport="tablet"[\s\S]*data-staff-viewport="phone"[\s\S]*data-staff-viewport="phoneSmall"/);
assert.match(html, /<\/div>\s*<button[^>]+class="staff-creator-return"[^>]+id="staffRoleExitBtn"/);

assert.match(html, /const sectionSelectControls = \[[^\]]*staffSectionSelect/);
assert.match(html, /getDetailBundleSectionIds\(kind\)\.includes\(normalizedSectionId\)/);
assert.doesNotMatch(html, /id="staffFacilityModeSingleBtn"/);
assert.doesNotMatch(html, /id="staffFacilityModeDetailBtn"/);
assert.doesNotMatch(html, /id="staffDetailBundleOriginalBtn"/);
assert.doesNotMatch(html, /id="staffDetailBundleExpandedBtn"/);
assert.match(html, /data-staff-add-section="mainIntro"/);
assert.match(html, /data-staff-add-section="greeting"/);
assert.match(html, /setEditorRole\(requestedEditorRole\)/);

console.log("staff section manager tests OK");
