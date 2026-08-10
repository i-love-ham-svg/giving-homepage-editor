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
  assert.deepEqual(JSON.parse(hosting), { d1: "DB", r2: "MEDIA" });
  for (const table of ["posts", "media", "reports", "audit_logs", "rate_limits"]) assert.match(migration, new RegExp("CREATE TABLE `" + table + "`"));
  assert.match(migration, /idx_posts_public_feed/);
  assert.match(migration, /PRAGMA optimize/);
  assert.match(boardServer, /PBKDF2/);
  assert.match(boardServer, /songak_board_admin/);
  assert.match(boardServer, /enforceRateLimit/);
  assert.match(mediaServer, /matchesSignature/);
  assert.match(mediaServer, /100 \* 1024 \* 1024/);
  assert.match(client, /공개 승인/);
  assert.match(client, /navigator\.share/);
  assert.match(client, /사진·영상 추가/);
});
