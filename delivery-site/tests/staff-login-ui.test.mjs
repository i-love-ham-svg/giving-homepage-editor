import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("routes public staff entry and SNS buttons through the temporary login form", async () => {
  const [publicPage, loginPage, editor] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/staff-login/page.tsx", root), "utf8"),
    readFile(new URL("../outputs/representative-greeting-editor.html", root), "utf8"),
  ]);

  assert.doesNotMatch(publicPage, /staff-login-link/);
  assert.match(loginPage, /\/api\/board\/admin\/login/);
  assert.match(loginPage, /id: String\(form\.get\("username"\)/);
  assert.match(loginPage, /type="password"/);
  assert.doesNotMatch(loginPage, /defaultValue=/);
  assert.match(editor, /\/staff-login\?provider=/);
  assert.match(editor, /state\.mode === "edit"/);
});
