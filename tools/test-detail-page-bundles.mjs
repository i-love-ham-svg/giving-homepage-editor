import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("../outputs/", import.meta.url);
const html = fs.readFileSync(new URL("representative-greeting-editor.html", root), "utf8");
const managerSource = fs.readFileSync(new URL("editor-essential-manager.js", root), "utf8");
const bundleSource = fs.readFileSync(new URL("editor-detail-bundle-data.js", root), "utf8");
const bundleCss = fs.readFileSync(new URL("editor-detail-bundles.css", root), "utf8");
const detailPagesSource = fs.readFileSync(new URL("detail-pages.js", root), "utf8");
const detailPagesCss = fs.readFileSync(new URL("detail-pages.css", root), "utf8");

assert.match(html, /async function openApplicationInsideCurrentPage\(applicationType = "general"\)/);
assert.match(html, /targetUrl\.pathname\.replace\([^\n]+\) !== "\/programs\/application"[\s\S]*?openApplicationInsideCurrentPage/);
assert.doesNotMatch(html, /representative-greeting-editor\.html\?mode=view(?:&amp;|&)stylePage=/);
for (const publicRoute of [
  "/about/facility",
  "/programs/schedule",
  "/about/organization",
  "/news/videos",
  "/programs/case-management",
  "/programs/application?type=program",
  "/programs/application?type=case",
  "/programs/application?type=volunteer",
  "/programs/application?type=donation",
  "/programs/application?type=facility",
  "/programs/application?type=general"
]) assert.ok(html.includes(publicRoute), `missing canonical public CTA route: ${publicRoute}`);

const applicationNavigationSource = html.match(
  /async function openApplicationInsideCurrentPage\(applicationType = "general"\)[\s\S]*?^    \}/m
)?.[0] || "";
assert.match(
  applicationNavigationSource,
  /await navigateToHomeMenuSection\(applicationMenuId[\s\S]*?if \(!hydrated\) return false;[\s\S]*?setDetailBundlePresentationMode/,
  "public scoped hydration must finish before the application form is activated"
);

let releaseHydration;
const sequence = [];
const typeControl = { options: [{ value: "donation" }], value: "" };
const firstControl = { focus: () => sequence.push("focus") };
const form = {
  querySelector(selector) {
    if (selector === '[name="type"]') return typeControl;
    if (selector === "input, select, textarea") return firstControl;
    return null;
  },
  scrollIntoView: () => sequence.push("scroll")
};
const hydrationGate = new Promise((resolve) => {
  releaseHydration = () => {
    sequence.push("hydrated");
    resolve(true);
  };
});
const applicationNavigationContext = vm.createContext({
  URL,
  Promise,
  document: { body: { dataset: { editorRole: "public" } } },
  state: {
    mode: "view",
    essentialSections: { applicationForm: { detailSectionKind: "form" } },
    activeSection: "",
    selected: ""
  },
  window: {
    location: new URL("https://songak.example/programs"),
    history: {
      lastUrl: "",
      replaceState(_state, _title, url) {
        this.lastUrl = String(url);
        sequence.push("history");
      }
    },
    requestAnimationFrame(callback) {
      sequence.push("frame");
      callback();
    }
  },
  navigateToHomeMenuSection(_menuId, options) {
    sequence.push(`navigate:${options.historyMode}:${options.committedPath}`);
    return hydrationGate;
  },
  setDetailBundlePresentationMode() { sequence.push("activate-form"); },
  getDetailBundleSectionIds() { return ["applicationForm"]; },
  sectionLayerMap: { applicationForm: ["applicationForm"] },
  elements: {
    applicationForm: {
      querySelector(selector) {
        return selector === "[data-detail-application-form]" ? form : null;
      }
    }
  },
  applySectionVisibility() { sequence.push("visibility"); },
  applyLayouts() { sequence.push("layout"); }
});
vm.runInContext(applicationNavigationSource, applicationNavigationContext, { filename: "application-navigation.js" });
const pendingApplicationOpen = applicationNavigationContext.openApplicationInsideCurrentPage("donation");
assert.deepEqual(sequence, ["navigate:none:/programs/application"], "the form must stay untouched while hydration is pending");
releaseHydration();
assert.equal(await pendingApplicationOpen, true);
assert.ok(sequence.indexOf("hydrated") < sequence.indexOf("activate-form"));
assert.equal(typeControl.value, "donation");
assert.equal(applicationNavigationContext.window.history.lastUrl, "https://songak.example/programs/application?type=donation");

const visitorDraftSource = html.match(
  /const visitorApplicationDraftStorageKey = "songak-application-draft";[\s\S]*?(?=    function bindDetailBundleInteractions)/
)?.[0] || "";
assert.match(visitorDraftSource, /sessionStorage\.setItem\(visitorApplicationDraftStorageKey/);
assert.match(visitorDraftSource, /delete data\.consent;[\s\S]*?delete data\.website;/);
assert.match(visitorDraftSource, /localStorage\.removeItem\("songak-application-drafts"\)/);
assert.doesNotMatch(visitorDraftSource, /localStorage\.setItem/);

const visitorSessionValues = new Map();
const removedLegacyDraftKeys = [];
class VisitorDraftFormData {
  constructor(form) { this.form = form; }
  entries() { return Object.entries(this.form.draftEntries)[Symbol.iterator](); }
}
const visitorDraftContext = vm.createContext({
  FormData: VisitorDraftFormData,
  URLSearchParams,
  sessionStorage: {
    getItem: (key) => visitorSessionValues.get(key) ?? null,
    setItem: (key, value) => visitorSessionValues.set(key, value),
    removeItem: (key) => visitorSessionValues.delete(key)
  },
  localStorage: { removeItem: (key) => removedLegacyDraftKeys.push(key) },
  window: {
    location: { search: "?type=donation" },
    clearTimeout() {},
    setTimeout() { return 1; }
  }
});
vm.runInContext(visitorDraftSource, visitorDraftContext, { filename: "visitor-application-draft.js" });
const draftControls = {
  type: { value: "donation" },
  name: { value: "" }
};
const visitorDraftForm = {
  draftEntries: { type: "program", name: "테스트 신청자", consent: "on", website: "bot-value" },
  elements: { namedItem: (name) => draftControls[name] || null }
};
visitorDraftContext.saveVisitorApplicationDraft(visitorDraftForm);
const storedVisitorDraft = JSON.parse(visitorSessionValues.get("songak-application-draft"));
assert.deepEqual(Object.keys(storedVisitorDraft.data).sort(), ["name", "type"]);
assert.equal(storedVisitorDraft.data.consent, undefined);
assert.equal(storedVisitorDraft.data.website, undefined);
assert.equal(visitorDraftContext.restoreVisitorApplicationDraft(visitorDraftForm), true);
assert.equal(draftControls.name.value, "테스트 신청자");
assert.equal(draftControls.type.value, "donation", "an explicit CTA type must win over an older session draft");
assert.deepEqual(removedLegacyDraftKeys, ["songak-application-drafts"]);

const context = vm.createContext({ structuredClone, console });
context.window = context;
vm.runInContext(managerSource, context, { filename: "editor-essential-manager.js" });
vm.runInContext(bundleSource, context, { filename: "editor-detail-bundle-data.js" });

const runtime = context.EditorEssentialManager;
const bundles = context.SongakDetailBundles;
assert.ok(runtime);
assert.ok(bundles);

assert.deepEqual(Array.from(bundles.PAGE_ORDER), ["facility", "schedule", "case", "organization", "video", "application", "account"]);
assert.deepEqual(Array.from(bundles.BUNDLES.facility.kinds), ["hero", "facts", "selector", "callout"]);
assert.deepEqual(Array.from(bundles.BUNDLES.facility.originalIds), ["facility", "essential5"]);
assert.deepEqual(Array.from(bundles.BUNDLES.schedule.originalIds), ["schedule", "essential6"]);
assert.deepEqual(Array.from(bundles.BUNDLES.schedule.kinds), ["hero", "facts", "table", "source"]);
assert.equal(Object.values(bundles.BUNDLES).reduce((total, bundle) => total + bundle.kinds.length, 0), 23);
assert.deepEqual(Array.from(bundles.BUNDLES.account.kinds), ["social", "guide"]);

for (const pageKind of bundles.PAGE_ORDER) {
  const config = bundles.BUNDLES[pageKind];
  for (const sectionKind of config.kinds) {
    const source = bundles.createModel(pageKind, sectionKind);
    const normalized = runtime.normalizeModel(source, source.template);
    assert.equal(source.detailPageKind, pageKind);
    assert.equal(source.detailSectionKind, sectionKind);
    if (pageKind !== "facility") {
      assert.equal(normalized.detailPageKind, pageKind);
      assert.equal(normalized.detailSectionKind, sectionKind);
    }
  }
}

const video = runtime.normalizeModel(bundles.createModel("video", "archive"), "facility");
assert.equal(video.items.length, 6);
assert.match(video.items[0].linkUrl, /youtube\.com\/watch/);
assert.match(video.items[0].imageUrl, /img\.youtube\.com/);
const facility = runtime.normalizeModel(bundles.createModel("facility", "selector"), "facility");
assert.equal(facility.items.length, 5);
assert.equal(facility.items[0].title, "야외 시설");

const application = runtime.normalizeModel(bundles.createModel("application", "form"), "volunteer");
assert.equal(application.items.length, 7);
assert.equal(application.items.filter((item) => item.required).length, 5);
assert.equal(application.items[0].fieldType, "select");

const account = runtime.normalizeModel(bundles.createModel("account", "social"), "volunteer");
assert.equal(account.details.length, 4);
assert.equal(account.note, "");
assert.equal(account.description, "");
assert.equal(account.socialLayout, "drive-split");
assert.deepEqual(Object.keys(account.socialButtonStyles), ["kakao", "naver", "google"]);
assert.deepEqual(Array.from(runtime.SOCIAL_LOGIN_LAYOUTS), ["fresh-split", "drive-split", "immersive", "mobile-curve"]);
assert.match(html, /data-sns-layout="\$\{escapeHtml\(socialLayout\)\}"/);
assert.match(html, /data-essential-action="set-social-layout"/);
assert.match(html, /data-sns-layout-value="\$\{escapeHtml\(option\.value\)\}"/);
assert.match(html, /const normalizedLayout = normalizeSocialLoginLayout\(model\.socialLayout\)/);
const accountSnsUpgradeSource = html.match(/function upgradeAccountSnsPresentation\(\)[\s\S]*?^    \}/m)?.[0] || "";
assert.doesNotMatch(accountSnsUpgradeSource, /model\.socialLayout = "drive-split"/);
assert.match(accountSnsUpgradeSource, /Number\(model\.detailDesignVersion\) < 5[\s\S]*?account-sns-character-mobile-v5\.webp[\s\S]*?model\.detailDesignVersion = 5/);
assert.match(html, /data-sns-provider="kakao"[\s\S]*?data-sns-provider="naver"[\s\S]*?data-sns-provider="google"/);
assert.doesNotMatch(html.match(/page === "account" && kind === "social"[\s\S]*?else if \(\["steps"/)?.[0] || "", /type="password"|아이디 로그인/);
assert.doesNotMatch(html.match(/page === "account" && kind === "social"[\s\S]*?else if \(\["steps"/)?.[0] || "", /사용할 SNS 계정 선택|별도 비밀번호 없음|data-sns-auth-status/);
assert.match(html, /data-account-footer-document="privacy"/);
assert.match(html, /openFooterDocumentModal\("footer", button\.dataset\.accountFooterDocument/);

const organizationStructure = runtime.normalizeModel(bundles.createModel("organization", "structure"), "organization");
assert.equal(organizationStructure.details.length, 3);
assert.equal(organizationStructure.desktopFirstRowCount, 3);
assert.deepEqual(Array.from(runtime.getBalancedItemLayout(2, organizationStructure.desktopFirstRowCount), (entry) => entry.rowSize), [2, 2]);

for (const expected of [
  "function setDetailBundlePresentationMode",
  "function ensureDefaultDetailPresentations",
  "function syncSectionStyleChoice",
  "data-section-style-action=\"original\"",
  "data-section-style-action=\"detail\"",
  "function renderDetailBundleSection",
  "data-detail-balanced-facts=\"true\"",
  "data-detail-action=\"upload-source-image\"",
  "data-detail-source-image",
  "function bindDetailBundleInteractions",
  "songak-application-draft"
]) assert.match(html, new RegExp(expected));
assert.doesNotMatch(html, /songak-application-submissions/);
assert.doesNotMatch(html, /requireAuthenticationForAction|data-auth-required-dialog|songak-auth-return/);
assert.doesNotMatch(html, /localStorage\.setItem\("songak-application-drafts"/);
assert.match(html, /name="consent" required/);
assert.match(html, /name="website"[^>]*tabindex="-1"[^>]*autocomplete="off"/);
const publicApplicationSubmitSource = html.match(
  /const form = layer\.querySelector\("\[data-detail-application-form\]"\);[\s\S]*?(?=      if \(model\.detailPageKind === "account")/
)?.[0] || "";
assert.match(publicApplicationSubmitSource, /if \(!form\.reportValidity\(\)\) return;[\s\S]*?fetch\("\/api\/applications"/);
assert.match(publicApplicationSubmitSource, /if \(payload\.website\) return;/);
assert.match(publicApplicationSubmitSource, /response\.status === 429/);
assert.match(publicApplicationSubmitSource, /form\.elements\.namedItem\("consent"\)[\s\S]*?clearVisitorApplicationDraft/);
assert.doesNotMatch(publicApplicationSubmitSource, /staff-login|SNS 로그인|requireAuthentication/);
assert.match(html, /작성 내용은 전송되지 않았습니다/);

assert.doesNotMatch(html, /id="topDetailBundleOriginalBtn"/);
assert.doesNotMatch(html, /id="topDetailBundleExpandedBtn"/);
assert.doesNotMatch(html, /id="staffDetailBundleOriginalBtn"/);
assert.doesNotMatch(html, /id="staffDetailBundleExpandedBtn"/);
assert.match(html, /setDetailBundlePresentationMode\(pageKind, "original"\)/);
assert.match(html, /setDetailBundlePresentationMode\(pageKind, "detail"\)/);
const detailPresentationSource = html.match(/function setDetailBundlePresentationMode[\s\S]*?function addDetailBundleAt/)?.[0] || "";
assert.doesNotMatch(detailPresentationSource, /clearHomeMenuView/);
assert.match(detailPresentationSource, /state\.essentialSections\[id\]\.heights = \{\}/);
assert.match(html, /schedule:\s*"home-menu-business-schedule"/);
assert.match(html, /ensureDefaultDetailPresentations\(\{ render: !publicDocumentRequest \}\);/);
assert.match(html, /const DEFAULT_DETAIL_PRESENTATION_VERSION = 4/);
assert.match(html, /Number\(state\.detailPresentationVersion\) < 4[\s\S]*?model\.layoutStyle = "split"/);
assert.match(html, /function retireLegacyAccountHeroSections\(\)/);
assert.match(html, /\["schedule", "case", "organization", "video", "application", "account"\][\s\S]*?setDetailBundlePresentationMode\(pageKind, "detail"/);
assert.match(html, /setFacilityPresentationMode\("detail", \{ select: false, history: false, silent: true, render: options\.render \}\)/);
assert.match(html, /detailPresentationVersion: state\.detailPresentationVersion/);
assert.match(html, /state\.detailPresentationVersion = Math\.max\(0, Number\(saved\.content\?\.detailPresentationVersion\) \|\| 0\)/);
assert.match(html, /found\.meta\.parent\.sectionIds = \[\.\.\.new Set/);
assert.match(html, /!detailIds\.includes\(sectionId\) && !originalIds\.includes\(sectionId\)/);
assert.match(html, /home-menu-business-schedule-original[\s\S]*?detailSectionKind === "source"/);
assert.doesNotMatch(html.match(/function createDefaultHomeMenuItems\(\)[\s\S]*?function applyThreeLevelHomeMenuDefaults/)?.[0] || "", /home-menu-intro-floor/);
assert.match(html, /legacyIds = new Set\(\[[\s\S]*?"home-menu-intro-floor"/);
assert.match(html, /\["시간표 원본", "인쇄용 시간표 원본"\]\.includes\(existing\?\.label\)[\s\S]*?existing\.label = "인쇄용 프로그램 시간표"/);
assert.match(html, /model\?\.detailPageKind \|\| \(model\?\.facilityDetailKind \? "facility"/);
assert.match(html, /child\.sectionIds = \[\.\.\.activeIds\]/);
assert.match(html, /if \(activeIds\.length\) delete child\.externalUrl/);
assert.match(html, /application:\s*"home-menu-business-application"/);
assert.match(html, /account:\s*"home-menu-account"/);
assert.match(html, /data-sns-provider="kakao"/);
assert.match(html, /data-sns-provider="naver"/);
assert.match(html, /data-sns-provider="google"/);
assert.doesNotMatch(html, /type="password"/);
assert.match(html, /function removeLegacyStandaloneDetailMenuItems\(\)/);
assert.match(html, /if \(action === "original"\)[\s\S]*?setDetailBundlePresentationMode\(pageKind, "original"\)/);
assert.match(html, /if \(action === "detail"\)[\s\S]*?setDetailBundlePresentationMode\(pageKind, "detail"\)/);
assert.match(html, /disabled title="연결된 기본 섹션이 없습니다"/);
assert.match(html, /setActiveSection\(target, \{ selectLayer: true \}\)/);
assert.match(bundleCss, /\.detail-bundle-section\s*\{\s*padding:clamp\(40px,5vw,64px\) 0;/);
assert.match(bundleCss, /\.detail-bundle-hero \.detail-bundle-inner[^}]*padding:clamp\(48px,6vw,76px\)/);
assert.match(bundleCss, /\.stage\.desktop \.detail-fact-grid\[data-detail-balanced-facts="true"\]/);
assert.match(bundleCss, /\.detail-source-image[^}]*height:auto[^}]*object-fit:contain/);
assert.doesNotMatch(bundleCss, /\.detail-org-root \.essential-(?:eyebrow|org-root-title|note)[^{]*\{[^}]*font-size:[^;}]+!important/);
assert.match(html, /source: key === "desktop" \? 760 : 430/);
assert.match(html, /organization:\s*"\/about\/organization"/);
assert.doesNotMatch(detailPagesSource, /detail-editor-entry/);
assert.doesNotMatch(detailPagesCss, /\.detail-editor-entry\s*\{/);
assert.match(detailPagesSource, /representative-greeting-editor\.html\?mode=view/);
assert.match(html, /const requestedStylePage = editorQuery\.get\("stylePage"\)/);
assert.match(html, /state\.activeHomeMenuId = menuId/);
assert.match(html, /model\.detailPageKind === "application"[\s\S]*?typeControl\.value = requestedType/);

for (const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
  const source = match[1].trim();
  if (source) new vm.Script(source, { filename: "representative-greeting-editor.inline.js" });
}

console.log("detail page bundle tests OK");
