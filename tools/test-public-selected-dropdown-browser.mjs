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
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

async function assertSingleSelectedDropdown(label, contextOptions) {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  try {
    await page.goto(`${origin}/`, { waitUntil: "domcontentloaded" });
    await page.locator('#homepageMenu[data-layout-mode="selected-dropdown"]').waitFor({ timeout: 30_000 });
    if (!contextOptions.isMobile) {
      const [stageBox, menuBox] = await Promise.all([
        page.locator("#stage").boundingBox(),
        page.locator("#homepageMenu").boundingBox(),
      ]);
      assert.ok(stageBox && menuBox, `${label}: stage and menu are measurable`);
      assert.ok(Math.abs(stageBox.x - menuBox.x) < 1.5, `${label}: menu starts flush with the first section`);
      assert.ok(Math.abs(stageBox.width - menuBox.width) < 1.5, `${label}: menu spans the section width`);
      assert.equal(await page.locator("#homepageMenu").evaluate((element) => getComputedStyle(element).borderRadius), "0px", `${label}: menu and hero share one visual edge`);
      const accountSection = page.locator('.essential-section-layer:has(> .essential-section-content[data-detail-page-kind="account"][data-detail-section-kind="social"])');
      const accountBox = await accountSection.boundingBox();
      assert.ok(accountBox, `${label}: account section is measurable`);
      assert.ok(Math.abs(accountBox.y - (menuBox.y + menuBox.height)) < 1.5, `${label}: first section touches the menu without a blank strip`);
      const accountLayout = page.locator('.sns-auth-layout[data-sns-layout="drive-split"]');
      const accountLayoutBox = await accountLayout.boundingBox();
      assert.ok(accountLayoutBox && Math.abs(accountLayoutBox.y - accountBox.y) < 1.5, `${label}: account image has no inner top padding`);
      assert.equal(await accountLayout.evaluate((element) => getComputedStyle(element).borderRadius), "0px", `${label}: first section has no detached card corner`);
      const footerBox = await page.locator('.essential-section-layer[data-section-id="footer"]').boundingBox();
      assert.ok(footerBox && accountBox.y + accountBox.height <= footerBox.y + 1.5, `${label}: connected hero still ends before the footer`);
    }
    if (contextOptions.isMobile) {
      assert.match(await page.locator("#stage").getAttribute("class"), /mobile/, `${label}: mobile stage is active`);
      await page.locator("#homepageMenuToggle").click();
      assert.match(await page.locator("#homepageMenu").getAttribute("class"), /open/, `${label}: mobile menu opens`);
    }

    for (const rootLabel of ["복지관 소개", "사업 안내", "참여마당", "알림마당"]) {
      const button = page.locator("#homepageMenuList > .homepage-menu-item.level-1 > .homepage-menu-link", { hasText: rootLabel });
      await button.click();
      assert.equal(await button.getAttribute("aria-expanded"), "true", `${label}: ${rootLabel} expands`);
      assert.equal(await page.locator("#homepageMenuList > .homepage-menu-item.level-1.expanded").count(), 1, `${label}: only one root is expanded`);
      assert.equal(await page.locator("#homepageMenuSubbar").isVisible(), false, `${label}: legacy subbar stays hidden`);
      const visiblePanels = await page.locator("#homepageMenuSubbar, #homepageMenuList .homepage-submenu").evaluateAll((nodes) => nodes.filter((node) => {
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      }).map((node) => node.className));
      assert.deepEqual(visiblePanels, ["homepage-submenu quick-submenu quick-selected-dropdown"], `${label}: exactly one destination panel is visible`);
    }
  } finally {
    await context.close();
  }
}

try {
  await assertSingleSelectedDropdown("PC", { viewport: { width: 1329, height: 912 } });
  await assertSingleSelectedDropdown("mobile", {
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 Chrome/139.0 Mobile Safari/537.36",
  });
  console.log("public selected-dropdown PC/mobile regression test OK");
} finally {
  await browser.close();
}
