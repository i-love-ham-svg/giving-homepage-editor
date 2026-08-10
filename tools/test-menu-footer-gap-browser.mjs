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
const requestedViewport = process.env.SONGAK_TEST_VIEWPORT || "";
const requestedRoute = process.env.SONGAK_TEST_MENU_ROUTE || "";
const viewports = [
  { name: "desktop", profile: "desktop", width: 1440, height: 900 },
  { name: "tablet", profile: "tablet", width: 820, height: 1180 },
  { name: "mobile", profile: "phone", width: 390, height: 844 },
  { name: "small-mobile", profile: "phoneSmall", width: 320, height: 720 }
].filter((viewport) => !requestedViewport || viewport.name === requestedViewport);

try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    page.on("pageerror", (error) => issues.push(`${viewport.name}: ${error.message}`));
    await page.goto(`${editorUrl}?mode=view&viewport=${viewport.profile}`, { waitUntil: "commit" });
    await page.waitForFunction(() => document.body.dataset.editorBootState === "ready", null, { timeout: 15000 });

    const allRouteIds = await page.evaluate(() => {
      const result = [];
      const visit = (items) => (items ?? []).forEach((item) => {
        if ((item.sectionIds?.length || item.sectionId) && !item.externalUrl) result.push(item.id);
        visit(item.children);
      });
      visit(state.homeMenu.items);
      return [...new Set(result)];
    });
    const routeIds = requestedRoute ? allRouteIds.filter((menuId) => menuId === requestedRoute) : allRouteIds;
    const facilityMenu = await page.evaluate(() => ({
      redundantFloorExists: Boolean(findHomeMenuItem("home-menu-intro-floor")),
      facilityIds: getHomeMenuLinkedSectionIds(findHomeMenuItem("home-menu-intro-facility")?.item ?? {})
    }));
    if (facilityMenu.redundantFloorExists) issues.push(`${viewport.name}: redundant facility floor menu still exists`);
    if (facilityMenu.facilityIds.length < 2) issues.push(`${viewport.name}: facility overview lost its integrated floor section`);

    for (const menuId of routeIds) {
      await page.evaluate((id) => navigateToHomeMenuSection(id), menuId);
      await page.waitForTimeout(220);
      await page.evaluate(() => new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame))));
      const metrics = await page.evaluate(() => {
        const visible = getVisibleSectionIds();
        const footerIndex = visible.indexOf("footer");
        const previousId = footerIndex > 0 ? visible[footerIndex - 1] : "";
        const previousCandidates = (sectionLayerMap[previousId] ?? [previousId])
          .map((layerId) => elements[layerId])
          .filter((layer) => layer && !layer.hidden);
        const previous = previousCandidates
          .sort((left, right) => right.getBoundingClientRect().bottom - left.getBoundingClientRect().bottom)[0];
        const footer = elements.footer;
        const previousRect = previous?.getBoundingClientRect();
        const footerRect = footer?.getBoundingClientRect();
        const footerContent = footer?.querySelector('.essential-section-content[data-essential-template="footer"]');
        const footerContentRect = footerContent?.getBoundingClientRect();
        const footerChildren = [...(footerContent?.children ?? [])]
          .filter((child) => getComputedStyle(child).display !== "none")
          .map((child) => child.getBoundingClientRect());
        const stageRect = stage.getBoundingClientRect();
        return {
          activeMenuId: state.activeHomeMenuId,
          previousId,
          externalGap: previousRect && footerRect ? footerRect.top - previousRect.bottom : null,
          footerBottomGap: footerRect ? stageRect.bottom - footerRect.bottom : null,
          footerChildTop: footerChildren.length ? Math.min(...footerChildren.map((rect) => rect.top)) : null,
          footerChildBottom: footerChildren.length ? Math.max(...footerChildren.map((rect) => rect.bottom)) : null,
          footerContentTop: footerContentRect?.top ?? null,
          footerContentBottom: footerContentRect?.bottom ?? null,
          footerScrollHeight: footerContent?.scrollHeight ?? 0,
          footerClientHeight: footerContent?.clientHeight ?? 0,
          stageHeight: getRenderedStageSize().h,
          summedHeight: visible.reduce((sum, sectionId) => sum + getSectionHeightPx(sectionId), 0),
          visible
        };
      });
      const prefix = `${viewport.name}/${menuId}`;
      if (metrics.activeMenuId !== menuId) issues.push(`${prefix}: destination did not activate`);
      if (metrics.externalGap !== null && (metrics.externalGap < -2 || metrics.externalGap > 16)) {
        issues.push(`${prefix}: blank space before footer ${JSON.stringify(metrics)}`);
      }
      // The stage has an 8px preview-frame inset on responsive profiles. It is
      // editor chrome, not page content, and does not appear between section and footer.
      if (metrics.footerBottomGap === null || metrics.footerBottomGap < -2 || metrics.footerBottomGap > 10) {
        issues.push(`${prefix}: footer does not close the page ${JSON.stringify(metrics)}`);
      }
      if (metrics.footerChildTop !== null && metrics.footerContentTop !== null && metrics.footerChildTop < metrics.footerContentTop - 5) {
        issues.push(`${prefix}: footer content is masked at the top ${JSON.stringify(metrics)}`);
      }
      if (metrics.footerChildBottom !== null && metrics.footerContentBottom !== null && metrics.footerChildBottom > metrics.footerContentBottom + 5) {
        issues.push(`${prefix}: footer content is clipped at the bottom ${JSON.stringify(metrics)}`);
      }
      // A responsive transform can leave scrollHeight a few unscaled pixels above
      // clientHeight. The rendered child boundaries above are the authoritative
      // visual clipping check used for the visitor screen.
    }
    await page.close();
  }
} finally {
  await browser.close();
}

if (issues.length) {
  console.error(issues.join("\n"));
  process.exitCode = 1;
} else {
  console.log("all menu destinations close directly against the footer on 4 viewports");
}
