import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const executablePath = [
  process.env.BROWSER_EXECUTABLE,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
].filter(Boolean).find(existsSync);
const url = process.env.EDITOR_URL ?? "http://127.0.0.1:43185/representative-greeting-editor.html";
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 1 });

await page.goto(`${url}?viewport=desktop&mode=view&previewSection=gallery&v=gallery-visual-qa`, { waitUntil: "commit" });
await page.waitForSelector(".gallery-section-layer:not([hidden]) .gallery-section-content");
await page.waitForFunction(() => window.EditorModules?.gallery && window.EditorGalleryManager);
await page.evaluate(() => {
  let model = EditorModules.gallery.getContent("gallery");
  model.activeCategoryId = "all";
  while (model.items.length < 13) model = EditorGalleryManager.addItem(model);
  EditorModules.gallery.setContent("gallery", model);
  setMode("view");
  setViewport("desktop");
});
await page.waitForTimeout(300);
await page.locator(".gallery-section-content").screenshot({ path: resolve("outputs", "gallery-desktop-qa.jpg"), type: "jpeg", quality: 5 });

await page.evaluate(() => {
  const model = EditorModules.gallery.getContent("gallery");
  model.mobileStyle = "poster";
  EditorModules.gallery.setContent("gallery", model);
  setViewport("phone");
  setMode("view");
});
await page.waitForTimeout(300);
await page.locator(".gallery-section-content").screenshot({ path: resolve("outputs", "gallery-mobile-poster-qa.jpg"), type: "jpeg", quality: 15 });

await page.evaluate(() => {
  const model = EditorModules.gallery.getContent("gallery");
  model.mobileStyle = "journal";
  EditorModules.gallery.setContent("gallery", model);
});
await page.waitForTimeout(300);
await page.locator(".gallery-section-content").screenshot({ path: resolve("outputs", "gallery-mobile-journal-qa.jpg"), type: "jpeg", quality: 15 });

await browser.close();
console.log("gallery QA screenshots created");
