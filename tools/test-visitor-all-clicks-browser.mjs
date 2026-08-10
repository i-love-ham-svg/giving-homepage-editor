import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const editorUrl = `${pathToFileURL(resolve("outputs", "representative-greeting-editor.html")).href}?mode=view`;
const executablePath = [
  process.env.BROWSER_EXECUTABLE,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
].filter(Boolean).find(existsSync);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const context = await browser.newContext({ viewport: { width: 1360, height: 900 } });
const page = await context.newPage();
const issues = [];
page.on("pageerror", (error) => issues.push(`pageerror: ${error.message}`));

await page.goto(editorUrl, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#stage");
await page.waitForTimeout(900);

const noticeDestinations = [
  ["home-menu-news-notice", "notice"],
  ["home-menu-news-press", "essential3"],
  ["home-menu-news-visitor", "essential8"]
];

let noticeClickCount = 0;
for (const [menuId, sectionId] of noticeDestinations) {
  await page.evaluate((id) => navigateToHomeMenuSection(id), menuId);
  const count = await page.evaluate((id) => elements[id]?.querySelectorAll('[data-essential-action="open-notice-detail"]').length ?? 0, sectionId);
  for (let index = 0; index < count; index += 1) {
    await page.evaluate(({ id, index: itemIndex }) => {
      elements[id].querySelectorAll('[data-essential-action="open-notice-detail"]')[itemIndex]?.click();
    }, { id: sectionId, index });
    const opened = await page.locator("#essentialNoticeDetailModal").evaluate((node) => !node.hidden);
    if (!opened) issues.push(`${sectionId} ${index + 1}번째 상세 모달이 열리지 않음`);
    await page.locator("#essentialNoticeDetailCloseBtn").click();
    noticeClickCount += 1;
  }
}

await page.evaluate(() => navigateToHomeMenuSection("home-menu-news-gallery"));
const galleryCount = await page.evaluate(() => elements.gallery?.querySelectorAll('[data-gallery-action="open-item"]').length ?? 0);
for (let index = 0; index < galleryCount; index += 1) {
  await page.evaluate((itemIndex) => elements.gallery.querySelectorAll('[data-gallery-action="open-item"]')[itemIndex]?.click(), index);
  const detail = await page.locator("#essentialNoticeDetailModal").evaluate((node) => ({ open: !node.hidden, image: Boolean(node.querySelector(".gallery-detail-figure img")) }));
  if (!detail.open || !detail.image) issues.push(`갤러리 ${index + 1}번째 사진 상세가 완전하게 열리지 않음`);
  await page.locator("#essentialNoticeDetailCloseBtn").click();
}

await page.evaluate(() => navigateToHomeMenuSection("home-menu-business-program"));
const programAction = page.locator(".program-card-cta-action.program-view-only").first();
if (await programAction.count()) {
  const pageCountBefore = context.pages().length;
  await programAction.click();
  await page.waitForLoadState("domcontentloaded");
  if (!page.url().includes("stylePage=application") || !page.url().includes("type=program")) issues.push("프로그램 CTA가 신청 페이지로 이동하지 않음");
  if (context.pages().length !== pageCountBefore) issues.push("프로그램 CTA가 새 창을 생성함");
} else {
  issues.push("프로그램 방문자 CTA가 없음");
}

await browser.close();
if (issues.length) throw new Error(issues.join("\n"));
console.log(`visitor all-click tests OK: notice ${noticeClickCount}, gallery ${galleryCount}, program CTA 1`);
