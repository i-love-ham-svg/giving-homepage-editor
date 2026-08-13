import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const editorUrl = new URL("../public/songak/representative-greeting-editor.html", import.meta.url);

test("keeps interior page headings below the shared homepage menu", async () => {
  const editor = await readFile(editorUrl, "utf8");
  assert.match(editor, /function getHomeMenuFlowOffsetPx[\s\S]*?if \(!isHomeMenuViewActive\(\)\) return 0/);
  assert.match(editor, /linkedSectionIds\.includes\("main-intro"\)\) return 0/);
  assert.match(editor, /return Math\.ceil\(menuTop \+ menuHeight/);
  assert.doesNotMatch(editor, /function getHomeMenuFlowOffsetPx\([^)]*\) \{\s*return 0;\s*\}/);
});
