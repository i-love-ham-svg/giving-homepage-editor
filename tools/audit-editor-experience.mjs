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
const profiles = [
  { name: "pc", profile: "desktop", width: 1360, height: 900, touch: false },
  { name: "tablet", profile: "tablet", width: 768, height: 1024, touch: true },
  { name: "mobile", profile: "phone", width: 390, height: 844, touch: true }
];
const results = [];

try {
  for (const mode of ["edit", "view"]) {
    for (const profile of profiles) {
      const pageErrors = [];
      const page = await browser.newPage({ viewport: { width: profile.width, height: profile.height } });
      page.on("pageerror", (error) => pageErrors.push(error.message));
      await page.goto(`${editorUrl}?mode=${mode}&viewport=${profile.profile}`, { waitUntil: "commit" });
      await page.waitForSelector("#stage", { state: "visible" });
      await page.waitForTimeout(550);
      if (mode === "edit") {
        const menuEdit = page.locator("#homepageMenuEditBtn");
        const menuToggle = page.locator("#homepageMenuToggle");
        if (!(await menuEdit.isVisible()) && await menuToggle.isVisible()) {
          await menuToggle.click();
          await page.waitForTimeout(100);
        }
        if (await menuEdit.isVisible()) {
          await menuEdit.click();
          await page.waitForTimeout(120);
        }
      }
      const metrics = await page.evaluate(({ mode, touch }) => {
        const visible = (element) => {
          if (!(element instanceof HTMLElement)) return false;
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
        };
        const labelOf = (element) => String(
          element.getAttribute("aria-label") || element.getAttribute("title") || element.textContent || element.getAttribute("placeholder") || ""
        ).replace(/\s+/g, " ").trim().slice(0, 70);
        const interactive = [...document.querySelectorAll('button, a[href], [role="button"]')].filter((element) => visible(element) && !element.disabled && element.tabIndex >= 0);
        const allSmallTargets = touch ? interactive.flatMap((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width < 44 || rect.height < 44 ? [{ label: labelOf(element), width: Math.round(rect.width), height: Math.round(rect.height), className: element.className }] : [];
        }) : [];
        const smallTargets = allSmallTargets.slice(0, 8);
        const smallTargetClasses = Object.entries(allSmallTargets.reduce((counts, target) => {
          const key = String(target.className || "(no class)").trim() || "(no class)";
          counts[key] = (counts[key] || 0) + 1;
          return counts;
        }, {})).sort((a, b) => b[1] - a[1]).slice(0, 12);
        const unnamed = interactive.filter((element) => !labelOf(element)).map((element) => element.className).slice(0, 20);
        const duplicateIds = [...document.querySelectorAll("[id]")].map((element) => element.id).filter((id, index, ids) => ids.indexOf(id) !== index);
        const stage = document.getElementById("stage");
        const menuModal = document.getElementById("menuEditorModal");
        const modalRect = menuModal && visible(menuModal) ? menuModal.getBoundingClientRect() : null;
        const stageRect = stage.getBoundingClientRect();
        const allViewEditableFields = mode === "view" ? [...document.querySelectorAll("textarea, input, select")].filter((element) => (
          visible(element) && element.tabIndex >= 0 && !element.disabled && !element.closest("[data-detail-application-form]") && !element.closest("[hidden]")
        )) : [];
        const viewEditableFields = allViewEditableFields.map((element) => ({ tag: element.tagName, className: element.className, tabIndex: element.tabIndex })).slice(0, 8);
        const allVisibleEditControls = mode === "view" ? [...document.querySelectorAll(".edit-only, .essential-edit-only, .process-edit-only, .donation-edit-only, .gallery-edit-only, #inlineToolbar, #menuEditorModal")].filter(visible).map((element) => element.className || element.id) : [];
        const visibleEditControls = allVisibleEditControls.slice(0, 8);
        const footer = document.querySelector('[data-essential-template="footer"]')?.closest(".essential-section-layer") || document.querySelector("footer");
        return {
          documentOverflowX: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
          stageOverflowX: Math.max(0, stage.scrollWidth - stage.clientWidth),
          interactiveCount: interactive.length,
          smallTargetCount: allSmallTargets.length,
          smallTargets,
          smallTargetClasses,
          unnamedControlCount: unnamed.length,
          unnamed,
          duplicateIds: [...new Set(duplicateIds)].slice(0, 20),
          headings: { h1: document.querySelectorAll("h1").length, h2: document.querySelectorAll("h2").length, h3: document.querySelectorAll("h3").length },
          landmarks: { nav: document.querySelectorAll("nav").length, main: document.querySelectorAll("main").length, footer: document.querySelectorAll("footer").length },
          missingImageAlt: [...document.images].filter((image) => !image.hasAttribute("alt")).length,
          viewEditableFieldCount: allViewEditableFields.length,
          viewEditableFields,
          visibleEditControlCount: allVisibleEditControls.length,
          visibleEditControls,
          menuModalVisible: Boolean(modalRect),
          menuModalClipped: modalRect ? modalRect.left < stageRect.left - 1 || modalRect.right > stageRect.right + 1 || modalRect.top < stageRect.top - 1 || modalRect.bottom > innerHeight + 1 : false,
          footerPosition: footer ? getComputedStyle(footer).position : "missing"
        };
      }, { mode, touch: profile.touch });
      results.push({ mode, viewport: profile.name, width: profile.width, height: profile.height, pageErrors, ...metrics });
      await page.close();
    }
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));
