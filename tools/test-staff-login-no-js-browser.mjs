import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || "playwright");
const executablePath = [
  process.env.BROWSER_EXECUTABLE,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean).find(existsSync);
const origin = process.env.SONGAK_QA_ORIGIN || "http://localhost:43217";
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const context = await browser.newContext({ javaScriptEnabled: false });
const page = await context.newPage();
const fakeId = `no-js-user-${randomUUID()}`;
const fakePassword = `no-js-password-${randomUUID()}`;
let captured = null;

await context.route("**/api/board/admin/login", async (route) => {
  const request = route.request();
  captured = {
    method: request.method(),
    url: request.url(),
    contentType: request.headers()["content-type"] || "",
    body: request.postData() || "",
  };
  await route.fulfill({
    status: 400,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify({ error: "JavaScript-disabled login is safely rejected." }),
  });
});

try {
  await page.goto(`${origin}/staff-login?returnTo=%2Feditor`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="username"]').fill(fakeId);
  await page.locator('input[name="password"]').fill(fakePassword);
  await Promise.all([
    page.waitForRequest((request) => new URL(request.url()).pathname === "/api/board/admin/login"),
    page.locator('button[type="submit"]').click(),
  ]);

  assert.ok(captured, "the native form must submit to the safe login endpoint");
  const submittedUrl = new URL(captured.url);
  assert.equal(captured.method, "POST");
  assert.equal(submittedUrl.pathname, "/api/board/admin/login");
  assert.equal(submittedUrl.search, "", "credentials must never be serialized into the request URL");
  assert.match(captured.contentType, /^application\/x-www-form-urlencoded(?:;|$)/i);
  assert.match(captured.body, /(?:^|&)username=/);
  assert.match(captured.body, /(?:^|&)password=/);
  assert.equal(captured.url.includes(fakeId), false);
  assert.equal(captured.url.includes(fakePassword), false);
  assert.equal(page.url().includes(fakeId), false);
  assert.equal(page.url().includes(fakePassword), false);
  console.log("staff login no-JavaScript POST fallback OK");
} finally {
  await context.close();
  await browser.close();
}
