import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || "playwright");
const executablePath = [
  process.env.BROWSER_EXECUTABLE,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
].filter(Boolean).find(existsSync);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const editorHtml = await readFile(resolve("outputs", "representative-greeting-editor.html"), "utf8");
const editorStyles = [...editorHtml.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((match) => match[1]).join("\n");

function parseColor(value) {
  const components = String(value).match(/[\d.]+/g)?.map(Number) ?? [];
  assert.ok(components.length >= 3, `unsupported computed color: ${value}`);
  return {
    r: components[0],
    g: components[1],
    b: components[2],
    a: components[3] ?? 1
  };
}

function relativeLuminance({ r, g, b }) {
  const channels = [r, g, b].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(foreground, background) {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.setContent(`<!doctype html>
    <style>${editorStyles}</style>
    <div class="stage desktop">
      <nav class="homepage-menu" data-layout-mode="two-level">
        <div class="homepage-menu-subbar">
          <button class="homepage-subbar-link active" aria-current="page">
            <small class="homepage-quick-group-label">기관 안내</small>
            <span class="homepage-quick-destination-label">대표자 인사말</span>
          </button>
        </div>
        <div class="homepage-menu-item level-1 contains-active">
          <div class="homepage-submenu quick-submenu quick-two-level">
            <div class="homepage-menu-item level-2 quick-destination">
              <button class="homepage-menu-link active" aria-current="page">연혁</button>
            </div>
          </div>
        </div>
      </nav>
    </div>`);

  const style = await page.locator(".homepage-subbar-link.active").evaluate((element) => {
    const computed = getComputedStyle(element);
    const groupLabel = element.querySelector(".homepage-quick-group-label");
    return {
      ariaCurrent: element.getAttribute("aria-current"),
      color: computed.color,
      backgroundColor: computed.backgroundColor,
      opacity: computed.opacity,
      groupLabelColor: getComputedStyle(groupLabel).color
    };
  });
  const foreground = parseColor(style.color);
  const background = parseColor(style.backgroundColor);
  assert.equal(style.ariaCurrent, "page", "desktop selection should expose its current-page state");
  assert.ok(background.a >= 0.99, `desktop selected background must not be transparent (${style.backgroundColor})`);
  assert.ok(Number(style.opacity) >= 0.99, "desktop selected destination should remain fully opaque");
  assert.ok(
    contrastRatio(foreground, background) >= 4.5,
    `desktop selected text/background contrast is too low (${style.color} on ${style.backgroundColor})`
  );
  assert.equal(style.groupLabelColor, style.color, "selected desktop group label should inherit the active text color");

  // The desktop two-level layout renders destinations in the visible subbar;
  // the nested quick submenu remains a mobile-only duplicate and is hidden.
  const destination = page.locator(".homepage-subbar-link.active");
  await destination.hover();
  const destinationStyle = await destination.evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      ariaCurrent: element.getAttribute("aria-current"),
      color: computed.color,
      backgroundColor: computed.backgroundColor,
      opacity: computed.opacity
    };
  });
  const destinationForeground = parseColor(destinationStyle.color);
  const destinationBackground = parseColor(destinationStyle.backgroundColor);
  assert.equal(destinationStyle.ariaCurrent, "page", "the rendered quick destination should expose its current-page state");
  assert.ok(destinationBackground.a >= 0.99, `hovered selected destination must not become transparent (${destinationStyle.backgroundColor})`);
  assert.ok(Number(destinationStyle.opacity) >= 0.99, "hovered selected destination should remain fully opaque");
  assert.ok(
    contrastRatio(destinationForeground, destinationBackground) >= 4.5,
    `hovered selected destination contrast is too low (${destinationStyle.color} on ${destinationStyle.backgroundColor})`
  );

  await page.setContent(`<!doctype html>
    <style>${editorStyles}</style>
    <div class="stage desktop view-mode">
      <nav class="homepage-menu" data-layout-mode="selected-dropdown">
        <div class="homepage-menu-list">
          <div class="homepage-menu-item level-1 contains-active expanded">
            <button class="homepage-menu-link has-children contains-active expanded" aria-expanded="true">복지관 소개</button>
            <div class="homepage-submenu">
              <div class="homepage-menu-item level-2">
                <button class="homepage-menu-link active" aria-current="page">미션·비전·슬로건</button>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </div>`);

  const activeBranch = page.locator(".homepage-menu-item.level-1 > .homepage-menu-link.contains-active");
  const branchStyle = await activeBranch.evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      color: computed.color,
      backgroundColor: computed.backgroundColor,
      opacity: computed.opacity,
      ariaCurrent: element.getAttribute("aria-current")
    };
  });
  const branchForeground = parseColor(branchStyle.color);
  const branchBackground = parseColor(branchStyle.backgroundColor);
  assert.equal(branchStyle.ariaCurrent, null, "an active ancestor must not claim aria-current=page");
  assert.ok(branchBackground.a >= 0.99, `selected ancestor background must be opaque (${branchStyle.backgroundColor})`);
  assert.ok(Number(branchStyle.opacity) >= 0.99, "selected ancestor should remain fully opaque");
  assert.ok(
    contrastRatio(branchForeground, branchBackground) >= 4.5,
    `selected ancestor contrast is too low (${branchStyle.color} on ${branchStyle.backgroundColor})`
  );

  await activeBranch.hover();
  const hoveredBranchStyle = await activeBranch.evaluate((element) => {
    const computed = getComputedStyle(element);
    return { color: computed.color, backgroundColor: computed.backgroundColor };
  });
  assert.ok(
    contrastRatio(parseColor(hoveredBranchStyle.color), parseColor(hoveredBranchStyle.backgroundColor)) >= 4.5,
    "hover must not erase the selected ancestor contrast"
  );

  const activeDropdownLeaf = page.locator(".homepage-submenu .homepage-menu-link[aria-current='page']");
  await activeDropdownLeaf.hover();
  const activeDropdownLeafStyle = await activeDropdownLeaf.evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      color: computed.color,
      backgroundColor: computed.backgroundColor,
      opacity: computed.opacity,
      ariaCurrent: element.getAttribute("aria-current")
    };
  });
  const dropdownLeafForeground = parseColor(activeDropdownLeafStyle.color);
  const dropdownLeafBackground = parseColor(activeDropdownLeafStyle.backgroundColor);
  assert.equal(activeDropdownLeafStyle.ariaCurrent, "page", "the reopened dropdown leaf must remain current");
  assert.ok(dropdownLeafBackground.a >= 0.99, `reopened dropdown leaf background must be opaque (${activeDropdownLeafStyle.backgroundColor})`);
  assert.ok(Number(activeDropdownLeafStyle.opacity) >= 0.99, "reopened dropdown leaf should remain fully opaque");
  assert.ok(
    contrastRatio(dropdownLeafForeground, dropdownLeafBackground) >= 4.5,
    `reopened dropdown leaf contrast is too low (${activeDropdownLeafStyle.color} on ${activeDropdownLeafStyle.backgroundColor})`
  );

  console.log("desktop menu active contrast browser tests OK");
} finally {
  await browser.close();
}
