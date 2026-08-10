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

try {
  for (const viewport of [
    { name: "desktop", width: 1440, height: 960 },
    { name: "tablet", width: 820, height: 1080 },
    { name: "phone", width: 390, height: 844 },
    { name: "phoneSmall", width: 320, height: 740 }
  ]) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${editorUrl}?mode=view`, { waitUntil: "commit" });
    await page.waitForSelector(".section-theme-surface", { timeout: 60000 });
    await page.evaluate((name) => { setMode("view"); setViewport(name); }, viewport.name);
    await page.waitForTimeout(450);
    const result = await page.evaluate(() => {
      const surfaces = [...document.querySelectorAll(".section-theme-surface")];
      return {
        count: surfaces.length,
        motifs: surfaces.map((surface) => surface.dataset.decoration),
        backgrounds: [...new Set(surfaces.map((surface) => getComputedStyle(surface).getPropertyValue("--section-theme-background").trim()))],
        geometryValid: surfaces.every((surface) => {
          const top = Number.parseFloat(surface.style.top);
          const height = Number.parseFloat(surface.style.height);
          return Number.isFinite(top) && Number.isFinite(height) && top >= 0 && height > 0;
        }),
        clickThrough: surfaces.every((surface) => getComputedStyle(surface).pointerEvents === "none"),
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2
      };
    });
    if (result.count < 10 || result.backgrounds.length < 5 || result.motifs.some((motif) => !motif || motif === "none")) {
      throw new Error(`${viewport.name} section theme coverage failure ${JSON.stringify(result)}`);
    }
    if (!result.geometryValid || !result.clickThrough || result.overflow || errors.length) {
      throw new Error(`${viewport.name} section theme regression ${JSON.stringify({ result, errors })}`);
    }
    await page.close();
  }
  console.log("section appearance browser tests OK");
} finally {
  await browser.close();
}
