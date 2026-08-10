import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const candidates = [
  process.env.BROWSER_EXECUTABLE,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
].filter(Boolean);
const executablePath = candidates.find(existsSync);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const url = pathToFileURL(resolve("outputs", "representative-greeting-editor.html")).href;

try {
  const page = await browser.newPage({ viewport: { width: 1569, height: 912 } });
  await page.goto(`${url}?mode=view&viewport=desktop`, { waitUntil: "commit" });
  await page.waitForSelector("#homepageMenu[data-layout-mode='two-level']");
  await page.waitForFunction(() => window.EditorModules?.sectionManager);
  const root = page.locator("#homepageMenu .homepage-menu-item.level-1 .homepage-menu-link.has-children").first();
  await root.click();
  await page.waitForSelector("#homepageMenu .homepage-menu-subbar.layout-two-level:not([hidden])");
  const desktop = await page.evaluate(() => ({
    layout: document.querySelector("#homepageMenu")?.dataset.layoutMode,
    rootCount: document.querySelectorAll("#homepageMenu .homepage-menu-list > .homepage-menu-item.level-1").length,
    destinationCount: document.querySelectorAll("#homepageMenu .homepage-menu-subbar.layout-two-level .homepage-subbar-link").length,
    columns: getComputedStyle(document.querySelector("#homepageMenu .homepage-menu-subbar.layout-two-level")).gridTemplateColumns,
    background: getComputedStyle(document.querySelector("#homepageMenu")).backgroundColor
  }));
  if (desktop.layout !== "two-level" || desktop.rootCount < 4 || desktop.destinationCount < 1) {
    throw new Error(`simple desktop menu failed: ${JSON.stringify(desktop)}`);
  }

  await page.goto(`${url}?mode=view&viewport=phone`, { waitUntil: "commit" });
  await page.waitForSelector("#homepageMenu");
  await page.locator("#homepageMenu .homepage-menu-toggle").click();
  await page.waitForSelector("#homepageMenu.open .homepage-menu-list");
  const mobile = await page.evaluate(() => ({
    layout: document.querySelector("#homepageMenu")?.dataset.layoutMode,
    open: document.querySelector("#homepageMenu")?.classList.contains("open"),
    rootCount: document.querySelectorAll("#homepageMenu .homepage-menu-item.level-1").length
  }));
  if (mobile.layout !== "two-level" || !mobile.open || mobile.rootCount < 4) {
    throw new Error(`simple mobile menu failed: ${JSON.stringify(mobile)}`);
  }
  console.log(JSON.stringify({ desktop, mobile }, null, 2));
  console.log("simple home menu browser test OK");
} finally {
  await browser.close();
}
