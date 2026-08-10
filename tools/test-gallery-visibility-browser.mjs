import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const candidates = [
  process.env.BROWSER_EXECUTABLE,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
].filter(Boolean);
const executablePath = candidates.find(existsSync);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const page = await browser.newPage({ viewport: { width: 1569, height: 912 } });
const url = pathToFileURL(resolve("outputs", "representative-greeting-editor.html")).href;

try {
  await page.goto(`${url}?viewport=desktop&mode=edit&previewSection=gallery`, { waitUntil: "commit" });
  await page.waitForSelector(".gallery-section-layer:not([hidden]) .gallery-base-text-input");
  await page.waitForFunction(() => window.EditorModules?.gallery);
  await page.waitForTimeout(300);
  const result = await page.evaluate(() => ({
    fields: [...document.querySelectorAll(".gallery-section-layer:not([hidden]) .gallery-base-text-input")].map((input) => ({
      field: input.dataset.galleryField,
      value: input.value,
      clientHeight: input.clientHeight,
      scrollHeight: input.scrollHeight,
      overflowY: getComputedStyle(input).overflowY
    })),
    images: [...document.querySelectorAll(".gallery-section-layer:not([hidden]) .gallery-item-media img")].map((image) => ({
      fit: getComputedStyle(image).objectFit,
      src: image.getAttribute("src")
    }))
  }));
  const clipped = result.fields.filter((field) => field.scrollHeight > field.clientHeight + 2);
  const scrolling = result.fields.filter((field) => !["hidden", "clip"].includes(field.overflowY));
  const cropped = result.images.filter((image) => image.fit !== "contain");
  if (clipped.length || scrolling.length || cropped.length || result.images.length !== 6) {
    console.error(JSON.stringify({ result, clipped, scrolling, cropped }, null, 2));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify(result, null, 2));
    console.log("gallery text and image visibility browser test OK");
  }
} finally {
  await browser.close();
}
