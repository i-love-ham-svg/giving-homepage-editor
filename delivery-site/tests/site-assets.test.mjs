import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("keeps canonical site images in an administrator-only R2 namespace", async () => {
  const [server, uploadRoute, publicRoute, hosting] = await Promise.all([
    readFile(new URL("lib/site-asset-server.ts", root), "utf8"),
    readFile(new URL("app/api/site-assets/route.ts", root), "utf8"),
    readFile(new URL("app/api/site-assets/[assetId]/route.ts", root), "utf8"),
    readFile(new URL(".openai/hosting.json", root), "utf8"),
  ]);

  assert.equal(JSON.parse(hosting).r2, "MEDIA");
  assert.match(uploadRoute, /assertSameOrigin/);
  assert.match(server, /isAdminRequest/);
  assert.match(server, /site-assets\/\$\{assetId\}/);
  assert.match(server, /image\/jpeg/);
  assert.match(server, /image\/png/);
  assert.match(server, /image\/webp/);
  assert.match(server, /image\/gif/);
  assert.match(server, /matchesImageSignature/);
  assert.match(server, /15 \* 1024 \* 1024/);
  assert.match(server, /max-age=31536000, immutable/);
  assert.match(server, /url: `\/api\/site-assets\/\$\{encodeURIComponent\(id\)\}`/);
  assert.doesNotMatch(server, /claimToken|owner_token_hash|status\s*!==?\s*["']temporary|board\//);
  assert.match(publicRoute, /export async function GET/);
  assert.match(publicRoute, /export async function HEAD/);
  assert.doesNotMatch(publicRoute, /isAdminRequest|assertSameOrigin/);
});

test("keeps the combined D1 draft and published row below the platform row limit", async () => {
  const server = await readFile(new URL("lib/site-content-server.ts", root), "utf8");
  assert.match(server, /const MAX_CONTENT_BYTES = 900 \* 1024/);
  assert.match(server, /Images belong in R2 through \/api\/site-assets/);
  assert.match(server, /편집 내용은 900KB까지 저장할 수 있습니다/);
  assert.doesNotMatch(server, /MAX_CONTENT_BYTES = 8 \* 1024 \* 1024/);
});
