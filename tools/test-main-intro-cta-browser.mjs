import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const editorUrl = pathToFileURL(resolve("outputs", "representative-greeting-editor.html")).href;
const browserCandidates = [
  process.env.BROWSER_EXECUTABLE,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
].filter(Boolean);
const executablePath = browserCandidates.find(existsSync);
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
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    page.on("pageerror", (error) => issues.push(`${viewport.name}: ${error.message}`));
    await page.goto(`${editorUrl}?mode=view&stylePage=application&type=donation&viewport=${viewport.profile}`, { waitUntil: "commit" });
    await page.waitForSelector(".main-intro-cta-row", { state: "attached" });
    await page.waitForTimeout(500);
    const result = await page.evaluate(() => {
      const row = document.querySelector(".main-intro-cta-row");
      const buttons = [...row.querySelectorAll("button")];
      const applicationLayers = [...document.querySelectorAll('[data-detail-page-kind="application"]')]
        .filter((layer) => getComputedStyle(layer.closest(".essential-section-layer")).display !== "none");
      return {
        hidden: row.hidden,
        display: getComputedStyle(row).display,
        ariaHidden: row.getAttribute("aria-hidden"),
        tabIndexes: buttons.map((button) => button.tabIndex),
        applicationLayerCount: applicationLayers.length
      };
    });
    if (!result.hidden || result.display !== "none" || result.ariaHidden !== "true") {
      issues.push(`${viewport.name}: 신청 화면에 메인 CTA가 노출됨`);
    }
    if (result.tabIndexes.some((tabIndex) => tabIndex !== -1)) {
      issues.push(`${viewport.name}: 숨은 CTA가 키보드 순서에 남음`);
    }
    if (!result.applicationLayerCount) issues.push(`${viewport.name}: 신청 상세 영역이 표시되지 않음`);
    await page.close();
  }

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${editorUrl}?mode=view&viewport=desktop`, { waitUntil: "commit" });
  await page.waitForSelector(".main-intro-cta-row", { state: "attached" });
  await page.waitForTimeout(500);
  const mainResult = await page.evaluate(() => {
    const row = document.querySelector(".main-intro-cta-row");
    return {
      hidden: row.hidden,
      display: getComputedStyle(row).display,
      ariaHidden: row.getAttribute("aria-hidden"),
      labels: [...row.querySelectorAll("button")].map((button) => button.textContent.trim()),
      tabIndexes: [...row.querySelectorAll("button")].map((button) => button.tabIndex)
    };
  });
  if (mainResult.hidden || mainResult.display === "none" || mainResult.ariaHidden !== "false") {
    issues.push("desktop: 메인 소개 화면에서 CTA가 숨겨짐");
  }
  if (mainResult.labels.join("|") !== "프로그램 찾기|상담·이용 문의") issues.push("CTA 문구가 변경됨");
  if (mainResult.tabIndexes.some((tabIndex) => tabIndex !== 0)) issues.push("표시된 CTA의 키보드 접근이 차단됨");
  await page.close();
} finally {
  await browser.close();
}

if (issues.length) {
  console.error(issues.join("\n"));
  process.exitCode = 1;
} else {
  console.log("main intro CTA browser tests OK");
}
