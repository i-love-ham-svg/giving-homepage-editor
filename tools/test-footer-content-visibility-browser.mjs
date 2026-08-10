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
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    page.on("pageerror", (error) => issues.push(`${viewport.name}: ${error.message}`));
    await page.goto(`${editorUrl}?mode=view&viewport=${viewport.profile}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.body.dataset.editorBootState === "ready");
    await page.evaluate(() => navigateToHomeMenuSection("home-menu-intro-main"));
    await page.waitForTimeout(650);
    const metrics = await page.evaluate(() => {
      const footer = elements.footer;
      const content = footer?.querySelector('.essential-section-content[data-essential-template="footer"]');
      const contentRect = content?.getBoundingClientRect();
      const footerRect = footer?.getBoundingClientRect();
      const children = [...(content?.children ?? [])]
        .filter((child) => getComputedStyle(child).display !== "none")
        .map((child) => ({ className: child.className, rect: child.getBoundingClientRect() }));
      const minTop = children.length ? Math.min(...children.map((entry) => entry.rect.top)) : 0;
      const maxBottom = children.length ? Math.max(...children.map((entry) => entry.rect.bottom)) : 0;
      const details = [...(content?.querySelectorAll(".essential-detail") ?? [])]
        .filter((item) => getComputedStyle(item).display !== "none")
        .map((item) => {
          const rect = item.getBoundingClientRect();
          return { top: rect.top, left: rect.left, width: rect.width, scrollWidth: item.scrollWidth, clientWidth: item.clientWidth };
        });
      const policyItems = [...(content?.querySelectorAll(".essential-item-title") ?? [])]
        .filter((item) => getComputedStyle(item).display !== "none")
        .map((item) => ({ fontSize: parseFloat(getComputedStyle(item).fontSize), scrollWidth: item.scrollWidth, clientWidth: item.clientWidth }));
      return {
        footerRect,
        contentRect,
        minTop,
        maxBottom,
        paddingTop: content ? parseFloat(getComputedStyle(content).paddingTop) : 0,
        paddingBottom: content ? parseFloat(getComputedStyle(content).paddingBottom) : 0,
        scrollHeight: content?.scrollHeight ?? 0,
        clientHeight: content?.clientHeight ?? 0,
        children,
        details,
        policyItems
      };
    });
    // Chromium can report scrollHeight 3–4 CSS pixels above clientHeight after the
    // responsive stage transform even when every rendered child is inside the footer.
    const tolerance = 5;
    if (!metrics.footerRect || !metrics.contentRect) issues.push(`${viewport.name}: footer missing`);
    if (metrics.minTop < metrics.contentRect.top - tolerance) issues.push(`${viewport.name}: footer child clipped above ${JSON.stringify(metrics)}`);
    if (metrics.maxBottom > metrics.contentRect.bottom + tolerance) issues.push(`${viewport.name}: footer child clipped below ${JSON.stringify(metrics)}`);
    if (metrics.scrollHeight > metrics.clientHeight + tolerance) issues.push(`${viewport.name}: footer content overflow ${JSON.stringify(metrics)}`);
    if (viewport.profile === "phone" || viewport.profile === "phoneSmall") {
      const detailLefts = new Set(metrics.details.map((item) => Math.round(item.left)));
      if (detailLefts.size > 1) issues.push(`${viewport.name}: footer contacts must use one column ${JSON.stringify(metrics.details)}`);
      if (metrics.details.some((item) => item.scrollWidth > item.clientWidth + 1)) issues.push(`${viewport.name}: footer contact text overflows ${JSON.stringify(metrics.details)}`);
      if (metrics.policyItems.some((item) => item.fontSize > 14.1 || item.scrollWidth > item.clientWidth + 1)) issues.push(`${viewport.name}: footer policy link is not mobile-safe ${JSON.stringify(metrics.policyItems)}`);
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
  console.log("footer content visibility tests OK on 4 viewports");
}
