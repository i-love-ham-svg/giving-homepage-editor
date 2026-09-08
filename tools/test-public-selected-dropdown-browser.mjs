import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { createEditorServer } from "./serve-editor.mjs";
import { loadPlaywrightCore } from "../manual-video/v2/record-manual-v2.cjs";

const { chromium } = loadPlaywrightCore();
const executablePath = [
  process.env.BROWSER_EXECUTABLE,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean).find(existsSync);
const configuredOrigin = String(process.env.SONGAK_QA_ORIGIN || "").replace(/\/+$/, "");
const fixtureServer = configuredOrigin ? null : createEditorServer();
const origin = configuredOrigin || await new Promise((resolveListen, rejectListen) => {
  fixtureServer.once("error", rejectListen);
  fixtureServer.listen(0, "127.0.0.1", () => {
    fixtureServer.off("error", rejectListen);
    resolveListen(`http://127.0.0.1:${fixtureServer.address().port}`);
  });
});
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

function parseColor(value) {
  const components = String(value).match(/[\d.]+/g)?.map(Number) ?? [];
  assert.ok(components.length >= 3, `unsupported computed color: ${value}`);
  return { r: components[0], g: components[1], b: components[2], a: components[3] ?? 1 };
}

function relativeLuminance({ r, g, b }) {
  const channels = [r, g, b].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(foreground, background) {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

async function assertCurrentLeafContrast(page, label) {
  const currentLeaf = page.locator("#homepageMenuList .homepage-submenu .homepage-menu-link[aria-current='page']");
  await currentLeaf.waitFor({ state: "visible" });
  const style = await currentLeaf.evaluate((element) => {
    const computed = getComputedStyle(element);
    return { color: computed.color, backgroundColor: computed.backgroundColor, opacity: computed.opacity };
  });
  const foreground = parseColor(style.color);
  const background = parseColor(style.backgroundColor);
  assert.ok(background.a >= 0.99, `${label}: current leaf background must be opaque (${style.backgroundColor})`);
  assert.ok(Number(style.opacity) >= 0.99, `${label}: current leaf must stay fully opaque`);
  assert.ok(contrastRatio(foreground, background) >= 4.5, `${label}: current leaf contrast is too low (${style.color} on ${style.backgroundColor})`);
}

async function assertCurrentBranchContrast(page, label) {
  const branch = page.locator("#homepageMenuList > .homepage-menu-item.level-1 > .homepage-menu-link.contains-active");
  await branch.waitFor({ state: "visible" });
  const style = await branch.evaluate((element) => {
    const computed = getComputedStyle(element);
    return { color: computed.color, backgroundColor: computed.backgroundColor, opacity: computed.opacity };
  });
  const foreground = parseColor(style.color);
  const background = parseColor(style.backgroundColor);
  assert.ok(background.a >= 0.99, `${label}: current branch background must be opaque (${style.backgroundColor})`);
  assert.ok(Number(style.opacity) >= 0.99, `${label}: current branch must stay fully opaque`);
  assert.ok(contrastRatio(foreground, background) >= 4.5, `${label}: current branch contrast is too low (${style.color} on ${style.backgroundColor})`);
}

async function ensureMobileMenuOpen(page) {
  const toggle = page.locator("#homepageMenuToggle");
  if (await toggle.isVisible() && !String(await page.locator("#homepageMenu").getAttribute("class")).includes("open")) {
    await toggle.click();
  }
}

async function ensureBranchOpen(button) {
  if (await button.getAttribute("aria-expanded") !== "true") await button.click();
}

async function assertSingleSelectedDropdown(label, contextOptions) {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  try {
    await page.goto(`${origin}/`, { waitUntil: "domcontentloaded" });
    await page.locator('#homepageMenu[data-layout-mode="selected-dropdown"]').waitFor({ timeout: 30_000 });
    const usesMobileMenu = await page.locator("#homepageMenuToggle").isVisible();
    if (!usesMobileMenu && contextOptions.viewport.width >= 1000) {
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
    if (usesMobileMenu) {
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

    await page.goto(`${origin}/programs`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.body.dataset.editorBootState === "ready", null, { timeout: 30_000 });
    const businessButton = page.locator("#homepageMenuList > .homepage-menu-item.level-1 > .homepage-menu-link", { hasText: "사업 안내" });
    await ensureMobileMenuOpen(page);
    if (await businessButton.getAttribute("aria-expanded") === "true") await businessButton.click();
    for (const action of ["open", "close", "reopen"]) {
      await businessButton.click();
      if (action !== "close") {
        await assertCurrentBranchContrast(page, `${label}: ${action}-branch`);
        await assertCurrentLeafContrast(page, `${label}: ${action}-leaf`);
      }
    }
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.body.dataset.editorBootState === "ready", null, { timeout: 30_000 });
    await ensureMobileMenuOpen(page);
    const reloadedBusinessButton = page.locator("#homepageMenuList > .homepage-menu-item.level-1 > .homepage-menu-link", { hasText: "사업 안내" });
    await ensureBranchOpen(reloadedBusinessButton);
    await assertCurrentBranchContrast(page, `${label}: reload-reopen-branch`);
    await assertCurrentLeafContrast(page, `${label}: reload-reopen`);
    await page.locator("#homepageMenuList .homepage-submenu .homepage-menu-link", { hasText: "프로그램 일정표" }).click();
    await page.waitForURL(/\/programs\/schedule/);
    await page.goBack({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.body.dataset.editorBootState === "ready", null, { timeout: 30_000 });
    await ensureMobileMenuOpen(page);
    const historyBusinessButton = page.locator("#homepageMenuList > .homepage-menu-item.level-1 > .homepage-menu-link", { hasText: "사업 안내" });
    await ensureBranchOpen(historyBusinessButton);
    await assertCurrentBranchContrast(page, `${label}: history-back-reopen-branch`);
    await assertCurrentLeafContrast(page, `${label}: history-back-reopen`);
    await page.goForward({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.body.dataset.editorBootState === "ready", null, { timeout: 30_000 });
    await page.goBack({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.body.dataset.editorBootState === "ready", null, { timeout: 30_000 });
    await ensureMobileMenuOpen(page);
    const roundTripBusinessButton = page.locator("#homepageMenuList > .homepage-menu-item.level-1 > .homepage-menu-link", { hasText: "사업 안내" });
    await ensureBranchOpen(roundTripBusinessButton);
    await assertCurrentBranchContrast(page, `${label}: history-forward-back-reopen-branch`);
    await assertCurrentLeafContrast(page, `${label}: history-forward-back-reopen`);
  } finally {
    await context.close();
  }
}

try {
  await assertSingleSelectedDropdown("PC", { viewport: { width: 1329, height: 912 } });
  await assertSingleSelectedDropdown("tablet", { viewport: { width: 820, height: 1180 }, hasTouch: true });
  await assertSingleSelectedDropdown("mobile", {
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 Chrome/139.0 Mobile Safari/537.36",
  });
  await assertSingleSelectedDropdown("small-mobile", {
    viewport: { width: 320, height: 720 },
    hasTouch: true,
    isMobile: true,
    userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 Chrome/139.0 Mobile Safari/537.36",
  });
  console.log("public selected-dropdown four-viewport reopen regression test OK");
} finally {
  await browser.close();
  if (fixtureServer) await new Promise((resolveClose, rejectClose) => fixtureServer.close((error) => error ? rejectClose(error) : resolveClose()));
}
