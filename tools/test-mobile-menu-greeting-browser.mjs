import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const workspaceRoot = resolve(".");
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2"
};

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
    const localPath = pathname === "/"
      ? "/outputs/representative-greeting-editor.html"
      : pathname.startsWith("/songak/")
        ? `/outputs/${pathname.slice("/songak/".length)}`
        : pathname;
    const filePath = resolve(workspaceRoot, `.${localPath}`);
    if (filePath !== workspaceRoot && !filePath.startsWith(`${workspaceRoot}${sep}`)) throw new Error("invalid path");
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
const issues = [];
const viewports = [
  { name: "tablet", profile: "tablet", width: 768, height: 1024 },
  { name: "mobile", profile: "phone", width: 390, height: 844 },
  { name: "narrow-mobile", profile: "phone", width: 360, height: 800 },
  { name: "small-mobile", profile: "phoneSmall", width: 320, height: 720 }
];

const overlaps = (a, b, padding = 1) => Boolean(a && b
  && a.left < b.right - padding
  && a.right > b.left + padding
  && a.top < b.bottom - padding
  && a.bottom > b.top + padding);

const mobileUserAgent = "Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 Chrome/139.0.0.0 Mobile Safari/537.36";
const tabletUserAgent = "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1";

try {
  const directContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    userAgent: mobileUserAgent
  });
  const directMobile = await directContext.newPage();
  directMobile.on("pageerror", (error) => issues.push(`direct-mobile: ${error.message}`));
  await directMobile.goto(`${editorUrl}?mode=view`, { waitUntil: "commit" });
  await directMobile.waitForFunction(() => document.body.dataset.editorBootState === "ready" && window.EditorModules?.mobileViewport);
  const directMetrics = await directMobile.evaluate(() => ({
    viewport: [
      ["desktop", "desktop"], ["tablet", "tablet"], ["phone", "phone"], ["phoneSmall", "phone-small"]
    ].find(([, className]) => document.getElementById("stage")?.classList.contains(className))?.[0],
    overflow: document.documentElement.scrollWidth - window.innerWidth
  }));
  if (directMetrics.viewport !== "phone") issues.push(`direct-mobile: expected phone viewport, got ${directMetrics.viewport}`);
  if (directMetrics.overflow > 2) issues.push(`direct-mobile: ${directMetrics.overflow}px horizontal overflow`);
  await directContext.close();

  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      hasTouch: true,
      isMobile: true,
      userAgent: viewport.profile === "tablet" ? tabletUserAgent : mobileUserAgent
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => issues.push(`${viewport.name}: ${error.message}`));
    await page.goto(`${editorUrl}?mode=view&viewport=${viewport.profile}`, { waitUntil: "commit" });
    await page.waitForFunction(() => document.body.dataset.editorBootState === "ready" && window.EditorModules?.mobileViewport);
    await page.evaluate(() => document.fonts?.ready);

    const menuData = await page.evaluate(() => {
      const items = [...document.querySelectorAll("#homepageMenuList [data-menu-id]")]
        .map((item) => ({ id: item.dataset.menuId, label: String(item.textContent || "").trim() }));
      return {
        empty: items.filter((item) => !item.label),
        accounts: items.filter((item) => item.id === "home-menu-account")
      };
    });
    if (menuData.empty.length) issues.push(`${viewport.name}: empty menu label (${menuData.empty.map((item) => item.id).join(", ")})`);
    if (menuData.accounts.length !== 1) issues.push(`${viewport.name}: login menu must appear exactly once`);

    await page.locator("#homepageMenuToggle").click();
    await page.waitForSelector("#homepageMenu.open #homepageMenuList");
    const root = page.locator('[data-menu-id="home-menu-1"]:visible').first();
    await root.click();
    await page.waitForFunction(() => [...document.querySelectorAll('[data-menu-id="home-menu-1"]')]
      .some((element) => element.getClientRects().length > 0 && element.getAttribute("aria-expanded") === "true"));

    const selected = page.locator('[data-menu-id="home-menu-intro-main"]:visible').first();
    if (!(await selected.count())) {
      issues.push(`${viewport.name}: main introduction destination is not visible`);
    } else {
      await selected.click();
      await page.waitForFunction(() => !document.querySelector("#homepageMenu")?.classList.contains("open"));
      await page.locator("#homepageMenuToggle").click();
      await page.waitForSelector("#homepageMenu.open");
      const active = page.locator('[data-menu-id="home-menu-intro-main"][aria-current="page"]:visible').first();
      if (!(await active.count())) {
        issues.push(`${viewport.name}: selected menu has no active state`);
      } else {
        const activeStyle = await active.evaluate((element) => {
          const style = getComputedStyle(element);
          return {
            text: element.textContent.trim(),
            color: style.color,
            background: style.backgroundColor,
            opacity: style.opacity
          };
        });
        if (!activeStyle.text) issues.push(`${viewport.name}: selected menu label is empty`);
        if (/rgba?\(255,\s*255,\s*255(?:,\s*1)?\)/.test(activeStyle.background)
          && /rgba?\(255,\s*255,\s*255/.test(activeStyle.color)) {
          issues.push(`${viewport.name}: selected menu is white text on white background`);
        }
        if (Number(activeStyle.opacity) < .99) issues.push(`${viewport.name}: selected menu is shown with reduced opacity`);
      }
      await page.locator("#homepageMenuToggle").click();
      await page.waitForFunction(() => !document.querySelector("#homepageMenu")?.classList.contains("open"));
    }

    // The greeting is below the first fold. Scroll it into view so lazy media and
    // the same responsive layout pass a real visitor sees have both completed.
    await page.locator(".signature-text:visible").first().scrollIntoViewIfNeeded();
    await page.evaluate(() => document.fonts?.ready);
    await page.waitForFunction(() => [...document.images]
      .filter((image) => image.getClientRects().length > 0)
      .every((image) => image.complete));
    await page.evaluate(() => new Promise((resolveReady) => requestAnimationFrame(() => requestAnimationFrame(resolveReady))));
    await page.waitForTimeout(220);
    const boxes = await page.evaluate(() => {
      const isVisible = (element) => {
        if (!element) return false;
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
      };
      const rect = (element) => {
        if (!isVisible(element)) return null;
        const box = element.getBoundingClientRect();
        return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
      };
      const identity = [...document.querySelectorAll(".identity-box")]
        .filter(isVisible)
        .map((element) => ({ type: element.dataset.type, rect: rect(element.querySelector(".identity-box-text")) }))
        .filter((item) => item.rect);
      const signature = [...document.querySelectorAll(".signature-text")].find(isVisible);
      const seal = [...document.querySelectorAll('[data-id="seal"] .seal, [data-greeting-part="seal"] .seal')].find(isVisible);
      return {
        identity,
        signature: rect(signature),
        seal: rect(seal),
        diagnostics: {
          url: location.href,
          scrollY: window.scrollY,
          documentHeight: document.documentElement.scrollHeight,
          stageClass: document.getElementById("stage")?.className,
          signatureParentStyle: signature?.closest(".editable")?.getAttribute("style") || ""
        }
      };
    });

    if (boxes.identity.length < 3 || !boxes.signature || !boxes.seal) {
      issues.push(`${viewport.name}: identity/signature/seal targets were not rendered`);
    }
    for (const item of boxes.identity) {
      if (overlaps(item.rect, boxes.signature)) issues.push(`${viewport.name}: ${item.type} overlaps signature (${JSON.stringify({ identity: item.rect, signature: boxes.signature, diagnostics: boxes.diagnostics })})`);
      if (overlaps(item.rect, boxes.seal)) issues.push(`${viewport.name}: ${item.type} overlaps seal`);
    }
    if (overlaps(boxes.signature, boxes.seal)) issues.push(`${viewport.name}: signature overlaps seal`);
    await context.close();
  }
} finally {
  await browser.close();
  await new Promise((resolveClosed) => server.close(resolveClosed));
}

if (issues.length) {
  console.error(issues.join("\n"));
  process.exitCode = 1;
} else {
  console.log("mobile menu and greeting visitor tests OK");
}
