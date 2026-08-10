import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const editorUrl = pathToFileURL(resolve("outputs", "representative-greeting-editor.html")).href;
const executablePath = [
  process.env.BROWSER_EXECUTABLE,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
].filter(Boolean).find(existsSync);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

try {
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  await page.goto(`${editorUrl}?mode=edit&stylePage=schedule`, { waitUntil: "commit" });
  await page.waitForSelector("#stage textarea:not([name]):visible");

  const transition = await page.evaluate(() => {
    const editorField = [...document.querySelectorAll("#stage textarea:not([name])")]
      .find((field) => field.getClientRects().length && getComputedStyle(field).visibility !== "hidden");
    editorField.focus();
    const focusedBefore = document.activeElement === editorField;
    setMode("view");
    const focusedAfter = document.activeElement === editorField;
    const invalidFields = [...stage.querySelectorAll("textarea:not([name]), input[type='text']:not([name]), input[type='url']:not([name]), select:not([name]), [contenteditable]")]
      .filter((field) => field.tabIndex >= 0 || (field instanceof HTMLTextAreaElement && !field.readOnly) || (field instanceof HTMLSelectElement && !field.disabled));
    return { focusedBefore, focusedAfter, invalidCount: invalidFields.length };
  });
  assert.equal(transition.focusedBefore, true);
  assert.equal(transition.focusedAfter, false);
  assert.equal(transition.invalidCount, 0);

  // A public-mode re-render must not reintroduce editor controls into the tab order.
  await page.evaluate(() => renderEssentialSection("footer"));
  await page.waitForTimeout(0);
  const rerenderInvalidCount = await page.evaluate(() => [...document.querySelectorAll("#footer textarea:not([name]), #footer input:not([name]), #footer select:not([name])")]
    .filter((field) => field.tabIndex >= 0 || (field instanceof HTMLTextAreaElement && !field.readOnly) || (field instanceof HTMLSelectElement && !field.disabled)).length);
  assert.equal(rerenderInvalidCount, 0);

  await page.goto(`${editorUrl}?mode=view&stylePage=application&type=volunteer`, { waitUntil: "commit" });
  await page.waitForSelector("#stage form [name]");
  const publicForm = await page.evaluate(() => {
    const fields = [...document.querySelectorAll("#stage form [name]")];
    return {
      count: fields.length,
      usable: fields.every((field) => !field.disabled && field.tabIndex >= 0)
    };
  });
  assert.ok(publicForm.count > 0);
  assert.equal(publicForm.usable, true);
  console.log("public preview semantics browser tests OK");
} finally {
  await browser.close();
}
