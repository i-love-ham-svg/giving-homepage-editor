import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";

const require = createRequire(import.meta.url);
const executablePath = [
  process.env.BROWSER_EXECUTABLE,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean).find(existsSync);
const origin = process.env.SONGAK_QA_ORIGIN || "http://127.0.0.1:43216";
const staffId = String(process.env.SONGAK_QA_STAFF_ID || "").trim();
const staffPassword = String(process.env.SONGAK_QA_STAFF_PASSWORD || "");

if (!staffId || !staffPassword) {
  console.log("local staff menu-style selection regression test skipped (QA credentials not provided)");
  process.exit(0);
}

const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || "playwright");
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();

try {
  await page.goto(`${origin}/staff-login?returnTo=%2Feditor`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="username"]').fill(staffId);
  await page.locator('input[name="password"]').fill(staffPassword);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => url.pathname === "/editor");

  const editor = page.frameLocator("iframe.editor-frame");
  const layoutSelect = editor.locator("#menuEditorLayoutModeSelect");
  await layoutSelect.waitFor({ state: "attached", timeout: 20_000 });
  assert.equal(await layoutSelect.inputValue(), "selected-dropdown", "the migrated Songak menu uses the new default style");
  const options = await layoutSelect.locator("option").evaluateAll((nodes) => nodes.map((node) => ({ value: node.value, label: node.textContent?.trim() })));
  assert.ok(options.some((option) => option.value === "selected-dropdown" && option.label?.includes("해당 메뉴만 펼침")));
  assert.ok(options.some((option) => option.value === "cascade" && option.label?.includes("계단형")));

  await editor.locator("#homepageMenuEditBtn").click();
  await layoutSelect.waitFor({ state: "visible" });
  await layoutSelect.selectOption("cascade");
  await editor.locator('#homepageMenu[data-layout-mode="cascade"]').waitFor();
  await layoutSelect.selectOption("selected-dropdown");
  await editor.locator('#homepageMenu[data-layout-mode="selected-dropdown"]').waitFor();

  console.log("local staff menu-style selection regression test OK");
} finally {
  await context.close();
  await browser.close();
}
