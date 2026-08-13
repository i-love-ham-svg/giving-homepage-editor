import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("shares the saved homepage menu layout with the community board", async () => {
  const [editor, route] = await Promise.all([
    readFile(new URL("../public/songak/representative-greeting-editor.html", import.meta.url), "utf8"),
    readFile(new URL("../app/api/site-navigation/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(editor, /value="unified"/);
  assert.match(editor, /value="selected-dropdown">선택 메뉴 드롭다운형 · 해당 메뉴만 펼침/);
  assert.match(editor, /value="cascade">계단형 · 하위 단계 순서대로 펼침/);
  assert.match(editor, /layoutDesignVersion: 4/);
  assert.match(editor, /selectedDropdownDefaultVersion: 1/);
  assert.match(editor, /layoutMode: selectedDropdownDefaultVersion < 1[\s\S]*?\? "selected-dropdown"/);
  assert.match(editor, /const selectedDropdownMode = level === 1 && state\.homeMenu\.layoutMode === "selected-dropdown"/);
  assert.match(editor, /homepageMenuBrand\.addEventListener\("click"[\s\S]*?window\.location\.assign\("\/"\)/);
  assert.match(editor, /"selected-dropdown", "cascade", "two-level"/);
  assert.match(editor, /data-layout-mode="unified"/);
  assert.match(editor, /\["selected-dropdown", "cascade", "unified"\]\.includes/);
  assert.match(route, /homeMenu\?\.layoutMode/);
  assert.match(route, /selectedDropdownDefaultVersion < 1[\s\S]*?\? "selected-dropdown"/);
  assert.match(route, /brandMode/);
  assert.match(route, /logoShape/);
  assert.match(route, /brandPosition/);
  assert.match(route, /brandIndex/);
  assert.match(route, /homeMenu\.items\.map\(safeItem\)/);
  assert.match(route, /"home-menu-news-board": "\/community"/);
  assert.match(route, /cache-control/);
});
