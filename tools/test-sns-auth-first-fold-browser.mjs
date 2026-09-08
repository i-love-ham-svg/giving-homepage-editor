import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { loadPlaywrightCore } from "../manual-video/v2/record-manual-v2.cjs";

const { chromium } = loadPlaywrightCore();
const workspaceRoot = resolve(".");
const assetRoot = resolve(
  process.env.SONGAK_EDITOR_ASSET_ROOT || resolve(workspaceRoot, "outputs"),
);
const executablePath = [
  process.env.BROWSER_EXECUTABLE,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
].filter(Boolean).find(existsSync);

const browser = await chromium.launch({
  headless: true,
  ...(executablePath ? { executablePath } : {})
});

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2"
};
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
    const relativePath = pathname.startsWith("/songak/")
      ? pathname.slice("/songak/".length)
      : pathname.startsWith("/outputs/")
        ? pathname.slice("/outputs/".length)
        : pathname.replace(/^\/+/, "");
    const filePath = resolve(assetRoot, relativePath);
    if (filePath !== assetRoot && !filePath.startsWith(`${assetRoot}\\`)) throw new Error("invalid path");
    const fileStat = await stat(filePath);
    const resolvedPath = fileStat.isDirectory() ? resolve(filePath, "index.html") : filePath;
    const extension = resolvedPath.slice(resolvedPath.lastIndexOf("."));
    response.writeHead(200, { "content-type": contentTypes[extension] || "application/octet-stream" });
    response.end(await readFile(resolvedPath));
  } catch {
    response.writeHead(404).end("Not found");
  }
});
await new Promise((resolveReady) => server.listen(0, "127.0.0.1", resolveReady));
const { port } = server.address();
const editorUrl = `http://127.0.0.1:${port}/songak/representative-greeting-editor.html`;

try {
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 }
  ]) {
    const page = await browser.newPage({ viewport });
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto(`${editorUrl}?mode=view&viewport=desktop&stylePage=account`, { waitUntil: "commit" });
    try {
      await page.waitForSelector('.sns-auth-button[data-sns-provider="kakao"]', { timeout: 15000 });
    } catch (error) {
      const bootState = await page.evaluate(() => ({
        title: document.title,
        bodyText: document.body?.innerText?.slice(0, 500),
        boot: window.__songakEditorBoot,
        scripts: [...document.scripts].map((script) => script.src || "inline").slice(-12)
      }));
      throw new Error(`${viewport.width}x${viewport.height}: SNS UI did not boot; pageErrors=${JSON.stringify(pageErrors)} boot=${JSON.stringify(bootState)}`, { cause: error });
    }
    await page.waitForFunction(() => [...document.querySelectorAll(".sns-auth-button")]
      .every((button) => button.getBoundingClientRect().height >= 44));

    const result = await page.evaluate(() => {
      const panel = document.querySelector(".sns-auth-panel").getBoundingClientRect();
      const visual = document.querySelector(".sns-auth-visual").getBoundingClientRect();
      const buttons = [...document.querySelectorAll(".sns-auth-button")].map((button) => {
        const rect = button.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom, height: rect.height };
      });
      return {
        panel: { top: panel.top, bottom: panel.bottom },
        visual: { top: visual.top, bottom: visual.bottom },
        buttons,
        viewportHeight: window.innerHeight,
        stageIsDesktop: !document.getElementById("stage").classList.contains("mobile"),
        stageScale: Number.parseFloat(getComputedStyle(document.getElementById("stage")).getPropertyValue("--scale")) || 1
      };
    });

    assert.equal(result.stageIsDesktop, true, `${viewport.width}x${viewport.height}: desktop profile`);
    assert.equal(result.buttons.length, 3, `${viewport.width}x${viewport.height}: three SNS buttons`);
    assert.ok(result.panel.top >= result.visual.top, `${viewport.width}x${viewport.height}: panel starts inside image`);
    assert.ok(result.panel.bottom <= result.visual.bottom, `${viewport.width}x${viewport.height}: panel ends inside image`);
    assert.ok(result.panel.top <= result.visual.top + 330 * result.stageScale, `${viewport.width}x${viewport.height}: panel stays directly below the hero title in stage coordinates`);
    assert.ok(result.buttons.every((button) => button.height >= 44), `${viewport.width}x${viewport.height}: button target height`);
    assert.ok(result.buttons.every((button) => button.top >= 0 && button.bottom <= result.viewportHeight), `${viewport.width}x${viewport.height}: all SNS buttons appear in the first screen`);
    console.log(`${viewport.width}x${viewport.height}`, JSON.stringify(result));
    await page.close();
  }

  const tabletPage = await browser.newPage({ viewport: { width: 768, height: 1024 } });
  await tabletPage.goto(`${editorUrl}?mode=view&viewport=tablet&stylePage=account`, { waitUntil: "commit" });
  await tabletPage.waitForSelector('.sns-auth-button[data-sns-provider="kakao"]', { timeout: 15000 });
  const readTabletLayout = () => tabletPage.evaluate(() => {
    const stage = document.getElementById("stage");
    const visual = document.querySelector(".sns-auth-visual");
    const desktopImage = document.querySelector(".sns-auth-desktop-image");
    const mobileImage = document.querySelector(".sns-auth-mobile-image");
    const stageRect = stage.getBoundingClientRect();
    const visualRect = visual.getBoundingClientRect();
    const buttons = [...document.querySelectorAll(".sns-auth-button")].map((button) => {
      const rect = button.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, height: rect.height };
    });
    return {
      landscape: stage.classList.contains("tablet-landscape"),
      stage: { left: stageRect.left, right: stageRect.right, width: stageRect.width },
      visualRatio: visualRect.width / visualRect.height,
      desktopImageVisible: getComputedStyle(desktopImage).display !== "none",
      mobileImageVisible: getComputedStyle(mobileImage).display !== "none",
      buttons,
      viewport: {
        width: innerWidth,
        height: innerHeight,
        clientWidth: document.documentElement.clientWidth,
        contentWidth: document.documentElement.scrollWidth
      },
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  });

  const portrait = await readTabletLayout();
  assert.equal(portrait.landscape, false, "768x1024: portrait tablet keeps the mobile composition");
  assert.ok(portrait.mobileImageVisible && !portrait.desktopImageVisible, "768x1024: portrait tablet keeps the mobile image");
  assert.ok(portrait.stage.width <= portrait.viewport.width, "768x1024: portrait tablet fits horizontally");
  assert.ok(portrait.overflow <= 2, "768x1024: portrait tablet has no horizontal overflow");
  console.log("tablet-portrait", JSON.stringify(portrait));

  await tabletPage.setViewportSize({ width: 1024, height: 768 });
  await tabletPage.waitForFunction(() => document.getElementById("stage")?.classList.contains("tablet-landscape"));
  await tabletPage.waitForFunction(() => [...document.querySelectorAll(".sns-auth-button")]
    .every((button) => button.getBoundingClientRect().bottom <= innerHeight));
  const landscape = await readTabletLayout();
  assert.equal(landscape.landscape, true, "1024x768: tablet switches to the landscape composition after rotation");
  assert.ok(landscape.stage.width >= landscape.viewport.width - 18, "1024x768: landscape tablet uses the available width");
  assert.ok(Math.abs(landscape.stage.left - (landscape.viewport.contentWidth - landscape.stage.right)) <= 2, "1024x768: landscape tablet remains centered inside the stable scrollbar gutter");
  assert.ok(landscape.visualRatio > 1.45 && landscape.visualRatio < 1.55, "1024x768: landscape hero keeps the 3:2 desktop image ratio");
  assert.ok(landscape.desktopImageVisible && !landscape.mobileImageVisible, "1024x768: landscape tablet uses the desktop image without stretching the portrait asset");
  assert.ok(landscape.buttons.every((button) => button.height >= 44 && button.top >= 0 && button.bottom <= landscape.viewport.height), "1024x768: all three SNS buttons are in the first screen");
  assert.ok(landscape.overflow <= 2, "1024x768: landscape tablet has no horizontal overflow");
  console.log("tablet-landscape", JSON.stringify(landscape));

  await tabletPage.setViewportSize({ width: 768, height: 1024 });
  await tabletPage.waitForFunction(() => !document.getElementById("stage")?.classList.contains("tablet-landscape"));
  const portraitAgain = await readTabletLayout();
  assert.equal(portraitAgain.landscape, false, "tablet rotation back to portrait restores the portrait composition");
  await tabletPage.close();

  for (const phone of [
    { width: 390, height: 844, profile: "phone" },
    { width: 360, height: 800, profile: "phoneSmall" }
  ]) {
    const page = await browser.newPage({ viewport: { width: phone.width, height: phone.height } });
    await page.goto(`${editorUrl}?mode=view&viewport=${phone.profile}&stylePage=account`, { waitUntil: "commit" });
    await page.waitForSelector('.sns-auth-button[data-sns-provider="kakao"]', { timeout: 15000 });
    const result = await page.evaluate(() => ({
      landscape: document.getElementById("stage").classList.contains("tablet-landscape"),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      stageWidth: document.getElementById("stage").getBoundingClientRect().width,
      viewportWidth: innerWidth,
      mobileImageVisible: getComputedStyle(document.querySelector(".sns-auth-mobile-image")).display !== "none"
    }));
    assert.equal(result.landscape, false, `${phone.width}x${phone.height}: phone never receives tablet landscape rules`);
    assert.ok(result.overflow <= 2 && result.stageWidth <= result.viewportWidth, `${phone.width}x${phone.height}: phone keeps its horizontal fit`);
    assert.equal(result.mobileImageVisible, true, `${phone.width}x${phone.height}: phone keeps the mobile artwork`);
    await page.close();
  }

  console.log("SNS first-fold tests OK on PC, tablet rotation, and phones");
} finally {
  await browser.close();
  await new Promise((resolveClosed) => server.close(resolveClosed));
}
