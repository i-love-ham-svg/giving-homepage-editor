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

const styleKeys = [
  "width", "minHeight", "marginTop", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "borderRadius", "backgroundColor", "color", "fontWeight", "textAlign"
];

try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    page.on("pageerror", (error) => issues.push(`${viewport.name}: ${error.message}`));
    await page.goto(`${editorUrl}?mode=edit&previewSection=donation&viewport=${viewport.profile}`, { waitUntil: "commit" });
    await page.waitForSelector(".donation-section-layer:not([hidden]) .donation-cta-input", { state: "attached" });
    await page.waitForTimeout(450);
    const result = await page.evaluate((keys) => {
      const layer = document.querySelector(".donation-section-layer:not([hidden])");
      const input = layer.querySelector(".donation-cta-input");
      const link = layer.querySelector(".donation-view-only");
      const read = (element) => {
        const style = getComputedStyle(element);
        return Object.fromEntries(keys.map((key) => [key, style[key]]));
      };
      const edit = read(input);
      setMode("view");
      const view = read(link);
      return {
        edit,
        view,
        linkHeight: link.getBoundingClientRect().height,
        href: link.getAttribute("href"),
        textMatches: input.value.trim() === link.textContent.trim()
      };
    }, styleKeys);
    styleKeys.forEach((key) => {
      if (result.edit[key] !== result.view[key]) {
        issues.push(`${viewport.name}: ${key} 불일치 (${result.edit[key]} / ${result.view[key]})`);
      }
    });
    if (result.linkHeight < 44) issues.push(`${viewport.name}: CTA 터치 높이가 44px 미만`);
    if (!result.textMatches) issues.push(`${viewport.name}: 편집/미리보기 CTA 문구 불일치`);
    if (!result.href.includes("stylePage=application&type=donation")) issues.push(`${viewport.name}: 후원 신청 링크 누락`);
    await page.close();
  }
} finally {
  await browser.close();
}

if (issues.length) {
  console.error(issues.join("\n"));
  process.exitCode = 1;
} else {
  console.log("donation CTA edit/view consistency browser tests OK");
}
