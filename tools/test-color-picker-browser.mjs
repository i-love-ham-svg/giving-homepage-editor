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
const page = await browser.newPage({ viewport: { width: 1500, height: 960 } });
const issues = [];

try {
  page.on("pageerror", (error) => issues.push(error.message));
  await page.goto(`${editorUrl}?viewport=desktop&mode=edit&previewSection=donation`, { waitUntil: "commit" });
  await page.waitForSelector('.donation-section-layer:not([hidden]) .donation-card-icon', { timeout: 60000 });
  await page.locator("#backgroundFloatToggle").click();
  await page.waitForFunction(() => document.getElementById("backgroundFloat").classList.contains("open"));
  const backgroundControl = await page.evaluate(() => {
    const input = document.getElementById("backgroundFloatColorInput");
    const wrapper = input.closest(".editor-color-control");
    return {
      inputWidth: Math.round(input.getBoundingClientRect().width),
      wrapperWidth: Math.round(wrapper.getBoundingClientRect().width),
      swatchVisible: input.offsetWidth > 0 && input.offsetHeight > 0
    };
  });
  if (backgroundControl.inputWidth < 36 || backgroundControl.wrapperWidth < 72 || !backgroundControl.swatchVisible) {
    issues.push(`background color swatch collapsed: ${JSON.stringify(backgroundControl)}`);
  }
  await page.locator('.donation-section-layer:not([hidden]) .donation-section-head').click({ position: { x: 18, y: 18 } });
  await page.waitForFunction(() => !document.getElementById("backgroundFloat").classList.contains("open"));
  await page.locator('.donation-section-layer:not([hidden]) .donation-card-icon').first().click();
  await page.waitForSelector("#donationIconPickerModal:not([hidden])");
  const controlCounts = await page.evaluate(() => ({
    inputs: document.querySelectorAll('input[type="color"]').length,
    eyedroppers: document.querySelectorAll(".editor-color-eyedropper").length
  }));
  if (controlCounts.inputs !== controlCounts.eyedroppers) issues.push(`color controls mismatch: ${JSON.stringify(controlCounts)}`);

  await page.evaluate(() => {
    const target = document.createElement("div");
    target.id = "color-picker-test-target";
    Object.assign(target.style, {
      position: "absolute",
      left: "8px",
      top: "8px",
      width: "48px",
      height: "48px",
      zIndex: "99999",
      background: "#123456"
    });
    document.getElementById("stage").appendChild(target);
  });
  await page.locator(".editor-color-control:has(#donationLinkedColor) .editor-color-eyedropper").click();
  await page.waitForFunction(() => document.body.classList.contains("editor-color-sampling"));
  const rect = await page.locator("#color-picker-test-target").boundingBox();
  await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.waitForFunction(() => !document.body.classList.contains("editor-color-sampling"));
  const result = await page.evaluate(() => ({
    input: document.getElementById("donationLinkedColor").value,
    accent: window.EditorModules.donation.getContent("donation").cards[0].accentColor,
    active: window.EditorModules.colorPicker.active
  }));
  if (result.input !== "#123456" || result.accent !== "#123456" || result.active) {
    issues.push(`screen color was not applied: ${JSON.stringify(result)}`);
  }
  await page.evaluate(() => setViewport("phone"));
  await page.waitForTimeout(500);
  const mobile = await page.evaluate(() => {
    const modal = document.getElementById("donationIconPickerModal");
    const dialog = modal.querySelector(".process-icon-picker-dialog");
    const stageRect = document.getElementById("stage").getBoundingClientRect();
    const modalRect = modal.getBoundingClientRect();
    return {
      insideStage: modalRect.left >= stageRect.left - 2 && modalRect.right <= stageRect.right + 2,
      noHorizontalOverflow: dialog.scrollWidth <= dialog.clientWidth + 2
    };
  });
  if (!mobile.insideStage || !mobile.noHorizontalOverflow) issues.push(`mobile color controls overflow: ${JSON.stringify(mobile)}`);
  console.log("color picker browser", JSON.stringify({ backgroundControl, controlCounts, result, mobile }));
} finally {
  await page.close().catch(() => {});
  await browser.close().catch(() => {});
}

if (issues.length) {
  console.error(issues.join("\n"));
  process.exitCode = 1;
} else {
  console.log("color picker browser tests OK");
}
