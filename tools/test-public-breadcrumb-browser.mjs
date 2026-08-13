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
const routes = [
  ["/", ["홈"]],
  ["/about", ["복지관 소개", "대표자 인사말"]],
  ["/about/mission", ["복지관 소개", "미션·비전·슬로건"]],
  ["/about/corporate", ["복지관 소개", "운영법인 소개"]],
  ["/about/history", ["복지관 소개", "연혁"]],
  ["/directions", ["복지관 소개", "찾아오시는 길"]],
  ["/about/facility", ["복지관 소개", "시설현황"]],
  ["/about/organization", ["복지관 소개", "조직도·직원 안내"]],
  ["/programs", ["사업 안내", "프로그램 안내"]],
  ["/programs/schedule", ["사업 안내", "프로그램 일정표"]],
  ["/programs/schedule-original", ["사업 안내", "인쇄용 프로그램 시간표"]],
  ["/programs/case-management", ["사업 안내", "사례관리 이용 절차"]],
  ["/programs/application", ["사업 안내", "온라인 신청·문의"]],
  ["/participation/volunteer", ["참여마당", "자원봉사 안내"]],
  ["/participation/donation", ["참여마당", "후원 안내"]],
  ["/news/notices", ["알림마당", "공지·소식"]],
  ["/news/press", ["알림마당", "언론보도"]],
  ["/news/videos", ["알림마당", "영상 아카이브"]],
  ["/news/gallery", ["알림마당", "갤러리"]],
  ["/community", ["알림마당", "소통게시판"]],
  ["/privacy-policy", ["홈", "개인정보처리방침"]],
  ["/email-refusal", ["홈", "이메일무단수집거부"]],
];

const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
try {
  for (const viewport of [
    { width: 1360, height: 900, label: "desktop" },
    { width: 768, height: 1024, label: "tablet" },
    { width: 390, height: 844, label: "phone" },
    { width: 320, height: 700, label: "phoneSmall" },
  ]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    for (const [route, expectedLabels] of routes) {
      await page.goto(`${origin}${route}?breadcrumb-qa=${viewport.label}`, { waitUntil: "domcontentloaded" });
      await page.locator("[data-homepage-breadcrumb]:not([hidden])").waitFor({ timeout: 30_000 });
      const result = await page.evaluate(() => {
        const items = [...document.querySelectorAll("[data-homepage-breadcrumb]")];
        const visible = items.filter((element) => !element.hidden && getComputedStyle(element).display !== "none");
        const current = visible[0]?.querySelector('[aria-current="page"]');
        const rect = visible[0]?.getBoundingClientRect();
        const menuRect = document.querySelector("#homepageMenu")?.getBoundingClientRect();
        return {
          count: items.length,
          visibleCount: visible.length,
          labels: [...(visible[0]?.querySelectorAll("a, [aria-current='page']") || [])]
            .map((element) => element.textContent?.replace(/\s+/g, " ").trim() || ""),
          ariaLabel: visible[0]?.getAttribute("aria-label"),
          currentText: current?.textContent?.trim() || "",
          breadcrumbTop: rect?.top ?? null,
          menuBottom: menuRect?.bottom ?? null,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      assert.equal(result.count, 1, `${viewport.label} ${route}: one breadcrumb contract`);
      assert.equal(result.visibleCount, 1, `${viewport.label} ${route}: breadcrumb is visible`);
      assert.equal(result.ariaLabel, "현재 위치", `${viewport.label} ${route}: accessible label`);
      assert.deepEqual(result.labels, expectedLabels, `${viewport.label} ${route}: menu-derived breadcrumb labels`);
      assert.ok(result.currentText, `${viewport.label} ${route}: current page is marked`);
      assert.ok(result.breadcrumbTop >= result.menuBottom - 2, `${viewport.label} ${route}: breadcrumb starts below menu`);
      assert.ok(result.overflow <= 1, `${viewport.label} ${route}: no horizontal overflow`);
    }
    await context.close();
  }
  console.log(`public breadcrumb browser test OK (${routes.length} routes × 4 viewports)`);
} finally {
  await browser.close();
}
