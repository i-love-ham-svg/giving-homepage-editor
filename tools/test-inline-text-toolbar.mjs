import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync(new URL("../outputs/representative-greeting-editor.html", import.meta.url), "utf8");

assert.match(html, /id="inlineTextHistoryControl"/);
assert.match(html, /id="inlineUndoBtn"[\s\S]*?>↶<\/button>/);
assert.match(html, /id="inlineRedoBtn"[\s\S]*?>↷<\/button>/);
for (const alignment of ["left", "center", "right"]) {
  assert.match(html, new RegExp(`data-inline-text-align="${alignment}"`));
  assert.match(html, new RegExp(`notice-align-glyph align-${alignment}`));
}
assert.match(html, /inlineUndoBtn\.addEventListener\("click", undoHistory\)/);
assert.match(html, /inlineRedoBtn\.addEventListener\("click", redoHistory\)/);
assert.match(html, /inlineTextHistoryControl\.hidden = false/);
assert.match(html, /id="inlineUndoBtn" title="수정 전으로\(실행 취소\)" aria-label="수정 전으로\(실행 취소\)"/);
assert.match(html, /id="inlineRedoBtn" title="수정 후로\(다시 실행\)" aria-label="수정 후로\(다시 실행\)"/);
assert.match(html, /inlineUndoBtn\.disabled = state\.history\.undo\.length === 0/);
assert.match(html, /inlineRedoBtn\.disabled = state\.history\.redo\.length === 0/);
assert.match(html, /\.inline-text-history-control \{[\s\S]*?grid-template-columns: repeat\(2, 44px\)[\s\S]*?width: 90px/);
assert.match(html, /\.inline-toolbar \.inline-text-history-control button \{[\s\S]*?width: 44px[\s\S]*?min-width: 44px[\s\S]*?min-height: 44px/);
assert.match(html, /\.inline-toolbar\.mobile-sheet \.inline-text-history-control \{[\s\S]*?grid-column: span 2[\s\S]*?repeat\(2, minmax\(44px, 1fr\)\)[\s\S]*?min-width: 0/);
assert.match(html, /function handleEditorHistoryShortcut\(event\)[\s\S]*?state\.mode !== "edit"[\s\S]*?event\.isComposing[\s\S]*?event\.altKey/);
assert.match(html, /key === "z" \? \(event\.shiftKey \? "redo" : "undo"\)[\s\S]*?key === "y"/);
assert.match(html, /event\.preventDefault\(\)[\s\S]*?!essentialNoticeTextEditorModal\.hidden[\s\S]*?moveNoticeInlineHistory\(action\)[\s\S]*?flushPendingHistory\(\)[\s\S]*?undoHistory\(\)[\s\S]*?redoHistory\(\)/);
assert.match(html, /window\.addEventListener\("keydown", handleEditorHistoryShortcut\)/);
assert.match(html, /updateTextStyle\("align", button\.dataset\.inlineTextAlign\)/);
assert.match(html, /style\.align = normalizeTextAlignment\(value, "left"\)/);
assert.match(html, /applyTextAlignment\(element, style\)/);
assert.ok((html.match(/applyTextAlignment\(/g) || []).length >= 12);
assert.match(html, /id="inlineTextBoxWidthControl"/);
for (const group of ["text-box", "category", "category-step", "photo-file", "photo-background", "photo-fit", "photo-zoom", "layer-order"]) {
  assert.match(html, new RegExp(`data-toolbar-group="${group}"`));
}
assert.match(html, /data-toolbar-group="text-box"[\s\S]*?id="inlineIdentityAddBtn"[\s\S]*?id="inlineIdentityDeleteBtn"/);
assert.match(html, /\.inline-toolbar-action-group\s*\{[\s\S]*?grid-auto-flow: column[\s\S]*?grid-auto-columns: max-content/);
assert.match(html, /\.inline-toolbar\.mobile-sheet \.inline-toolbar-action-group\s*\{[\s\S]*?grid-column: span 2[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(html, /\.inline-toolbar\.mobile-sheet \.inline-toolbar-action-group\.group-three\s*\{[\s\S]*?repeat\(3, minmax\(0, 1fr\)\)/);
assert.match(html, /id="inlineTextBoxWidthRange"[^>]*min="30"[^>]*max="100"/);
for (const direction of ["left", "up", "down", "right"]) {
  assert.match(html, new RegExp(`data-inline-text-box-move="${direction}"`));
}
assert.match(html, /function applyTextBoxLayout\(element, style\)/);
assert.match(html, /updateTextStyle\("boxWidth", inlineTextBoxWidthRange\.value\)/);
assert.match(html, /moveSelectedTextBox\(button\.dataset\.inlineTextBoxMove/);
assert.ok((html.match(/applyTextBoxLayout\(/g) || []).length >= 12);

for (const filename of [
  "editor-essential-manager.js",
  "editor-gallery-manager.js",
  "editor-donation-manager.js",
  "editor-program-manager.js",
  "editor-process-manager.js",
  "editor-timeline-manager.js"
]) {
  const source = fs.readFileSync(new URL(`../outputs/${filename}`, import.meta.url), "utf8");
  assert.match(source, /align:\s*\["left", "center", "right"\]/, `${filename} must preserve text alignment`);
  assert.match(source, /boxWidth:/, `${filename} must preserve text box width`);
  assert.match(source, /boxOffsetX:/, `${filename} must preserve horizontal text box movement`);
  assert.match(source, /boxOffsetY:/, `${filename} must preserve vertical text box movement`);
}

console.log("inline text toolbar tests OK");
