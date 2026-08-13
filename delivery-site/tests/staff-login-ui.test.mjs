import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("routes public staff entry and SNS buttons through the temporary login form", async () => {
  const [publicPage, loginPage, sessionRoute, board, editor, worker] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/staff-login/page.tsx", root), "utf8"),
    readFile(new URL("app/api/board/admin/session/route.ts", root), "utf8"),
    readFile(new URL("app/board-app.tsx", root), "utf8"),
    readFile(new URL("../outputs/representative-greeting-editor.html", root), "utf8"),
    readFile(new URL("worker/index.ts", root), "utf8"),
  ]);

  assert.doesNotMatch(publicPage, /staff-login-link/);
  assert.match(loginPage, /\/api\/board\/admin\/login/);
  assert.match(loginPage, /action="\/api\/board\/admin\/login"/);
  assert.match(loginPage, /method="post"/);
  assert.match(loginPage, /encType="application\/x-www-form-urlencoded"/);
  assert.match(loginPage, /id: String\(form\.get\("username"\)/);
  assert.match(loginPage, /type="password"/);
  assert.match(loginPage, /destination\.pathname === "\/community"/);
  assert.match(loginPage, /destination\.searchParams\.get\("manage"\) === "1"/);
  assert.match(loginPage, /window\.location\.assign\(returnToRef\.current/);
  assert.doesNotMatch(loginPage, /defaultValue=/);
  assert.match(sessionRoute, /\/staff-login\?returnTo=%2Fcommunity%3Fmanage%3D1/);
  assert.doesNotMatch(sessionRoute, /signin-with-chatgpt|signout-with-chatgpt/);
  assert.match(board, /useState\("\/staff-login\?returnTo=%2Fcommunity%3Fmanage%3D1"\)/);
  assert.match(editor, /\/staff-login\?provider=/);
  assert.match(editor, /state\.mode === "edit"/);
  assert.match(editor, /\["public", "visitor", "consumer"\]\.includes\(requestedEditorRole\)/);
  assert.match(editor, /body\.public-view-role \.mobile-preview-edit-btn/);
  assert.match(editor, /!document\.body\.classList\.contains\("public-view-role"\)/);
  assert.match(worker, /representative-greeting-editor/);
  assert.match(worker, /PUBLIC_PAGE_ROUTES/);
  assert.doesNotMatch(worker, /publicUrl\.searchParams\.set\("mode", "edit"\)/);
});
