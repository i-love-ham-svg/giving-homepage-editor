import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../outputs/representative-greeting-editor.html", import.meta.url), "utf8");
const headBootstrap = html.match(/<head>[\s\S]*?<script>([\s\S]*?)<\/script>/i)?.[1] || "";

assert.ok(headBootstrap, "the first inline head bootstrap must exist");

function executeHeadBootstrap(pathname, search) {
  const fetchCalls = [];
  const replacements = [];
  const location = {
    pathname,
    search,
    replace(value) { replacements.push(value); }
  };
  const window = { location };
  const document = { documentElement: { style: { visibility: "" } } };
  const context = {
    window,
    document,
    URLSearchParams,
    performance: { now: () => 1 },
    fetch(url, options) {
      fetchCalls.push({ url, options });
      return new Promise(() => {});
    }
  };
  vm.runInNewContext(headBootstrap, context, { filename: "representative-greeting-editor-head.js" });
  return { fetchCalls, replacements, window, document };
}

const directEditorPath = "/songak/representative-greeting-editor.html";
const allowedPublicQueries = [
  "?mode=view",
  "?mode=view&editorRole=",
  "?mode=view&editorRole=public",
  "?mode=view&editorRole=visitor",
  "?mode=view&editorRole=consumer",
  "?mode=view&role=public",
  "?mode=view&role=%20Visitor%20",
  "?mode=view&editorRole=public&role=consumer",
  "?mode=view&role=public&role=visitor"
];
const blockedEditorQueries = [
  "",
  "?mode=edit",
  "?mode=unknown",
  "?mode=VIEW",
  "?mode=view&editorRole=staff",
  "?mode=view&editorRole=editor",
  "?mode=view&editorRole=manager",
  "?mode=view&editorRole=developer",
  "?mode=view&role=staff",
  "?mode=view&role=unknown",
  "?mode=view&editorRole=public&role=staff",
  "?mode=view&role=public&role=developer",
  "?mode=view&mode=view",
  "?mode=view&mode=edit&role=public"
];

allowedPublicQueries.forEach((query) => {
  const result = executeHeadBootstrap(directEditorPath, query);
  assert.equal(result.fetchCalls.length, 1, `${query} should prefetch its anonymous read-only public scope`);
  assert.equal(result.window.SONGAK_PUBLIC_VIEW_REQUEST, true, query);
  assert.equal(result.window.__songakPublicBootScopeRequest?.scope, "home-menu-account", query);
  assert.equal(result.window.__songakPublicBootScopeRequest?.consumed, false, query);
  assert.equal(result.fetchCalls[0].url, "/api/site-content/songak-homepage?scope=home-menu-account", query);
  assert.equal(result.fetchCalls[0].options?.credentials, "same-origin", query);
  assert.equal(result.fetchCalls[0].options?.cache, "no-cache", query);
});

blockedEditorQueries.forEach((query) => {
  const result = executeHeadBootstrap(directEditorPath, query);
  assert.equal(result.fetchCalls.length, 1, `${query || "(no query)"} must require a staff session`);
  assert.equal(result.window.SONGAK_PUBLIC_VIEW_REQUEST, false, query || "(no query)");
  assert.equal(result.document.documentElement.style.visibility, "hidden", query || "(no query)");
  assert.equal(result.window.__songakPublicBootScopeRequest, undefined, `${query || "(no query)"} must not prefetch public content`);
});

for (const [pathname, scope] of [["/", "home-menu-account"], ["/about", "home-menu-intro-main"], ["/news/gallery", "home-menu-news-gallery"], ["/privacy-policy", "home-menu-account"]]) {
  const result = executeHeadBootstrap(pathname, "?mode=edit&role=developer");
  assert.equal(result.fetchCalls.length, 1, `${pathname} should prefetch its established public route scope`);
  assert.equal(result.window.SONGAK_PUBLIC_VIEW_REQUEST, true, pathname);
  assert.equal(result.window.__songakPublicBootScopeRequest?.scope, scope, pathname);
  assert.equal(result.fetchCalls[0].url, `/api/site-content/songak-homepage?scope=${scope}`, pathname);
}

const routeBootstrap = headBootstrap.match(/const publicRouteConfig = Object\.freeze\(\{[\s\S]*?\n\s*\}\);/)?.[0] || "";
assert.ok(routeBootstrap, "publicRouteConfig should be declared in the head bootstrap");
assert.doesNotMatch(routeBootstrap, /["']\/community["']\s*:/, "/community belongs to the board application, not the editor route table");
assert.match(headBootstrap, /const externalPublicMenuRoutes = Object\.freeze\(\{[\s\S]*?"home-menu-news-board": "\/community"[\s\S]*?\}\);/);
assert.match(headBootstrap, /window\.SONGAK_EXTERNAL_PUBLIC_MENU_ROUTES = externalPublicMenuRoutes/);
assert.match(headBootstrap, /if \(isPublicView\) \{[\s\S]*?__songakPublicBootScopeRequest[\s\S]*?return;/,
  "only public head boot may prefetch the initial scoped snapshot");

function sourceBetween(startPattern, endPattern) {
  const start = html.search(startPattern);
  assert.notEqual(start, -1, `missing source start: ${startPattern}`);
  const tail = html.slice(start);
  const relativeEnd = tail.search(endPattern);
  assert.notEqual(relativeEnd, -1, `missing source end: ${endPattern}`);
  return tail.slice(0, relativeEnd);
}

const publicPathSource = sourceBetween(/function getPublicPathForMenuId\(/, /function getPublicRouteForPath\(/);
assert.match(publicPathSource, /SONGAK_EXTERNAL_PUBLIC_MENU_ROUTES\?\.\[menuId\][\s\S]*?SONGAK_PUBLIC_ROUTE_CONFIG/,
  "external board routes must win before editor route lookup");

const navigationSource = sourceBetween(/function navigateToHomeMenuSection\(/, /async function handlePublicPopState\(/);
assert.match(navigationSource, /SONGAK_EXTERNAL_PUBLIC_MENU_ROUTES\?\.\[menuId\]/);
assert.match(navigationSource, /window\.location\.assign\(externalPublicPath\)/,
  "the board destination must use a full-document navigation");
assert.ok(navigationSource.indexOf("window.location.assign(externalPublicPath)") < navigationSource.indexOf("navigateToPublicHomeMenuSection(menuId, options)"),
  "the external board route must bypass scoped editor navigation");

assert.match(html, /const publicScopeCache = new Map\(\)/);
assert.match(html, /const publicScopeInflight = new Map\(\)/);
assert.match(html, /let publicNavigationSequence = 0/);
assert.match(html, /let publicActiveScopeSectionOrder = null/);
assert.match(html, /let publicFullDocumentMode = false/);

const closedHomeMenuSource = sourceBetween(/function normalizeClosedHomeMenu\(/, /function flattenHomeMenuLabels\(/);
assert.match(closedHomeMenuSource, /normalizeHomeMenu\(\{ \.\.\.structuredClone\(menu \?\? \{\}\), open: false \}\)/);
assert.match(closedHomeMenuSource, /normalized\.open = false/);
const closedHomeMenuContext = vm.createContext({
  structuredClone,
  state: { homeMenu: { open: true } },
  normalizeHomeMenu(menu) {
    return { ...menu, open: Boolean(menu.open ?? true) };
  }
});
vm.runInContext(closedHomeMenuSource, closedHomeMenuContext, { filename: "closed-home-menu.js" });
assert.equal(closedHomeMenuContext.normalizeClosedHomeMenu({ brand: "송악사회복지관", open: true }).open, false,
  "a published menu snapshot must ignore a transient open state");
assert.equal((html.match(/homeMenu: normalizeClosedHomeMenu\(state\.homeMenu\)/g) || []).length, 2,
  "both canonical and legacy save snapshots must persist a closed menu");

const validationSource = sourceBetween(/function validatePublicScopedPayload\(/, /function mergePublicScopedGlobals\(/);
assert.match(validationSource, /payload\.scopeFallback/);
assert.match(validationSource, /payload\.scope !== requestedScope/);
assert.match(validationSource, /payload\.scopeSectionIds/);
assert.match(validationSource, /scopeSectionIds\.includes\("footer"\)/);
assert.match(validationSource, /documentSnapshot\.sectionOrder/);
assert.match(validationSource, /findHomeMenuItemInSnapshot\(globals\.homeMenu\?\.items, requestedScope\)/);
assert.match(validationSource, /linkedSectionIds\.some\(\(sectionId\) => !scopeSectionIds\.includes\(sectionId\)\)/);

const globalsMergeSource = sourceBetween(/function mergePublicScopedGlobals\(/, /function mergePublicCanonicalSection\(/);
assert.match(globalsMergeSource, /state\.homeMenu = normalizeClosedHomeMenu\(globals\.homeMenu\)/,
  "scoped public hydration must ignore a server menu open state");

const mergeSource = sourceBetween(/function applyPublicScopedPayload\(/, /async function fetchRemoteSitePayload\(/);
assert.match(mergeSource, /canonical\.sections\.forEach\(mergePublicCanonicalSection\)/);
assert.match(mergeSource, /publicActiveScopeSectionOrder = \[\.\.\.canonical\.sectionIds\]/);
assert.match(mergeSource, /state\.sectionOrder = \[\.\.\.canonical\.sectionIds\]/);
assert.doesNotMatch(mergeSource, /StorageManager\.load\(/,
  "a scoped canonical batch must never enter the destructive full-document loader");

const fetchSource = sourceBetween(/async function fetchRemoteSitePayload\(/, /function applyPublicFullPayload\(/);
assert.match(fetchSource, /publicScopeInflight\.has\(cacheKey\)/);
assert.match(fetchSource, /publicScopeCache\.get\(cacheKey\)/);
assert.match(fetchSource, /__songakPublicBootScopeRequest\?\.scope === scope/);
assert.match(fetchSource, /__songakPublicBootScopeRequest\?\.consumed !== true/);
assert.match(fetchSource, /if \(bootScopeRequest\) bootScopeRequest\.consumed = true/,
  "the parser-overlapped boot request must be consumed exactly once");
assert.match(fetchSource, /prefetched = bootScopeRequest\?\.promise \? await bootScopeRequest\.promise : null/);
assert.match(fetchSource, /if \(prefetched\?\.error\) throw prefetched\.error/,
  "a failed network prefetch must move to the single full-document recovery path");
assert.match(fetchSource, /if \(!response\) \{[\s\S]*?fetch\(`\/api\/site-content\/\$\{remoteSiteDocumentKey\}\$\{query\}`/,
  "a boot request that was not started must still use the normal scoped request path");
assert.match(fetchSource, /headers\["if-none-match"\] = cached\.etag/);
assert.match(fetchSource, /response\.status === 304/);
assert.match(fetchSource, /\?scope=\$\{encodeURIComponent\(scope\)\}/);
assert.match(fetchSource, /publicScopeCache\.clear\(\)/);
assert.match(fetchSource, /publicScopeInflight\.delete\(cacheKey\)/);
assert.doesNotMatch(fetchSource, /StorageManager\.load\(/);

const fullPayloadSource = sourceBetween(/function applyPublicFullPayload\(/, /async function loadFullPublicDocumentFallback\(/);
assert.match(fullPayloadSource, /StorageManager\.load\(fullContent\)/,
  "only an explicit complete document may enter the full restore path");
assert.equal((fullPayloadSource.match(/StorageManager\.load\(/g) || []).length, 1);

const fallbackSource = sourceBetween(/async function loadFullPublicDocumentFallback\(/, /async function hydratePublicMenuScope\(/);
assert.match(fallbackSource, /const record = await fetchRemoteSitePayload\(\)/,
  "full fallback must omit a scope query");
assert.match(fallbackSource, /return applyPublicFullPayload\(record, options\)/,
  "network recovery and scope fallback reuse the same complete-document loader");
assert.doesNotMatch(fallbackSource, /StorageManager\.load\(/);

const loadSnapshotSource = sourceBetween(/function loadSnapshot\(/, /const MainIntroManager = Object\.freeze/);
assert.match(loadSnapshotSource, /isPublicDocumentRequest\(\)[\s\S]*?normalizeClosedHomeMenu\(savedHomeMenu\)[\s\S]*?: normalizeHomeMenu\(savedHomeMenu\)/,
  "full public fallback hydration must also start with a closed menu");

const hydrationSource = sourceBetween(/async function hydratePublicMenuScope\(/, /async function readRemoteSiteDocument\(/);
assert.match(hydrationSource, /fetchRemoteSitePayload\(\{ scope: menuId \}\)/);
assert.match(hydrationSource, /scopeFallback === "unpublished"[\s\S]*?return false/,
  "an unpublished scope retains the checked-in complete site without a second request");
assert.match(hydrationSource, /scopeFallback === "legacy-document" \|\| scopeFallback === "incomplete-scope"/);
assert.match(hydrationSource, /applyPublicFullPayload\(record, options\)/,
  "legacy and incomplete scope responses reuse the complete document already returned");
assert.match(hydrationSource, /validatePublicScopedPayload\(record, menuId\)/);
assert.match(hydrationSource, /applyPublicScopedPayload\(canonical/);
assert.match(hydrationSource, /return loadFullPublicDocumentFallback\(options\)/);
assert.doesNotMatch(hydrationSource, /StorageManager\.load\(/,
  "scope hydration must delegate full restores only to the explicit fallback helper");

const publicNavigationSource = sourceBetween(/async function navigateToPublicHomeMenuSection\(/, /function navigateToHomeMenuSection\(/);
assert.match(publicNavigationSource, /const navigationSequence = \+\+publicNavigationSequence/);
assert.match(publicNavigationSource, /await hydratePublicMenuScope\(menuId, \{ navigationSequence \}\)/);
assert.match(publicNavigationSource, /navigationSequence !== publicNavigationSequence/);
assert.ok(publicNavigationSource.indexOf("await hydratePublicMenuScope") < publicNavigationSource.indexOf("window.history.pushState"),
  "history may change only after the requested scope is ready");
assert.match(publicNavigationSource, /lastCommittedPublicPath/);

const popstateSource = sourceBetween(/async function handlePublicPopState\(/, /window\.addEventListener\("popstate"/);
assert.match(popstateSource, /route\?\.footerDocument/);
assert.match(popstateSource, /navigateToHomeMenuSection\("home-menu-account", \{ historyMode: "none", committedPath: targetPath \}\)/,
  "footer routes reuse the lightweight account scope that always includes the footer");
assert.match(popstateSource, /window\.history\.replaceState/,
  "a failed history traversal must restore the last committed public URL");

const initialLoadSource = sourceBetween(/async function loadInitialSiteSnapshot\(/, /async function saveAndPublishRemoteSnapshot\(/);
assert.match(initialLoadSource, /const initialMenuId = initialRoute\?\.menuId \|\| "home-menu-account"/);
assert.match(initialLoadSource, /hydratePublicMenuScope\(initialMenuId, \{ render: false \}\)/);
assert.match(initialLoadSource, /window\.location\.replace\(externalPath\)/);
assert.match(initialLoadSource, /if \(!loaded\) publicFullDocumentMode = true/,
  "the checked-in public design must remain fully navigable when no publication exists");

const completeBootSource = sourceBetween(/function completeEditorBoot\(/, /function failEditorBoot\(/);
assert.match(completeBootSource, /const minimumVisibleMs = isPublicDocumentRequest\(\) \? 160 : 420/,
  "anonymous public pages use a short overlay while staff and edit surfaces retain the guarded delay");
assert.match(completeBootSource, /minimumVisibleMs - \(performance\.now\(\) - paintedAt\)/);

console.log("public scope loading tests OK");
