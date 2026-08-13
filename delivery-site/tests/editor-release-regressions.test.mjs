import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const editorUrl = new URL("../../outputs/representative-greeting-editor.html", import.meta.url);

test("homepage brands are keyboard-accessible home links without breaking edit-mode drag", async () => {
  const editor = await readFile(editorUrl, "utf8");

  assert.match(editor, /<a class="homepage-menu-brand" id="homepageMenuBrand" href="\/" aria-label="송악사회복지관 홈페이지">/);
  assert.match(editor, /<a class="homepage-menu-mobile-brand" id="homepageMenuMobileBrand" href="\/" aria-label="송악사회복지관 홈페이지">/);
  assert.match(editor, /homepageMenuBrand\.addEventListener\("click", \(event\) => \{[\s\S]*?document\.body\.dataset\.editorRole === "public"[\s\S]*?event\.preventDefault\(\);[\s\S]*?event\.stopPropagation\(\);[\s\S]*?clearHomeMenuView\(\)/);
  assert.match(editor, /function setupHomeMenuBrandDrag\(\)[\s\S]*?homepageMenuBrand\.addEventListener\("pointerdown"/);
});

test("official notice posters expose an accessible fallback when remote images fail", async () => {
  const [editor, essentialManager] = await Promise.all([
    readFile(editorUrl, "utf8"),
    readFile(new URL("../../outputs/editor-essential-manager.js", import.meta.url), "utf8"),
  ]);

  for (const posterId of [3461, 3460, 3450, 3449, 3448]) {
    assert.match(essentialManager, new RegExp(`poster\\(${posterId},`), `missing official poster ${posterId}`);
  }
  assert.match(editor, /className = "notice-rich-media-fallback"/);
  assert.match(editor, /fallback\.setAttribute\("role", "status"\)/);
  assert.match(editor, /image\.addEventListener\("error", showImageFallback, \{ once: true \}\)/);
  assert.match(editor, /이어지는 첨부파일에서 원본을 확인해 주세요/);
  assert.match(editor, /\.notice-rich-media-fallback\s*\{/);
});
