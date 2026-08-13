import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const workspaceRoot = resolve(".");
const publicRoutes = [
  "/",
  "/about/mission",
  "/programs",
  "/participation/volunteer",
  "/news/gallery"
];
const contentTypes = {
  ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml", ".webp": "image/webp", ".woff2": "font/woff2"
};
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
    const localPath = publicRoutes.includes(pathname)
      ? "/outputs/representative-greeting-editor.html"
      : pathname.startsWith("/songak/")
        ? `/outputs/${pathname.slice("/songak/".length)}`
        : pathname;
    const filePath = resolve(workspaceRoot, `.${localPath}`);
    if (!filePath.startsWith(workspaceRoot)) throw new Error("invalid path");
    const fileStat = await stat(filePath);
    const resolvedPath = fileStat.isDirectory() ? resolve(filePath, "index.html") : filePath;
    response.writeHead(200, { "content-type": contentTypes[extname(resolvedPath)] || "application/octet-stream" });
    response.end(await readFile(resolvedPath));
  } catch {
    response.writeHead(404).end("Not found");
  }
});
await new Promise((resolveReady) => server.listen(0, "127.0.0.1", resolveReady));
const editorUrl = `http://127.0.0.1:${server.address().port}/`;
const executablePath = [
  process.env.BROWSER_EXECUTABLE,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
].filter(Boolean).find(existsSync);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

async function inspectDevice({ name, viewport, userAgent, hasTouch = false, route = "/" }) {
  const context = await browser.newContext({ viewport, hasTouch, ...(userAgent ? { userAgent } : {}) });
  const page = await context.newPage();
  try {
    await page.goto(`${editorUrl.replace(/\/$/, "")}${route}?mode=view`, { waitUntil: "commit" });
    await page.waitForFunction(() => document.body.dataset.editorBootState === "ready" && window.EditorModules?.mobileViewport, null, { timeout: 60000 });
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
      hoverNone: window.matchMedia("(hover: none)").matches,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      mobileMenuVisible: getComputedStyle(document.getElementById("homepageMenuToggle")).display !== "none",
      desktopMenuVisible: getComputedStyle(document.getElementById("homepageMenuList")).display !== "none"
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
      name: "390px compact browser without mobile signals",
      viewport: { width: 390, height: 844 },
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
    },
    {
      name: "360px compact browser without mobile signals",
      viewport: { width: 360, height: 800 },
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

  for (const route of publicRoutes) {
    const result = await inspectDevice({
      name: `390px public route ${route}`,
      route,
      viewport: { width: 390, height: 844 }
    });
    results.push(result);
    assert.equal(result.accessDevice, "mobile", `${route}: compact access device`);
    assert.equal(result.responsiveViewport, "phone", `${route}: responsive viewport`);
    assert.equal(result.activeViewport, "phone", `${route}: active stage viewport`);
    assert.equal(result.mobileMenuVisible, true, `${route}: mobile menu toggle visible`);
    assert.equal(result.desktopMenuVisible, false, `${route}: desktop menu hidden`);
    assert.equal(result.horizontalOverflow, false, `${route}: no horizontal overflow`);
  }

  console.log(JSON.stringify(results, null, 2));
  console.log("public device viewport browser tests OK");
} finally {
  await browser.close();
  await new Promise((resolveClosed) => server.close(resolveClosed));
}
