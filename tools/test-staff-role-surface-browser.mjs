import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const editorUrl = pathToFileURL(resolve("outputs", "representative-greeting-editor.html")).href;
const executablePath = [
  process.env.BROWSER_EXECUTABLE,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
].filter(Boolean).find(existsSync);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

async function inspectPreview(width, height) {
  const page = await browser.newPage({ viewport: { width, height } });
  try {
    await page.goto(`${editorUrl}?mode=edit&viewport=${width <= 360 ? "phoneSmall" : width <= 430 ? "phone" : "desktop"}`, { waitUntil: "commit" });
    await page.waitForSelector("#staffRolePreviewBtn", { state: "attached", timeout: 60000 });
    // 상단 제작 도구는 실제 화면 폭에 따라 접힐 수 있으므로 전환 이벤트를 직접 발생시킨다.
    await page.evaluate(() => document.getElementById("staffRolePreviewBtn").click());
    await page.waitForFunction(() => document.body.classList.contains("staff-role-preview"));
    const result = await page.evaluate(() => {
      const dock = document.getElementById("staffEditorDock");
      const creator = document.getElementById("staffRoleExitBtn");
      const dockRect = dock.getBoundingClientRect();
      const creatorRect = creator.getBoundingClientRect();
      return {
        role: document.body.dataset.editorRole,
        dockVisible: getComputedStyle(dock).display !== "none",
        dockLabels: [...dock.querySelectorAll("button")].map((button) => button.textContent.trim()),
        activeViewport: document.querySelector("[data-staff-viewport][aria-pressed='true']")?.dataset.staffViewport,
        dockInsideViewport: dockRect.left >= 0 && dockRect.right <= window.innerWidth + 1,
        dockButtonsTouchSafe: [...dock.querySelectorAll("button")].every((button) => button.getBoundingClientRect().height >= 44),
        creatorVisible: getComputedStyle(creator).display !== "none",
        creatorTouchSafe: creatorRect.height >= 44,
        creatorInsideViewport: creatorRect.left >= 0 && creatorRect.right <= window.innerWidth + 1,
        controlsSeparated: creatorRect.bottom <= dockRect.top,
        noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
      };
    });
    assert.equal(result.role, "staff");
    assert.equal(result.dockVisible, true);
    const initialViewport = width <= 360 ? "phoneSmall" : width <= 430 ? "phone" : "desktop";
    assert.deepEqual(result.dockLabels, ["편집", "미리보기", "↶", "↷", "PC", "태블릿", "모바일", "소형폰", "저장"]);
    assert.equal(result.activeViewport, initialViewport);
    assert.equal(result.creatorVisible, true);
    assert.equal(result.dockInsideViewport, true);
    assert.equal(result.dockButtonsTouchSafe, true);
    assert.equal(result.creatorTouchSafe, true);
    assert.equal(result.creatorInsideViewport, true);
    assert.equal(result.controlsSeparated, true, JSON.stringify(result));
    assert.equal(result.noHorizontalOverflow, true);

    for (const viewport of ["desktop", "tablet", "phone", "phoneSmall"]) {
      await page.locator(`[data-staff-viewport="${viewport}"]`).click();
      await page.waitForFunction((expected) => document.querySelector("[data-staff-viewport][aria-pressed='true']")?.dataset.staffViewport === expected, viewport);
      const selected = await page.evaluate(() => ({
        viewport: document.querySelector("[data-staff-viewport][aria-pressed='true']")?.dataset.staffViewport,
        noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
      }));
      assert.deepEqual(selected, { viewport, noHorizontalOverflow: true });
    }

    await page.locator("#staffRoleExitBtn").click();
    await page.waitForFunction(() => document.body.dataset.editorRole === "developer");
    const returned = await page.evaluate(() => ({
      dockHidden: getComputedStyle(document.getElementById("staffEditorDock")).display === "none",
      creatorHidden: getComputedStyle(document.getElementById("staffRoleExitBtn")).display === "none",
      topbarVisible: getComputedStyle(document.querySelector(".topbar")).display !== "none"
    }));
    assert.deepEqual(returned, { dockHidden: true, creatorHidden: true, topbarVisible: true });
    return result;
  } finally {
    await page.close();
  }
}

try {
  const desktop = await inspectPreview(1360, 900);
  const mobile = await inspectPreview(390, 844);
  const smallMobile = await inspectPreview(320, 720);

  const staffPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await staffPage.goto(`${editorUrl}?role=staff&mode=edit&viewport=phone`, { waitUntil: "commit" });
    await staffPage.waitForFunction(() => document.body.dataset.editorRole === "staff");
    const directStaff = await staffPage.evaluate(() => ({
      previewClass: document.body.classList.contains("staff-role-preview"),
      creatorHidden: getComputedStyle(document.getElementById("staffRoleExitBtn")).display === "none",
      dockVisible: getComputedStyle(document.getElementById("staffEditorDock")).display !== "none"
    }));
    assert.deepEqual(directStaff, { previewClass: false, creatorHidden: true, dockVisible: true });
  } finally {
    await staffPage.close();
  }

  console.log(JSON.stringify({ desktop, mobile, smallMobile }, null, 2));
  console.log("staff role surface browser tests OK");
} finally {
  await browser.close();
}
