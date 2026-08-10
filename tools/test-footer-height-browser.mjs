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
const issues = [];
const splitSnapshots = new Map();
const viewports = [
  { name: "desktop", profile: "desktop", width: 1440, height: 900 },
  { name: "tablet", profile: "tablet", width: 820, height: 1180 },
  { name: "mobile", profile: "phone", width: 390, height: 844 },
  { name: "small-mobile", profile: "phoneSmall", width: 320, height: 720 }
];
const modes = ["edit", "view"];
const layouts = ["info", "simple", "compact", "split"];

try {
  for (const viewport of viewports) {
    for (const mode of modes) {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
      page.on("pageerror", (error) => issues.push(`${viewport.name}/${mode}: ${error.message}`));
      await page.goto(`${editorUrl}?mode=${mode}&previewSection=footer&viewport=${viewport.profile}`, { waitUntil: "commit" });
      await page.waitForSelector('.essential-section-content[data-essential-template="footer"]', { state: "visible" });

      for (const layout of layouts) {
        await page.evaluate(({ layout, mode, profile }) => {
          setViewport(profile);
          setMode(mode);
          const model = getEssentialModel("footer");
          model.layoutStyle = layout;
          if (layout === "compact") {
            const key = normalizeViewportKey(state.viewport);
            model.details.forEach((detail) => {
              detail.textStyles[key].label = { ...detail.textStyles[key].label, boxWidth: 30, boxOffsetX: 320, boxOffsetY: 160 };
              detail.textStyles[key].value = { ...detail.textStyles[key].value, boxWidth: 30, boxOffsetX: -320, boxOffsetY: 160 };
            });
          }
          model.heights = {};
          renderEssentialSection("footer");
        }, { layout, mode, profile: viewport.profile });
        await page.waitForTimeout(180);

        const result = await page.evaluate(() => {
          const content = document.querySelector('.essential-section-content[data-essential-template="footer"]');
          const layer = content.closest(".essential-section-layer");
          const contentRect = content.getBoundingClientRect();
          const values = [...content.querySelectorAll(".essential-detail-value")].map((value) => {
            const rect = value.getBoundingClientRect();
            return { width: rect.width, height: rect.height, translate: getComputedStyle(value).translate };
          });
          const tools = [...content.querySelectorAll(".essential-detail-tools")];
          const visibleFooterTitle = document.getElementById("stage").classList.contains("view-mode")
            ? content.querySelector(".footer-document-title-link")
            : content.querySelector(".essential-item-title");
          const typography = (element) => {
            const style = element ? getComputedStyle(element) : null;
            return style ? { fontSize: style.fontSize, lineHeight: style.lineHeight } : null;
          };
          return {
            contentHeight: contentRect.height,
            layerHeight: layer.getBoundingClientRect().height,
            horizontalOverflow: content.scrollWidth > content.clientWidth + 2,
            values,
            detailToolOpacities: tools.map((tool) => Number(getComputedStyle(tool).opacity)),
            styleSwitcherVisible: Boolean(content.querySelector(".essential-footer-layout-switcher"))
              && getComputedStyle(content.querySelector(".essential-footer-layout-switcher")).display !== "none",
            typography: {
              headline: typography(content.querySelector(".essential-headline")),
              description: typography(content.querySelector(".essential-description")),
              detailValue: typography(content.querySelector(".essential-detail-value")),
              documentTitle: typography(visibleFooterTitle),
              note: typography(content.querySelector(".essential-note"))
            }
          };
        });

        const prefix = `${viewport.name}/${mode}/${layout}`;
        if (result.horizontalOverflow) issues.push(`${prefix}: horizontal overflow`);
        if (mode === "edit" && !result.styleSwitcherVisible) issues.push(`${prefix}: layout switcher missing`);
        if (mode === "view" && result.styleSwitcherVisible) issues.push(`${prefix}: edit-only layout switcher visible`);
        if (layout === "compact") {
          if (result.values.some((value) => value.width < 72 || value.height > 96 || value.translate !== "none")) {
            issues.push(`${prefix}: saved text geometry broke compact rows ${JSON.stringify(result.values)}`);
          }
          if (mode === "edit" && result.detailToolOpacities.some((opacity) => opacity !== 0)) {
            issues.push(`${prefix}: compact row tools obscure the first edit view`);
          }
        }
        if (layout === "split") splitSnapshots.set(`${viewport.name}/${mode}`, result);
      }
      await page.close();
    }
  }
  for (const viewport of viewports) {
    const edit = splitSnapshots.get(`${viewport.name}/edit`);
    const view = splitSnapshots.get(`${viewport.name}/view`);
    if (!edit || !view) continue;
    if (Math.abs(edit.contentHeight - view.contentHeight) > 2) {
      issues.push(`${viewport.name}/split: edit/view height mismatch ${edit.contentHeight} vs ${view.contentHeight}`);
    }
    for (const key of Object.keys(edit.typography)) {
      if (edit.typography[key]?.fontSize !== view.typography[key]?.fontSize
        || edit.typography[key]?.lineHeight !== view.typography[key]?.lineHeight) {
        issues.push(`${viewport.name}/split/${key}: edit/view typography mismatch ${JSON.stringify({ edit: edit.typography[key], view: view.typography[key] })}`);
      }
    }
  }
} finally {
  await browser.close();
}

if (issues.length) {
  console.error(issues.join("\n"));
  process.exitCode = 1;
} else {
  console.log("footer 4-layout x 4-viewport x edit/view browser matrix OK");
}
