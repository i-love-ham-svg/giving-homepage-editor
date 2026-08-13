import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";

const require = createRequire(new URL("../package.json", import.meta.url));
const { chromium } = require("playwright");
const executablePath = [
  process.env.BROWSER_EXECUTABLE,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean).find(existsSync);
const origin = process.env.SONGAK_QA_ORIGIN || "http://127.0.0.1:43216";
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

const cases = [
  { name: "desktop", profile: "desktop", viewport: { width: 1329, height: 912 } },
  { name: "tablet", profile: "tablet", viewport: { width: 820, height: 1180 }, mobile: true },
  { name: "phone", profile: "phone", viewport: { width: 390, height: 844 }, mobile: true },
  { name: "phone-small", profile: "phoneSmall", viewport: { width: 320, height: 700 }, mobile: true },
];

try {
  for (const testCase of cases) {
    const context = await browser.newContext({
      viewport: testCase.viewport,
      hasTouch: Boolean(testCase.mobile),
      isMobile: Boolean(testCase.mobile),
    });
    const page = await context.newPage();
    try {
      await page.goto(`${origin}/about?viewport=${testCase.profile}`, { waitUntil: "networkidle" });
      await page.locator(".main-intro-cta-row").waitFor();
      const result = await page.evaluate(() => {
        const row = document.querySelector(".main-intro-cta-row");
        const message = document.querySelector('[data-id="mainIntroRightText"]');
        const surface = document.querySelector(".main-intro-surface");
        const rowRect = row?.getBoundingClientRect();
        const messageRect = message?.getBoundingClientRect();
        const surfaceRect = surface?.getBoundingClientRect();
        const overlaps = Boolean(rowRect && messageRect
          && rowRect.left < messageRect.right && rowRect.right > messageRect.left
          && rowRect.top < messageRect.bottom && rowRect.bottom > messageRect.top);
        return {
          stageClass: document.querySelector("#stage")?.className,
          overlaps,
          row: rowRect && { top: rowRect.top, bottom: rowRect.bottom, left: rowRect.left, right: rowRect.right },
          message: messageRect && { top: messageRect.top, bottom: messageRect.bottom, left: messageRect.left, right: messageRect.right },
          surface: surfaceRect && { top: surfaceRect.top, bottom: surfaceRect.bottom },
          buttonHeights: [...row.querySelectorAll("button")].map((button) => Number.parseFloat(getComputedStyle(button).height)),
          horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
        };
      });
      console.log(JSON.stringify({ name: testCase.name, ...result }));
      assert.equal(result.overlaps, false, `${testCase.name}: CTA must not cover the right-side message`);
      assert.equal(result.horizontalOverflow, false, `${testCase.name}: CTA must not create horizontal overflow`);
      assert.ok(result.buttonHeights.every((height) => height >= 44), `${testCase.name}: CTA touch targets must remain at least 44px`);
      assert.ok(result.row.bottom <= result.surface.bottom + 1, `${testCase.name}: CTA must remain inside the main-intro surface`);
    } finally {
      await context.close();
    }
  }
  console.log("main intro CTA responsive position browser test OK");
} finally {
  await browser.close();
}
