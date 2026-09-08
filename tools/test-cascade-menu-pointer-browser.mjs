import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { createEditorServer } from "./serve-editor.mjs";
import { loadPlaywrightCore } from "../manual-video/v2/record-manual-v2.cjs";

const { chromium } = loadPlaywrightCore();
const executablePath = [
  process.env.BROWSER_EXECUTABLE,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean).find(existsSync);
const server = createEditorServer();
const origin = await new Promise((resolveListen, rejectListen) => {
  server.once("error", rejectListen);
  server.listen(0, "127.0.0.1", () => {
    server.off("error", rejectListen);
    resolveListen(`http://127.0.0.1:${server.address().port}`);
  });
});
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

async function pointerClick(page, locator, label) {
  await locator.waitFor({ state: "visible", timeout: 30_000 });
  const box = await locator.boundingBox();
  assert.ok(box, `${label}: bounding box`);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const hit = await locator.evaluate((element, { x: clientX, y: clientY }) => {
    const target = document.elementFromPoint(clientX, clientY);
    return Boolean(target && (target === element || element.contains(target)));
  }, { x, y });
  assert.equal(hit, true, `${label}: real pointer hit test`);
  await page.mouse.move(x, y);
  await page.mouse.click(x, y);
}

async function runProfile(label, viewportName) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();
  try {
    await page.route("**/api/board/admin/session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ admin: true })
      });
    });
    await page.goto(`${origin}/representative-greeting-editor.html?mode=edit&editorRole=staff`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.body.dataset.editorBootState === "ready", null, { timeout: 60_000 });
    await page.locator("#homepageMenuEditBtn").waitFor({ state: "visible", timeout: 60_000 });
    await pointerClick(page, page.locator("#homepageMenuEditBtn"), `${label} editor open`);
    await page.locator("#menuEditorModal").waitFor({ state: "visible" });
    await page.locator("#menuEditorLayoutModeSelect").selectOption("cascade");
    await pointerClick(page, page.locator("#menuEditorCloseBtn"), `${label} editor close`);
    const viewport = page.locator(`#staffViewportSwitch [data-staff-viewport="${viewportName}"]`);
    if (await viewport.getAttribute("aria-pressed") !== "true") await pointerClick(page, viewport, `${label} viewport`);

    if (viewportName === "phone") await pointerClick(page, page.locator("#homepageMenuToggle"), `${label} mobile menu`);
    const root = page.locator("#homepageMenuList > .homepage-menu-item.level-1 > .homepage-menu-link.has-children").first();
    await pointerClick(page, root, `${label} root open`);
    assert.equal(await root.getAttribute("aria-expanded"), "true", `${label}: root expanded`);
    const branch = page.locator("#homepageMenuList .homepage-menu-item.level-2 > .homepage-menu-link.has-children").first();
    await pointerClick(page, branch, `${label} level-two open`);
    assert.equal(await branch.getAttribute("aria-expanded"), "true", `${label}: level-two expanded`);
    const leaf = page.locator("#homepageMenuList .homepage-menu-item.level-3 > .homepage-menu-link").first();
    await leaf.waitFor({ state: "visible" });

    await pointerClick(page, branch, `${label} level-two close`);
    assert.equal(await branch.getAttribute("aria-expanded"), "false", `${label}: level-two closed`);
    await pointerClick(page, branch, `${label} level-two reopen`);
    assert.equal(await branch.getAttribute("aria-expanded"), "true", `${label}: level-two reopened`);
    await pointerClick(page, leaf, `${label} final leaf`);
    await page.waitForTimeout(240);
    const active = page.locator("#homepageMenu .homepage-menu-link[aria-current='page']");
    assert.equal(await active.count(), 1, `${label}: final leaf alone becomes current`);
    const currentText = await active.textContent();
    assert.ok(currentText?.trim(), `${label}: current leaf keeps a visible label`);
    assert.equal(await page.locator("#homepageMenu").getAttribute("data-layout-mode"), "cascade", `${label}: layout persists after final navigation`);
    const geometry = await page.evaluate(() => {
      const menu = document.querySelector("#homepageMenu")?.getBoundingClientRect();
      const visibleSurfaceNode = [...document.querySelectorAll(".main-intro-surface, .essential-section-layer:not([data-section-id='footer']), .program-section-layer, .gallery-section-layer")]
        .find((node) => {
          const rect = node.getBoundingClientRect();
          const style = getComputedStyle(node);
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 20 && rect.height > 20;
        });
      const visibleSurface = visibleSurfaceNode?.getBoundingClientRect();
      return {
        menuBottom: menu?.bottom ?? null,
        surfaceTop: visibleSurface?.top ?? null,
        surfaceBottom: visibleSurface?.bottom ?? null,
        surfaceClass: visibleSurfaceNode?.className || null,
        route: location.pathname,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    });
    assert.ok(geometry.menuBottom !== null && geometry.surfaceTop !== null, `${label}: menu and content geometry`);
    const allowedSurfaceGap = viewportName === "phone" ? 48 : 42;
    assert.ok(geometry.surfaceTop <= geometry.menuBottom + allowedSurfaceGap, `${label}: route/surface gap stays within ${allowedSurfaceGap}px ${JSON.stringify(geometry)}`);
    assert.ok(geometry.surfaceBottom >= geometry.menuBottom - 1.5, `${label}: menu does not fall below content surface`);
    assert.ok(geometry.overflow <= 1, `${label}: no horizontal overflow`);
  } finally {
    await context.close();
  }
}

try {
  await runProfile("PC", "desktop");
  await runProfile("휴대폰", "phone");
  console.log("cascade menu actual pointer PC+phone regression OK");
} finally {
  await browser.close();
  await new Promise((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose()));
}
