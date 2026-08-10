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
const issues = [];
const viewports = [
  { name: "desktop", profile: "desktop", width: 1440, height: 900 },
  { name: "tablet", profile: "tablet", width: 820, height: 1180 },
  { name: "mobile", profile: "phone", width: 390, height: 844 },
  { name: "small-mobile", profile: "phoneSmall", width: 320, height: 720 }
];

try {
  for (const viewport of viewports) {
    for (const layoutMode of ["two-level", "mega", "disclosure", "sitemap"]) {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
      page.on("pageerror", (error) => issues.push(`${viewport.name}/${layoutMode}: ${error.message}`));
      await page.goto(`${editorUrl}?mode=view&viewport=${viewport.profile}`, { waitUntil: "commit" });
      await page.waitForSelector("#homepageMenu", { state: "visible" });
      await page.evaluate((mode) => {
        state.homeMenu.layoutMode = mode;
        state.homeMenu.open = true;
        renderHomeMenu({ syncInputs: false });
      }, layoutMode);
      await page.locator('[data-menu-id="home-menu-2"]').first().click();
      const destination = page.locator('[data-menu-id="home-menu-business-application"]:visible').first();
      if (!(await destination.count())) issues.push(`${viewport.name}/${layoutMode}: 첫 클릭 뒤 최종 목적지가 보이지 않음`);
      else {
        await destination.click();
        const active = await page.evaluate(() => state.activeHomeMenuId);
        if (active !== "home-menu-business-application") issues.push(`${viewport.name}/${layoutMode}: 두 번째 클릭 이동 실패 (${active})`);
      }
      await page.close();
    }
  }
} finally {
  await browser.close();
}

if (issues.length) {
  console.error(issues.join("\n"));
  process.exitCode = 1;
} else console.log("home menu two-click responsive browser tests OK");
