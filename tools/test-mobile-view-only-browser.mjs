import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || "playwright");
const executablePath = [
  process.env.BROWSER_EXECUTABLE,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean).find(existsSync);
const origin = process.env.SONGAK_QA_ORIGIN || "http://127.0.0.1:43216";
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const page = await browser.newPage({ viewport: { width: 1329, height: 912 } });

try {
  await page.goto(`${origin}/mobile`, { waitUntil: "domcontentloaded" });
  const frameElement = page.locator("iframe.mobile-view-only-frame");
  await frameElement.waitFor({ timeout: 30_000 });
  const frameBox = await frameElement.boundingBox();
  assert.ok(frameBox && frameBox.width <= 391 && frameBox.width >= 389, "mobile viewer keeps a 390px public viewport");

  const publicFrame = page.frameLocator("iframe.mobile-view-only-frame");
  await publicFrame.locator("body.public-view-role").waitFor({ timeout: 30_000 });
  assert.match(await publicFrame.locator("#stage").getAttribute("class"), /mobile/, "embedded homepage uses its mobile layout");
  assert.equal(await publicFrame.locator(".topbar").isVisible(), false, "developer toolbar stays hidden");
  assert.equal(await publicFrame.locator(".staff-editor-dock").isVisible(), false, "staff editor dock stays hidden");
  await publicFrame.locator("#homepageMenuToggle").click();
  assert.match(await publicFrame.locator("#homepageMenu").getAttribute("class"), /open/, "mobile menu remains interactive");
  console.log("mobile view-only route regression test OK");
} finally {
  await browser.close();
}
