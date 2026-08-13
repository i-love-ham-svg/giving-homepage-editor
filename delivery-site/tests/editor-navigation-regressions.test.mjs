import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("keeps editor and board login returns on their own staff surfaces", async () => {
  const [sessionRoute, editorAccess, board] = await Promise.all([
    readFile(new URL("app/api/board/admin/session/route.ts", root), "utf8"),
    readFile(new URL("app/editor/editor-access.tsx", root), "utf8"),
    readFile(new URL("app/board-app.tsx", root), "utf8"),
  ]);

  assert.match(editorAccess, /const surface = new URLSearchParams\(window\.location\.search\)\.get\("surface"\) === "community"/);
  assert.match(editorAccess, /const returnTo = surface \? "\/editor\?surface=community" : "\/editor"/);
  assert.match(editorAccess, /\/api\/board\/admin\/session\?returnTo=\$\{encodeURIComponent\(returnTo\)\}/);
  assert.match(editorAccess, /if \(surface\) editorParams\.set\("surface", surface\)/);
  assert.match(sessionRoute, /requestedReturnTo === "\/editor\?surface=community"/);
  assert.match(sessionRoute, /encodeURIComponent\(safeEditorReturnTo\)/);
  assert.match(sessionRoute, /:\s*"\/staff-login\?returnTo=%2Fcommunity%3Fmanage%3D1"/);
  assert.match(board, /requestJson<\{ admin: boolean; signInPath: string \}>\("\/api\/board\/admin\/session"\)/);
  assert.match(board, /useState\("\/staff-login\?returnTo=%2Fcommunity%3Fmanage%3D1"\)/);
});

test("preserves the allowlisted community editor surface through temporary login", async () => {
  const loginPage = await readFile(new URL("app/staff-login/page.tsx", root), "utf8");

  assert.match(loginPage, /destination\.pathname === "\/editor"/);
  assert.match(loginPage, /destination\.searchParams\.get\("surface"\) === "community"/);
  assert.match(loginPage, /returnToRef\.current = "\/editor\?surface=community"/);
  assert.doesNotMatch(loginPage, /returnToRef\.current = requestedReturn/);
});

test("opens only the canonical community board from the editor", async () => {
  const editor = await readFile(new URL("../outputs/representative-greeting-editor.html", root), "utf8");
  const helper = editor.match(/function getDeliveryBoardUrl\(\) \{[\s\S]*?\n    \}/)?.[0] ?? "";

  assert.match(helper, /return "\/community\?manage=1";/);
  assert.doesNotMatch(helper, /community-board\.html|songak-delivery-board-url|window\.location\.protocol|window\.location\.hostname/);
  assert.match(editor, /home-menu-news-board", label: "소통게시판", sectionId: "", sectionIds: \[\], externalUrl: "delivery-board"/);
  assert.match(editor, /function retireLegacyVisitorBoard\(\)[\s\S]*?removeEssentialSection\("essential8"\)/);
});

test("classifies the representative greeting menu without changing the combined about surface", async () => {
  const [editor, board] = await Promise.all([
    readFile(new URL("../outputs/representative-greeting-editor.html", root), "utf8"),
    readFile(new URL("app/board-app.tsx", root), "utf8"),
  ]);

  assert.match(editor, /id: "home-menu-intro-main", label: "대표자 인사말", sectionId: "greeting", sectionIds: \["mainIntro", "greeting"\]/);
  assert.doesNotMatch(editor, /label: "메인 소개·대표자 인사말"/);
  assert.match(board, /id: "home-menu-intro-main", label: "대표자 인사말", href: "\/about"/);
});
