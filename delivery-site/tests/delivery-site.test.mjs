import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("builds the finished Songak public site and community board shell", async () => {
  await access(new URL("dist/server/index.js", root));
  const [page, client, worker, packageJson, publicPage] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/board-app.tsx", root), "utf8"),
    readFile(new URL("worker/index.ts", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
    readFile(new URL("../outputs/representative-greeting-editor.html", root), "utf8"),
  ]);
  assert.match(page, /송악사회복지관/);
  assert.match(client, /복지관과 주민이/);
  assert.match(client, /주민 글쓰기/);
  assert.match(worker, /content-security-policy/);
  assert.match(worker, /x-content-type-options/);
  assert.match(worker, /representative-greeting-editor/);
  assert.match(worker, /cache-control/);
  assert.match(worker, /representative-greeting-editor\.html[\s\S]*?public, no-cache, must-revalidate/);
  assert.doesNotMatch(worker, /max-age=300|stale-while-revalidate=3600/);
  assert.match(publicPage, /SONGAK_PUBLIC_ROUTE_CONFIG/);
  assert.match(publicPage, /\/api\/site-content\/\$\{remoteSiteDocumentKey\}/);
  assert.match(publicPage, /saveAndPublishRemoteSnapshot/);
  assert.match(publicPage, /reconcileLazySectionMounts/);
  assert.doesNotMatch(page + client + packageJson, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("serves every public menu, board, and footer document through the canonical read-only renderer", async () => {
  const [worker, editor, viteConfig] = await Promise.all([
    readFile(new URL("worker/index.ts", root), "utf8"),
    readFile(new URL("../outputs/representative-greeting-editor.html", root), "utf8"),
    readFile(new URL("vite.config.ts", root), "utf8"),
  ]);
  assert.match(worker, /PUBLIC_PAGE_ROUTES/);
  assert.match(viteConfig, /assets: \{ html_handling: "none" as const \}/);
  for (const route of ["/about/greeting", "/about/mission", "/about/facility", "/programs/list", "/programs/case-management", "/participation/volunteer", "/news/visitor-board", "/community", "/privacy-policy", "/email-refusal", "/directions"]) {
    assert.match(worker, new RegExp(`"${route.replaceAll("/", "\\/")}": "\\/songak\\/representative-greeting-editor\\.html"`));
  }
  assert.match(editor, /"\/about\/greeting": \{ menuId: "home-menu-intro-main" \}/);
  assert.match(editor, /"\/community": \{ menuId: "home-menu-news-board" \}/);
  assert.match(editor, /home-menu-news-board", label: "소통게시판", sectionId: "essential8", sectionIds: \["essential8"\]/);
  assert.match(editor, /"\/privacy-policy": \{ sectionId: "footer", footerDocument: "privacy" \}/);
  assert.match(editor, /body\.public-view-role \.footer-document-source \{ display: none; \}/);
  assert.match(editor, /publicRoute\?\.menuId/);
  assert.match(editor, /publicRoute\?\.footerDocument/);
  assert.match(worker, /request\.method === "HEAD"/);
  assert.match(worker, /Response\.redirect\(url\.toString\(\), 308\)/);
  assert.match(worker, /LEGACY_PUBLIC_REDIRECTS[\s\S]*?facility-detail[\s\S]*?\/about\/facility/);
  assert.match(worker, /representative-greeting-editor[\s\S]*?session\.admin[\s\S]*?\/staff-login/);
  assert.match(worker, /url\.pathname === "\/community" && url\.searchParams\.get\("manage"\) === "1"[\s\S]*?session\.admin[\s\S]*?handler\.fetch\(request/);
});

test("keeps public gallery sizing content-driven and preserves staff images", async () => {
  const editor = await readFile(new URL("../outputs/representative-greeting-editor.html", root), "utf8");
  assert.match(editor, /return Math\.max\(minimumHeight, estimated, measured\);/);
  assert.match(editor, /name: "gallery"[\s\S]*?allowViewMode: true/);
  assert.match(editor, /document\.fonts\?\.ready[\s\S]*?fitGalleryBaseTextToContent/);
  assert.match(editor, /getUnscaledGalleryElementSize[\s\S]*?clientWidth[\s\S]*?clientHeight/);
  assert.match(editor, /gallery-base-text-input\.gallery-headline-input \{ line-height: 1\.16; \}/);
  assert.doesNotMatch(editor, /currentGallery && !currentGallery\.items\.some\([\s\S]*?official-sacwc/);
  assert.match(editor, /const officialNoticeMigrated = false;/);
  assert.match(editor, /const officialSiteMigrated = false;/);
  assert.doesNotMatch(editor, /const officialSiteMigrated = migrateOfficialSiteContent\(\)/);
});

test("ships durable board storage, moderation, and media routes", async () => {
  const [hosting, migration, boardServer, mediaServer, client] = await Promise.all([
    readFile(new URL(".openai/hosting.json", root), "utf8"),
    readFile(new URL("drizzle/0000_nifty_photon.sql", root), "utf8"),
    readFile(new URL("lib/board-server.ts", root), "utf8"),
    readFile(new URL("lib/media-server.ts", root), "utf8"),
    readFile(new URL("app/board-app.tsx", root), "utf8"),
  ]);
  const hostingConfig = JSON.parse(hosting);
  assert.deepEqual({ d1: hostingConfig.d1, r2: hostingConfig.r2 }, { d1: "DB", r2: "MEDIA" });
  for (const table of ["posts", "media", "reports", "audit_logs", "rate_limits"]) assert.match(migration, new RegExp("CREATE TABLE `" + table + "`"));
  assert.match(migration, /idx_posts_public_feed/);
  assert.match(migration, /PRAGMA optimize/);
  assert.match(boardServer, /PBKDF2/);
  assert.match(boardServer, /songak_board_admin/);
  assert.match(boardServer, /oai-authenticated-user-email/);
  assert.match(boardServer, /BOARD_EDITOR_EMAILS/);
  assert.match(boardServer, /allowlist\.includes\(authenticatedEmail\)/);
  assert.match(boardServer, /enforceRateLimit/);
  assert.match(mediaServer, /matchesSignature/);
  assert.match(mediaServer, /100 \* 1024 \* 1024/);
  assert.match(client, /공개 승인/);
  assert.match(client, /navigator\.share/);
  assert.match(client, /사진·영상 추가/);
});

test("ships durable site drafts, publishing, version restore, and server authorization", async () => {
  const [migration, schema, server, route, publishRoute, versionsRoute, restoreRoute] = await Promise.all([
    readFile(new URL("drizzle/0001_site_content_versions.sql", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("lib/site-content-server.ts", root), "utf8"),
    readFile(new URL("app/api/site-content/[key]/route.ts", root), "utf8"),
    readFile(new URL("app/api/site-content/[key]/publish/route.ts", root), "utf8"),
    readFile(new URL("app/api/site-content/[key]/versions/route.ts", root), "utf8"),
    readFile(new URL("app/api/site-content/[key]/versions/[versionId]/restore/route.ts", root), "utf8"),
  ]);
  for (const table of ["site_documents", "site_versions"]) {
    assert.match(migration, new RegExp("CREATE TABLE `" + table + "`"));
    assert.match(schema, new RegExp("sqliteTable\\(\"" + table + "\""));
  }
  assert.match(migration, /idx_site_versions_document_revision/);
  assert.match(migration, /PRAGMA optimize/);
  assert.match(server, /isAdminRequest/);
  assert.match(server, /assertSameOrigin/);
  assert.match(server, /WHERE key = \? AND revision = \?/);
  assert.match(server, /SiteContentError\([^\n]+, 409\)/);
  assert.match(server, /MAX_CONTENT_BYTES/);
  assert.match(route, /saveSiteDraft/);
  assert.match(publishRoute, /publishSiteContent/);
  assert.match(versionsRoute, /listSiteVersions/);
  assert.match(restoreRoute, /restoreSiteVersion/);
});

test("keeps the public site read-only and gates the staff editor with temporary credentials or SIWC", async () => {
  const [page, editorPage, editorAccess, sessionRoute, loginRoute, logoutRoute, boardServer, editorHtml] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/editor/page.tsx", root), "utf8"),
    readFile(new URL("app/editor/editor-access.tsx", root), "utf8"),
    readFile(new URL("app/api/board/admin/session/route.ts", root), "utf8"),
    readFile(new URL("app/api/board/admin/login/route.ts", root), "utf8"),
    readFile(new URL("app/api/board/admin/logout/route.ts", root), "utf8"),
    readFile(new URL("lib/board-server.ts", root), "utf8"),
    readFile(new URL("../outputs/representative-greeting-editor.html", root), "utf8"),
  ]);
  assert.match(page, /송악사회복지관 공개 홈페이지/);
  assert.doesNotMatch(page, /<iframe|representative-greeting-editor/);
  assert.doesNotMatch(page, /mode=edit/);
  assert.doesNotMatch(editorPage, /requireChatGPTUser/);
  assert.match(editorPage, /force-dynamic/);
  assert.match(editorAccess, /\/api\/board\/admin\/session/);
  assert.match(editorAccess, /if \(!session\.admin\)/);
  assert.match(editorAccess, /mode=edit/);
  assert.match(sessionRoute, /return_to=%2Feditor/);
  assert.match(loginRoute, /createAdminSession/);
  assert.match(loginRoute, /temporary-editor-login/);
  assert.match(loginRoute, /"set-cookie"/);
  assert.match(logoutRoute, /clearAdminCookie/);
  assert.match(boardServer, /TEMP_EDITOR_ID/);
  assert.match(boardServer, /TEMP_EDITOR_PASSWORD/);
  assert.match(boardServer, /HMAC/);
  assert.match(boardServer, /HttpOnly/);
  assert.match(editorHtml, /isPublicView[\s\S]*?\/api\/board\/admin\/session[\s\S]*?window\.location\.replace\("\/staff-login"\)/);
  assert.match(boardServer, /SameSite=Lax/);
  assert.doesNotMatch(boardServer, /TEMP_EDITOR_PASSWORD\s*\?\?\s*["']/);
});
