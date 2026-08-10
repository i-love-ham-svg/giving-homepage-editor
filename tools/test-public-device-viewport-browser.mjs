import assert from "node:assert/strict";
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

async function inspectDevice({ name, viewport, userAgent, hasTouch = false }) {
  const context = await browser.newContext({ viewport, hasTouch, ...(userAgent ? { userAgent } : {}) });
  const page = await context.newPage();
  try {
    await page.goto(`${editorUrl}?mode=view`, { waitUntil: "commit" });
    await page.waitForSelector("#stage", { state: "attached", timeout: 60000 });
    const result = await page.evaluate(() => ({
      accessDevice: EditorModules.mobileViewport.detectAccessDevice(),
      responsiveViewport: EditorModules.mobileViewport.detectResponsiveViewport(),
      activeViewport: [
        ["desktop", "desktop"],
        ["tablet", "tablet"],
        ["phone", "phone"],
        ["phoneSmall", "phone-small"]
      ].find(([, className]) => document.getElementById("stage").classList.contains(className))?.[0],
      coarsePointer: window.matchMedia("(pointer: coarse)").matches,
      hoverNone: window.matchMedia("(hover: none)").matches
    }));
    return { name, ...result };
  } finally {
    await context.close();
  }
}

try {
  const cases = [
    {
      name: "1280x900 non-touch PC",
      viewport: { width: 1280, height: 900 },
      expectedAccess: "desktop",
      expectedViewport: "desktop"
    },
    {
      name: "1024x1366 non-touch PC window",
      viewport: { width: 1024, height: 1366 },
      expectedAccess: "desktop",
      expectedViewport: "desktop"
    },
    {
      name: "iPad-class touch tablet",
      viewport: { width: 820, height: 1180 },
      hasTouch: true,
      userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
      expectedAccess: "mobile",
      expectedViewport: "tablet"
    },
    {
      name: "390px mobile phone",
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/124.0 Mobile Safari/537.36",
      expectedAccess: "mobile",
      expectedViewport: "phone"
    },
    {
      name: "360px small phone",
      viewport: { width: 360, height: 800 },
      hasTouch: true,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
      expectedAccess: "mobile",
      expectedViewport: "phoneSmall"
    }
  ];

  const results = [];
  for (const testCase of cases) {
    const result = await inspectDevice(testCase);
    results.push(result);
    assert.equal(result.accessDevice, testCase.expectedAccess, `${testCase.name}: access device`);
    assert.equal(result.responsiveViewport, testCase.expectedViewport, `${testCase.name}: detected viewport`);
    assert.equal(result.activeViewport, testCase.expectedViewport, `${testCase.name}: public stage viewport`);
  }

  console.log(JSON.stringify(results, null, 2));
  console.log("public device viewport browser tests OK");
} finally {
  await browser.close();
}
