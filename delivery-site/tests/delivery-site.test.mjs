import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("builds the finished Songak community board shell", async () => {
  await access(new URL("dist/server/index.js", root));
  const [page, client, worker, packageJson] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/board-app.tsx", root), "utf8"),
    readFile(new URL("worker/index.ts", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
  ]);
  assert.match(page, /송악사회복지관/);
  assert.match(client, /복지관과 주민이/);
  assert.match(client, /주민 글쓰기/);
  assert.match(worker, /content-security-policy/);
  assert.match(worker, /x-content-type-options/);
  assert.doesNotMatch(page + client + packageJson, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
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

test("keeps the public site read-only and gates the staff editor with SIWC", async () => {
  const [page, editorPage, editorAccess, sessionRoute] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/editor/page.tsx", root), "utf8"),
    readFile(new URL("app/editor/editor-access.tsx", root), "utf8"),
    readFile(new URL("app/api/board/admin/session/route.ts", root), "utf8"),
  ]);
  assert.match(page, /mode=view/);
  assert.doesNotMatch(page, /mode=edit/);
  assert.match(editorPage, /requireChatGPTUser\("\/editor"\)/);
  assert.match(editorPage, /force-dynamic/);
  assert.match(editorAccess, /\/api\/board\/admin\/session/);
  assert.match(editorAccess, /if \(!session\.admin\)/);
  assert.match(editorAccess, /mode=edit/);
  assert.match(sessionRoute, /return_to=%2Feditor/);
});
