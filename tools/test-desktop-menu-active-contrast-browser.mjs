import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
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
            <span class="homepage-quick-destination-label">메인 소개·대표자 인사말</span>
          </button>
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
  console.log("desktop menu active contrast browser tests OK");
} finally {
  await browser.close();
}
