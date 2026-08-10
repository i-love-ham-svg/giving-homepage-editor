import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const editorUrl = pathToFileURL(resolve("outputs", "representative-greeting-editor.html")).href;
const executablePath = [process.env.BROWSER_EXECUTABLE, "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"].filter(Boolean).find(existsSync);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const issues = [];

try {
  for (const type of ["volunteer", "donation"]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 850 } });
    const page = await context.newPage();
    page.on("pageerror", (error) => issues.push(`${type}: ${error.message}`));
    await page.goto(`${editorUrl}?mode=view`, { waitUntil: "commit" });
    await page.waitForFunction(() => typeof navigateToHomeMenuSection === "function");
    await page.evaluate((targetType) => navigateToHomeMenuSection(
      targetType === "volunteer" ? "home-menu-participation-volunteer" : "home-menu-participation-donation"
    ), type);
    await page.waitForSelector(`#stage a[href*="type=${type}"]`, { state: "attached" });
    const beforePages = context.pages().length;
    await page.locator(`#stage a[href*="type=${type}"]`).first().click();
    await page.waitForSelector('[data-detail-application-form]', { state: "visible" });
    const result = await page.evaluate(() => ({
      type: new URLSearchParams(location.search).get("type"),
      selected: document.querySelector('[data-detail-application-form] select')?.value,
      activeMenu: state.activeHomeMenuId,
      visible: Boolean(document.querySelector('[data-detail-application-form]')?.offsetParent)
    }));
    if (context.pages().length !== beforePages) issues.push(`${type}: 새 창이 생성됨`);
    if (result.type !== type || result.selected !== type) issues.push(`${type}: 신청 분야 자동 선택 실패 ${JSON.stringify(result)}`);
    if (result.activeMenu !== "home-menu-business-application" || !result.visible) issues.push(`${type}: 현재 화면 내부 전환 실패 ${JSON.stringify(result)}`);
    await context.close();
  }
} finally {
  await browser.close();
}

if (issues.length) {
  console.error(issues.join("\n"));
  process.exitCode = 1;
} else console.log("application inline-navigation browser tests OK");
