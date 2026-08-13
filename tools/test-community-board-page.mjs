import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const communityPage = readFileSync(new URL("../delivery-site/app/community/page.tsx", import.meta.url), "utf8");
const board = readFileSync(new URL("../delivery-site/app/board-app.tsx", import.meta.url), "utf8");
const worker = readFileSync(new URL("../delivery-site/worker/index.ts", import.meta.url), "utf8");
const editor = readFileSync(new URL("../outputs/representative-greeting-editor.html", import.meta.url), "utf8");
const serverSource = readFileSync(new URL("./serve-editor.mjs", import.meta.url), "utf8");
const { createEditorServer } = await import("./serve-editor.mjs");

assert.match(communityPage, /import \{ BoardApp \}/);
assert.match(communityPage, /return <BoardApp \/>/);
assert.match(board, /data-songak-board-shell="renewal"/);
assert.match(board, /\/api\/board\/posts/);
assert.match(board, /\/api\/board\/media/);
assert.match(board, /navigator\.share/);
assert.match(board, /thumbnailMediaId/);
assert.match(board, /accept="image\/jpeg,image\/png,image\/webp,image\/gif,video\/mp4,video\/webm"/);
assert.match(board, /className="admin-console"/);
assert.match(board, /className="moderation-panel"/);
assert.match(board, /requestJson<\{ admin: boolean; signInPath: string \}>\("\/api\/board\/admin\/session"\)/);
assert.match(board, /const requestedEditorEmbed = params\.get\("editorEmbed"\) === "1" && window\.parent !== window && \/\^\[a-z0-9_-\]\{16,128\}\$\/i\.test\(nonce\)/);
assert.match(board, /if \(result\.admin && requestedEditorEmbed\) \{[\s\S]*?setCommunityEditor\(\{ active: true, nonce \}\)/);

assert.match(worker, /url\.pathname === "\/community-board"[\s\S]*?url\.pathname = "\/community"/);
assert.match(worker, /url\.pathname === "\/page\/home-menu-news-board" \|\| url\.pathname === "\/page\/home-menu-news-visitor"[\s\S]*?url\.pathname = "\/community"/);
assert.match(worker, /"\/news\/visitor-board": "\/community"/);
assert.doesNotMatch(worker, /"\/community": "\/songak\/representative-greeting-editor\.html"/);

assert.match(editor, /communityFrame\.src = `\/community\?editorEmbed=1&editorNonce=\$\{encodeURIComponent\(communityNonce\)\}`/);
assert.match(editor, /function activateCommunitySurface\(\) \{[\s\S]*?!\["staff", "developer"\]\.includes\(document\.body\.dataset\.editorRole \|\| ""\)[\s\S]*?return false/);
assert.match(editor, /window\.location\.assign\(getDeliveryBoardUrl\(\)\)/);
assert.match(editor, /home-menu-news-board", label: "소통게시판", sectionId: "", sectionIds: \[\], externalUrl: "delivery-board"/);
assert.match(editor, /function retireLegacyVisitorBoard\(\)[\s\S]*?removeEssentialSection\("essential8"\)/);
assert.doesNotMatch(editor, /songak-delivery-board-url/);
assert.match(serverSource, /handleRetiredIntegratedServiceRequest/);
assert.match(serverSource, /sendJson\(res, 410/);
assert.match(serverSource, /Community board QA: run delivery-site and use its canonical \/community route/);
assert.match(serverSource, /Application API QA: run delivery-site and use its canonical \/api\/applications route/);
assert.doesNotMatch(serverSource, /BoardStore|handleBoardRequest|boardStore|visitorPostAttempts|ApplicationStore|handleApplicationRequest|applicationStore/);

const previewServer = createEditorServer();
await new Promise((resolve, reject) => {
  previewServer.once("error", reject);
  previewServer.listen(0, "127.0.0.1", resolve);
});

try {
  const address = previewServer.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const editorResponse = await fetch(`${baseUrl}/representative-greeting-editor.html`, {
    headers: { connection: "close" },
  });
  assert.equal(editorResponse.status, 200);

  for (const [pathname, method = "GET"] of [
    ["/community"],
    ["/community/"],
    ["/community-board.html"],
    ["/songak/community-board.html"],
    ["/api/board/posts"],
    ["/api/board/media", "POST"],
    ["/board-media/legacy-image"],
    ["/songak/api/board/posts"],
  ]) {
    const response = await fetch(`${baseUrl}${pathname}`, {
      method,
      headers: { connection: "close" },
    });
    assert.equal(response.status, 410, `${pathname} must not fall back to the static editor server`);
    const payload = await response.json();
    assert.equal(payload.service, "delivery-site");
    assert.equal(payload.canonicalPath, "/community");
  }

  for (const [pathname, method] of [
    ["/api/applications", "POST"],
    ["/api/applications", "GET"],
    ["/songak/api/applications", "POST"],
  ]) {
    const response = await fetch(`${baseUrl}${pathname}`, {
      method,
      headers: { connection: "close" },
    });
    assert.equal(response.status, 410, `${method} ${pathname} must use the integrated delivery-site API`);
    const payload = await response.json();
    assert.equal(payload.service, "delivery-site");
    assert.equal(payload.canonicalPath, "/api/applications");
  }
} finally {
  await new Promise((resolve, reject) => {
    previewServer.close((error) => error ? reject(error) : resolve());
    previewServer.closeAllConnections();
  });
}

console.log("canonical community board tests OK");
