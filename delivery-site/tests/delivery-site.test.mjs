import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("builds the finished Songak community board shell", async () => {
  await access(new URL("dist/server/index.js", root));
  const [page, client, worker, packageJson, publicPage] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/board-app.tsx", root), "utf8"),
    readFile(new URL("worker/index.ts", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
    readFile(new URL("../outputs/representative-greeting-public.html", root), "utf8"),
  ]);
  assert.match(page, /송악사회복지관/);
  assert.match(client, /복지관과 주민이/);
  assert.match(client, /주민 글쓰기/);
  assert.match(worker, /content-security-policy/);
  assert.match(worker, /x-content-type-options/);
  assert.match(worker, /representative-greeting-public/);
  assert.match(worker, /cache-control/);
  assert.match(publicPage, /송악사회복지관 함께마당/);
  assert.match(publicPage, /\/staff-login\?provider=kakao/);
  assert.match(publicPage, /account-sns-photoreal-mobile-v2\.webp/);
  assert.match(publicPage, /href="\/about"/);
  assert.match(publicPage, /href="\/programs"/);
  assert.match(publicPage, /href="\/participation"/);
  assert.match(publicPage, /href="\/news"/);
  assert.match(publicPage, /href="\/privacy-policy"/);
  assert.match(publicPage, /이메일무단수집거부/);
  assert.match(publicPage, /찾아오시는 길/);
  assert.doesNotMatch(publicPage, /editor-[a-z-]+\.js|Hahmlet-Variable\.ttf|PretendardVariable\.woff2/);
  assert.doesNotMatch(page + client + packageJson, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("serves every public menu and footer document as a separate lightweight page", async () => {
  const pageFiles = [
    "public-about.html",
    "public-about-greeting.html",
    "public-about-mission.html",
    "public-about-corporate.html",
    "public-about-history.html",
    "public-about-facility.html",
    "public-about-organization.html",
    "public-programs.html",
    "public-programs-list.html",
    "public-programs-schedule.html",
    "public-programs-schedule-original.html",
    "public-programs-case-management.html",
    "public-programs-application.html",
    "public-participation.html",
    "public-participation-volunteer.html",
    "public-participation-donation.html",
    "public-news.html",
    "public-news-notices.html",
    "public-news-press.html",
    "public-news-videos.html",
    "public-news-gallery.html",
    "public-news-visitor-board.html",
    "public-privacy.html",
    "public-email-refusal.html",
    "public-directions.html",
  ];
  const pages = await Promise.all(pageFiles.map((file) => readFile(new URL(`../outputs/${file}`, root), "utf8")));
  const [worker, communityPage] = await Promise.all([
    readFile(new URL("worker/index.ts", root), "utf8"),
    readFile(new URL("app/community/page.tsx", root), "utf8"),
  ]);

  for (const page of pages) {
    assert.match(page, /<html lang="ko">/);
    assert.match(page, /\/songak\/public-site\.css/);
    assert.match(page, /href="\/about"/);
    assert.match(page, /href="\/programs"/);
    assert.match(page, /href="\/participation"/);
    assert.match(page, /href="\/news"/);
    assert.match(page, /href="\/privacy-policy"/);
    assert.match(page, /href="\/email-refusal"/);
    assert.match(page, /href="\/directions"/);
    assert.doesNotMatch(page, /representative-greeting-editor|editor-[a-z-]+\.js|mode=edit|<iframe/);
  }

  assert.match(worker, /PUBLIC_PAGE_ROUTES/);
  assert.match(worker, /"\/about": "\/songak\/public-about\.html"/);
  assert.match(worker, /"\/about\/greeting": "\/songak\/public-about-greeting\.html"/);
  assert.match(worker, /"\/programs\/case-management": "\/songak\/public-programs-case-management\.html"/);
  assert.match(worker, /"\/participation\/volunteer": "\/songak\/public-participation-volunteer\.html"/);
  assert.match(worker, /"\/news\/visitor-board": "\/songak\/public-news-visitor-board\.html"/);
  assert.match(worker, /request\.method === "HEAD"/);
  assert.match(worker, /Response\.redirect\(url\.toString\(\), 308\)/);
  assert.match(worker, /LEGACY_PUBLIC_REDIRECTS[\s\S]*?facility-detail[\s\S]*?\/about\/facility/);
  assert.match(worker, /representative-greeting-editor[\s\S]*?session\.admin[\s\S]*?\/staff-login/);
  assert.match(communityPage, /<BoardApp \/>/);
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
