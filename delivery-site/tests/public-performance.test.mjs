import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("keeps public boot non-blocking without removing any page renderer", async () => {
  const editor = await readFile(new URL("../outputs/representative-greeting-editor.html", root), "utf8");
  const managerScripts = [...editor.matchAll(/<script defer src="\.\/editor-[^"]+"><\/script>/g)];

  assert.equal(managerScripts.length, 21);
  assert.match(editor, /document\.addEventListener\("DOMContentLoaded", \(\) => \{\s+const securityRuntime/);
  assert.doesNotMatch(editor.match(/\.editor-boot-title \{[\s\S]*?\}/)?.[0] || "", /Hahmlet|Pretendard/);
  assert.match(editor, /cache: "no-cache"/);
  assert.match(editor, /siteContentDecodedBytes/);
  assert.match(editor, /overlayHiddenAt/);
  assert.match(editor, /reconcileLazySectionMounts/);
  assert.match(editor, /renderAllGreetingPhotos\(\{ visibleOnly: requestedViewMode \}\)/);
  assert.match(editor, /ensureDefaultDetailPresentations\(\{ render: !publicDocumentRequest \}\)/);
  assert.match(editor, /\{ deferRender: publicDocumentRequest \}/);
  assert.match(editor, /if \(!publicDocumentRequest\) \{\s+setupEditableSelectionDelegation\(\)/);
  assert.match(editor, /if \(!publicDocumentRequest\) initializeHistory\(\)/);
  const greetingStabilizer = editor.match(/function stabilizePublicGreetingLayouts\(sectionIds = null\) \{[\s\S]*?\n    \}/)?.[0] || "";
  assert.match(greetingStabilizer, /!isPublicDocumentRequest\(\)/);
  assert.match(greetingStabilizer, /document\.body\.dataset\.editorRole !== "public"/);
  assert.doesNotMatch(greetingStabilizer, /saveSnapshot|saveAndPublishRemoteSnapshot|localStorage/);
});

test("requests only the responsive account hero selected for a public viewport", async () => {
  const editor = await readFile(new URL("../outputs/representative-greeting-editor.html", root), "utf8");
  assert.match(editor, /sns-auth-desktop-image[^\n]+data-deferred-src/);
  assert.match(editor, /sns-auth-mobile-image[^\n]+data-deferred-src/);
  assert.match(editor, /document\.body\.dataset\.editorRole === "public" && isResponsiveViewport\(\) && normalizeViewportKey\(state\.viewport\) !== "tablet"/);
  assert.match(editor, /document\.body\.dataset\.editorRole === "public" && !isResponsiveViewport\(\)/);
});

test("revalidates published snapshots with ETag without stale caching", async () => {
  const [server, worker] = await Promise.all([
    readFile(new URL("lib/site-content-server.ts", root), "utf8"),
    readFile(new URL("worker/index.ts", root), "utf8"),
  ]);
  assert.match(server, /function publishedEtag/);
  assert.match(server, /current\?\.revision[\s\S]*?scope[\s\S]*?payloadBytes/);
  assert.match(server, /if-none-match/);
  assert.match(server, /status: 304/);
  assert.match(server, /public, no-cache, must-revalidate/);
  assert.doesNotMatch(server, /stale-while-revalidate|s-maxage/);
  assert.match(worker, /These editor bundles use stable filenames[\s\S]*?public, no-cache, must-revalidate/);
  assert.doesNotMatch(worker, /public, max-age=86400/);
});

test("supports menu-scoped public snapshots without shrinking draft editor documents", async () => {
  const server = await readFile(new URL("lib/site-content-server.ts", root), "utf8");
  assert.match(server, /publicScopePattern/);
  assert.match(server, /scopePublishedSiteContent/);
  assert.match(server, /requiredSectionIds = new Set\(\[\.\.\.menuSectionIds, "footer"\]\)/);
  assert.match(server, /legacySectionCollectionKeys\.forEach/);
  assert.match(server, /const requestedScope = wantsDraft \? null : readPublicContentScope\(url\)/);
  assert.match(server, /scopeFallback/);
});
