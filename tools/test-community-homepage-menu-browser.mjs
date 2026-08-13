import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";

const require = createRequire(new URL("../package.json", import.meta.url));
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || "playwright");
const executablePath = [
  process.env.BROWSER_EXECUTABLE,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean).find(existsSync);
const origin = process.env.SONGAK_QA_ORIGIN || "http://127.0.0.1:43216";
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

async function desktopContract() {
  const context = await browser.newContext({ viewport: { width: 1329, height: 912 } });
  const page = await context.newPage();
  try {
    await page.goto(`${origin}/community`, { waitUntil: "networkidle" });
    const menu = page.locator("#homepageMenu");
    await menu.waitFor();
    const visualShell = await page.evaluate(() => ({
      stylesheetCount: document.styleSheets.length,
      bodyFont: getComputedStyle(document.body).fontFamily,
      menuBorderRadius: getComputedStyle(document.querySelector("#homepageMenu")).borderRadius,
    }));
    assert.ok(visualShell.stylesheetCount > 0, "the community stylesheet must load");
    assert.match(visualShell.bodyFont, /Noto Sans KR|sans-serif/, "the community font styling must apply");
    assert.notEqual(visualShell.menuBorderRadius, "0px", "the styled homepage menu must be active");
    const initial = await page.evaluate(() => {
      const root = document.querySelector("#homepageMenu");
      const list = document.querySelector("#homepageMenuList");
      const brand = list?.querySelector(":scope > .homepage-menu-brand");
      const intro = document.querySelector(".board-intro");
      const rootRect = root?.getBoundingClientRect();
      const introRect = intro?.getBoundingClientRect();
      return {
        rootClass: root?.className,
        brandIsFirst: list?.firstElementChild === brand,
        labels: [...list?.querySelectorAll(":scope > .homepage-menu-item > .homepage-menu-link") || []].map((node) => node.textContent.trim()),
        menuBottom: rootRect?.bottom,
        introTop: introRect?.top,
        toggleDisplay: getComputedStyle(document.querySelector(".homepage-menu-toggle")).display,
      };
    });
    assert.match(initial.rootClass, /homepage-menu.*layout-selected-dropdown.*brand-inline/);
    assert.equal(initial.brandIsFirst, true, "the saved inline brand must keep its first-list position");
    assert.deepEqual(initial.labels, ["복지관 소개", "사업 안내", "참여마당", "알림마당", "로그인·회원가입"]);
    assert.ok(initial.introTop >= initial.menuBottom, "the menu must not cover the page introduction");
    assert.equal(initial.toggleDisplay, "none");

    for (const label of ["복지관 소개", "사업 안내", "참여마당", "알림마당"]) {
      const button = page.getByRole("button", { name: new RegExp(label) });
      await button.click();
      assert.equal(await button.getAttribute("aria-expanded"), "true", `${label} must expand`);
      const submenu = button.locator("xpath=following-sibling::*[contains(@class,'homepage-submenu')]");
      assert.notEqual(await submenu.evaluate((node) => getComputedStyle(node).display), "none", `${label} destinations must be visible`);
      assert.equal(await page.locator("#homepageMenuSubbar").count(), 0, `${label} must use the selected-menu dropdown, not a full-width subbar`);
      await button.click();
      assert.equal(await button.getAttribute("aria-expanded"), "false", `${label} must collapse`);
    }

    await page.locator(".homepage-menu-brand[data-homepage-brand-link]").click();
    await page.waitForURL((url) => url.pathname === "/");
    assert.equal(new URL(page.url()).pathname, "/", "the Songak brand must return to the homepage");
  } finally {
    await context.close();
  }
}

async function mobileContract(name, viewport) {
  const context = await browser.newContext({
    viewport,
    hasTouch: true,
    isMobile: true,
    userAgent: `Mozilla/5.0 (${name}) AppleWebKit/537.36 Chrome/139.0 Mobile Safari/537.36`,
  });
  const page = await context.newPage();
  try {
    await page.goto(`${origin}/community`, { waitUntil: "networkidle" });
    await page.locator("#homepageMenu").waitFor();
    const toggle = page.getByRole("button", { name: "전체 메뉴 열기" });
    await toggle.click();
    const openState = await page.evaluate(() => {
      const menu = document.querySelector("#homepageMenu");
      const list = document.querySelector("#homepageMenuList");
      const rect = menu?.getBoundingClientRect();
      return {
        open: menu?.classList.contains("open"),
        bodyOverflow: getComputedStyle(document.body).overflow,
        listDisplay: getComputedStyle(list).display,
        menuWidth: rect?.width,
        menuHeight: rect?.height,
        viewportWidth: innerWidth,
        viewportHeight: innerHeight,
      };
    });
    assert.equal(openState.open, true, `${name}: menu opens`);
    assert.equal(openState.bodyOverflow, "hidden", `${name}: page scrolling is locked`);
    assert.notEqual(openState.listDisplay, "none", `${name}: full menu list is visible`);
    assert.ok(openState.menuWidth >= openState.viewportWidth - 2, `${name}: panel reaches both sides`);
    assert.ok(openState.menuHeight >= openState.viewportHeight - 2, `${name}: panel reaches the bottom`);
    const brandBox = await page.locator(".homepage-menu-mobile-brand").boundingBox();
    assert.ok(brandBox && brandBox.y < 76, `${name}: the Songak brand stays in the top bar instead of overlapping submenu items`);

    for (const label of ["복지관 소개", "사업 안내", "참여마당", "알림마당"]) {
      const button = page.getByRole("button", { name: new RegExp(label) });
      await button.click();
      assert.equal(await button.getAttribute("aria-expanded"), "true", `${name}: ${label} expands`);
      await button.click();
      assert.equal(await button.getAttribute("aria-expanded"), "false", `${name}: ${label} collapses`);
    }

    const news = page.getByRole("button", { name: /알림마당/ });
    await news.click();
    const current = page.getByRole("link", { name: "소통게시판" });
    await current.scrollIntoViewIfNeeded();
    const currentStyle = await current.evaluate((node) => ({ color: getComputedStyle(node).color, background: getComputedStyle(node).backgroundColor }));
    assert.notEqual(currentStyle.background, "rgba(0, 0, 0, 0)", `${name}: selected destination is not white/transparent`);
    await current.click();
    await page.waitForFunction(() => !document.querySelector("#homepageMenu")?.classList.contains("open"));
    assert.notEqual(await page.evaluate(() => getComputedStyle(document.body).overflow), "hidden", `${name}: selection unlocks scrolling`);
  } finally {
    await context.close();
  }
}

try {
  await desktopContract();
  await mobileContract("iPad", { width: 820, height: 1180 });
  await mobileContract("Pixel-8", { width: 390, height: 844 });
  await mobileContract("iPhone-SE", { width: 320, height: 700 });
  console.log("community homepage-menu PC/tablet/mobile regression test OK");
} finally {
  await browser.close();
}
