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
  { name: "mobile", profile: "phone", width: 390, height: 844 }
];

try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    page.on("pageerror", (error) => issues.push(`${viewport.name}: ${error.message}`));
    await page.goto(`${editorUrl}?mode=edit&stylePage=account&viewport=${viewport.profile}`, { waitUntil: "commit" });
    await page.waitForSelector("#editorBootOverlay", { state: "visible" });
    const loadingCard = await page.evaluate(() => {
      const overlay = document.getElementById("editorBootOverlay");
      const card = overlay?.querySelector(".editor-boot-card");
      const cardRect = card?.getBoundingClientRect();
      return {
        title: document.getElementById("editorBootTitle")?.textContent?.trim(),
        message: document.getElementById("editorBootMessage")?.textContent?.trim(),
        retryHidden: document.getElementById("editorBootRetry")?.hidden,
        cardInsideViewport: Boolean(cardRect)
          && cardRect.left >= 0
          && cardRect.top >= 0
          && cardRect.right <= innerWidth
          && cardRect.bottom <= innerHeight
      };
    });
    if (!loadingCard.title?.includes("송악사회복지관")
      || !loadingCard.message?.includes("이용 정보를 불러오고 있습니다")
      || !loadingCard.retryHidden
      || !loadingCard.cardInsideViewport) {
      issues.push(`${viewport.name}: loading card content or bounds invalid ${JSON.stringify(loadingCard)}`);
    }

    await page.waitForFunction(() => document.body.dataset.editorBootState === "ready", null, { timeout: 15000 });
    await page.waitForSelector("#editorBootOverlay", { state: "hidden" });
    const ready = await page.evaluate(() => ({
      bodyLoading: document.body.classList.contains("is-app-booting"),
      appVisibility: getComputedStyle(document.querySelector(".app")).visibility,
      paintedAt: window.__songakEditorBoot?.paintedAt,
      readyAt: window.__songakEditorBoot?.readyAt,
      appHiddenAtPaint: window.__songakEditorBoot?.appHiddenAtPaint,
      overlayVisibleAtPaint: window.__songakEditorBoot?.overlayVisibleAtPaint,
      bootState: window.__songakEditorBoot?.state
    }));
    if (ready.bodyLoading || ready.appVisibility !== "visible" || ready.bootState !== "ready") {
      issues.push(`${viewport.name}: editor did not leave loading state ${JSON.stringify(ready)}`);
    }
    if (!(ready.paintedAt > 0) || !(ready.readyAt >= ready.paintedAt)) {
      issues.push(`${viewport.name}: boot timing markers invalid ${JSON.stringify(ready)}`);
    }
    if (!ready.appHiddenAtPaint || !ready.overlayVisibleAtPaint || ready.readyAt - ready.paintedAt < 410) {
      issues.push(`${viewport.name}: first paint was not protected by the loading overlay ${JSON.stringify(ready)}`);
    }
    await page.close();
  }
} finally {
  await browser.close();
}

if (issues.length) {
  console.error(issues.join("\n"));
  process.exitCode = 1;
} else {
  console.log("editor first-paint loading overlay browser tests OK");
}
