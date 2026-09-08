import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { createEditorServer } from "./serve-editor.mjs";
import { loadPlaywrightCore } from "../manual-video/v2/record-manual-v2.cjs";
import {
  applyCustomColors,
  auditOpenMenuProfiles,
  captureAdjacentRenderedEvidence,
  captureRenderedAppearance,
  readScope,
  resetGreetingActual,
} from "../manual-video/v2/verify-ch06-runtime.cjs";

const { chromium } = loadPlaywrightCore();
const expectedTitleLabel = "대표자 인사말 제목 영역";
const executablePath = [
  process.env.BROWSER_EXECUTABLE,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean).find(existsSync);
assert.ok(executablePath, "Chrome or Edge is required");

const server = createEditorServer();
const origin = await new Promise((resolveListen, rejectListen) => {
  server.once("error", rejectListen);
  server.listen(0, "127.0.0.1", () => {
    server.off("error", rejectListen);
    resolveListen(`http://127.0.0.1:${server.address().port}`);
  });
});
const browser = await chromium.launch({ headless: true, executablePath });

async function pointerClick(page, locator, label) {
  await locator.waitFor({ state: "visible", timeout: 30_000 });
  await locator.scrollIntoViewIfNeeded();
  const point = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const candidates = [
      [rect.left + rect.width / 2, rect.top + rect.height / 2],
      [rect.left + Math.min(16, rect.width / 3), rect.top + rect.height / 2],
      [rect.right - Math.min(16, rect.width / 3), rect.top + rect.height / 2],
    ];
    for (const [x, y] of candidates) {
      const hit = document.elementFromPoint(x, y);
      if (hit === element || element.contains(hit)) return { x, y };
    }
    return null;
  });
  assert.ok(point, `${label}: no actual pointer hit point`);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.waitForTimeout(45);
  await page.mouse.up();
  return point;
}

function findPath(items, predicate, ancestors = []) {
  for (const item of items || []) {
    const route = [...ancestors, { id: item.id, label: item.label }];
    if (predicate(item)) return route;
    const nested = findPath(item.children, predicate, route);
    if (nested) return nested;
  }
  return null;
}

async function visibleMenuTarget(frame, menuId) {
  const candidates = frame.locator(`#homepageMenu [data-menu-id="${menuId}"]`);
  for (let index = 0; index < await candidates.count(); index += 1) {
    if (await candidates.nth(index).isVisible()) return candidates.nth(index);
  }
  throw new Error(`visible menu target not found: ${menuId}`);
}

const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await context.newPage();
const mutations = [];
page.on("request", (request) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method().toUpperCase())) {
    mutations.push(`${request.method().toUpperCase()} ${new URL(request.url()).pathname}`);
  }
});
await page.route("**/api/board/admin/session", (route) => route.fulfill({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify({ admin: true }),
}));

try {
  await page.goto(
    `${origin}/representative-greeting-editor.html?mode=edit&editorRole=staff`,
    { waitUntil: "domcontentloaded" },
  );
  await page.waitForFunction(
    () => document.body.dataset.editorBootState === "ready",
    null,
    { timeout: 60_000 },
  );
  const frame = page;
  const homeMenu = await frame.locator("body").evaluate(() =>
    structuredClone(window.EditorModules.storage.createSectionDocument().globals.homeMenu));
  const route = findPath(
    homeMenu.items,
    (item) => item.id === "home-menu-intro-main" ||
      (Array.isArray(item.sectionIds) && item.sectionIds.includes("greeting") &&
        (!Array.isArray(item.children) || item.children.length === 0)),
  );
  assert.ok(Array.isArray(route) && route.length >= 2, "greeting route must exist");

  for (let index = 0; index < route.length - 1; index += 1) {
    let childVisible = false;
    try {
      await visibleMenuTarget(frame, route[index + 1].id);
      childVisible = true;
    } catch {
      // The parent disclosure is still closed.
    }
    if (!childVisible) {
      const parent = await visibleMenuTarget(frame, route[index].id);
      if (await parent.getAttribute("aria-expanded") !== "true") {
        await pointerClick(page, parent, `route ${route[index].label}`);
        await page.waitForTimeout(220);
      }
    }
  }
  const leaf = await visibleMenuTarget(frame, route.at(-1).id);
  await pointerClick(page, leaf, `route ${route.at(-1).label}`);
  await page.waitForTimeout(500);

  const target = frame.locator('.editable[data-id="title"] .title-text');
  const before = await target.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(x, y);
    const parent = element.closest(".editable");
    return {
      selector: '.editable[data-id="title"] .title-text',
      tag: element.tagName,
      classes: [...element.classList],
      textContent: element.textContent,
      value: "value" in element ? element.value : null,
      ariaLabel: element.getAttribute("aria-label"),
      title: element.getAttribute("title"),
      parentDataId: parent?.dataset.id || null,
      parentEditLabel: parent?.querySelector(".edit-label")?.textContent.trim() || null,
      boundingBox: {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      },
      elementFromPoint: {
        tag: hit?.tagName || null,
        classes: hit ? [...hit.classList] : [],
        sameOrDescendant: Boolean(hit && (hit === element || element.contains(hit))),
      },
      activeSectionId: window.EditorModules.storage.createSectionDocument().activeSectionId,
    };
  });
  const point = await pointerClick(page, target, "visible greeting title");
  await page.waitForTimeout(180);
  const after = await frame.locator("body").evaluate(() => ({
    selected: document.querySelector('.editable[data-id="title"]')?.classList.contains("selected") || false,
    activeSectionId: window.EditorModules.storage.createSectionDocument().activeSectionId,
    appearanceControlCount: document.querySelectorAll('.section-appearance-control[data-section-id="greeting"]').length,
    triggerText: document.querySelector('.section-appearance-control[data-section-id="greeting"] .section-appearance-trigger')?.textContent.trim() || null,
  }));
  const scope = await readScope(frame);
  const verifierPointerActions = [];
  const runtimeDefault = structuredClone(scope.sections.greeting.effective);
  let openMenuProfiles;
  try {
    openMenuProfiles = await auditOpenMenuProfiles(
      page,
      frame,
      verifierPointerActions,
      scope,
      runtimeDefault,
    );
  } catch (error) {
    const overlapDiagnostic = await frame.locator("body").evaluate(() => {
      const datum = (selector) => {
        const node = document.querySelector(selector);
        if (!node) return { selector, missing: true };
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return {
          selector,
          missing: false,
          tag: node.tagName,
          classes: [...node.classList],
          text: String(node.value ?? node.textContent ?? "").trim().slice(0, 160),
          rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
          position: style.position,
          zIndex: style.zIndex,
          pointerEvents: style.pointerEvents,
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          transform: style.transform,
          hidden: node.hidden,
          inert: node.inert,
          ariaHidden: node.getAttribute("aria-hidden"),
        };
      };
      const trigger = document.querySelector('.section-appearance-control[data-section-id="greeting"] .section-appearance-trigger');
      const toolbar = document.querySelector("#inlineToolbar");
      const triggerRect = trigger?.getBoundingClientRect();
      const toolbarRect = toolbar?.getBoundingClientRect();
      const intersection = triggerRect && toolbarRect ? {
        width: Math.max(0, Math.min(triggerRect.right, toolbarRect.right) - Math.max(triggerRect.left, toolbarRect.left)),
        height: Math.max(0, Math.min(triggerRect.bottom, toolbarRect.bottom) - Math.max(triggerRect.top, toolbarRect.top)),
      } : null;
      const candidateHits = triggerRect ? [
        [triggerRect.left + triggerRect.width / 2, triggerRect.top + triggerRect.height / 2],
        [triggerRect.left + Math.min(8, triggerRect.width / 3), triggerRect.top + triggerRect.height / 2],
        [triggerRect.right - Math.min(8, triggerRect.width / 3), triggerRect.top + triggerRect.height / 2],
      ].map(([x, y]) => {
        const hit = document.elementFromPoint(x, y);
        return {
          x,
          y,
          tag: hit?.tagName || null,
          id: hit?.id || null,
          classes: hit ? [...hit.classList] : [],
          text: String(hit?.value ?? hit?.textContent ?? "").trim().slice(0, 120),
          ariaLabel: hit?.getAttribute?.("aria-label") || null,
        };
      }) : [];
      const toolbarControlsIntersectingTrigger = triggerRect && toolbar
        ? [...toolbar.querySelectorAll("button, input, select")].map((node) => {
          const rect = node.getBoundingClientRect();
          const width = Math.max(0, Math.min(triggerRect.right, rect.right) - Math.max(triggerRect.left, rect.left));
          const height = Math.max(0, Math.min(triggerRect.bottom, rect.bottom) - Math.max(triggerRect.top, rect.top));
          return { node, rect, width, height };
        }).filter((item) => item.width > 0 && item.height > 0).map(({ node, rect, width, height }) => ({
          tag: node.tagName,
          id: node.id || null,
          classes: [...node.classList],
          text: String(node.value ?? node.textContent ?? "").trim().slice(0, 120),
          ariaLabel: node.getAttribute("aria-label"),
          rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
          intersection: { width, height, area: width * height },
        })) : [];
      return {
        viewport: { width: innerWidth, height: innerHeight, scrollTop: document.scrollingElement?.scrollTop || 0 },
        stage: datum("#stage"),
        selectedTitle: datum('.editable[data-id="title"] .title-text'),
        appearanceControl: datum('.section-appearance-control[data-section-id="greeting"]'),
        trigger: datum('.section-appearance-control[data-section-id="greeting"] .section-appearance-trigger'),
        inlineToolbar: datum("#inlineToolbar"),
        toolbarMain: datum("#inlineToolbar .toolbar-main"),
        candidateHits,
        intersection: intersection ? { ...intersection, area: intersection.width * intersection.height } : null,
        toolbarControlsIntersectingTrigger,
        safePlacement: triggerRect && toolbarRect ? {
          spaceAboveTrigger: triggerRect.top,
          spaceBelowTrigger: innerHeight - triggerRect.bottom,
          toolbarHeight: toolbarRect.height,
          fitsAboveWith8pxGap: toolbarRect.height + 8 <= triggerRect.top,
          fitsBelowWith8pxGap: toolbarRect.height + 8 <= innerHeight - triggerRect.bottom,
          candidateTopAbove: triggerRect.top - toolbarRect.height - 8,
          candidateTopBelow: triggerRect.bottom + 8,
        } : null,
      };
    });
    process.stdout.write(`${JSON.stringify({
      status: "focused-failed",
      error: String(error?.message || error),
      overlapDiagnostic,
      recentVerifierPointerActions: verifierPointerActions.slice(-10),
    })}\n`);
    throw error;
  }
  if (process.env.SONGAK_CH06_PROBE_SCOPE === "toolbar") {
    assert.equal(openMenuProfiles.length, 4);
    assert.equal(openMenuProfiles.every((profile) => profile.toolbarSuppressionEvidence.actualPointerOpenCloseReopen), true);
    assert.deepEqual(mutations, []);
    process.stdout.write(`${JSON.stringify({
      status: "passed-toolbar-focused",
      route,
      before,
      after,
      openMenuProfiles: openMenuProfiles.map((profile) => ({
        label: profile.label,
        interactiveCount: profile.exactInteractiveCount,
        minimumTarget: profile.interactive.reduce((minimum, target) => Math.min(minimum, target.width, target.height), Number.POSITIVE_INFINITY),
        menuRect: profile.menuRect,
        stageRect: profile.stageRect,
        rawOverflow: { frame: profile.frameOverflow, parent: profile.parentOverflow },
        normalizedPositiveOverflow: profile.normalizedPositiveOverflow,
        entryScrollPositions: profile.entryScrollPositions,
        selectionEvidence: profile.selectionEvidence,
        selectionPointer: profile.selectionPointer,
        backgroundFloatingSurfaceEvidence: profile.backgroundFloatingSurfaceEvidence,
        viewportPositioningEvidence: profile.viewportPositioningEvidence,
        wheelToResetEvidence: profile.wheelToResetEvidence,
        toolbarSuppressionEvidence: profile.toolbarSuppressionEvidence,
      })),
      verifierPointerActionCount: verifierPointerActions.length,
      mutations,
    })}\n`);
  } else {
  const custom = await applyCustomColors(
    page,
    frame,
    verifierPointerActions,
    "focused argument probe",
    runtimeDefault,
  );
  const renderedAppearance = await captureRenderedAppearance(frame, "desktop");
  const adjacent = await captureAdjacentRenderedEvidence(
    page,
    frame,
    verifierPointerActions,
    "focused argument probe",
  );
  const recoveredScope = await resetGreetingActual(
    page,
    frame,
    verifierPointerActions,
    scope,
    runtimeDefault,
    "focused argument probe",
  );
  assert.equal(before.elementFromPoint.sameOrDescendant, true);
  assert.equal(before.ariaLabel, expectedTitleLabel);
  assert.equal(before.parentEditLabel, expectedTitleLabel);
  assert.equal(after.selected, true);
  assert.equal(after.activeSectionId, "greeting");
  assert.equal(after.appearanceControlCount, 1);
  assert.deepEqual(Object.keys(scope.sections).sort(), ["donation", "greeting", "location"]);
  assert.equal(scope.activeSectionId, "greeting");
  assert.equal(scope.sections.greeting.effective.preset, "cream");
  assert.equal(scope.sections.greeting.effective.decoration, "leaves");
  assert.equal(scope.sections.donation.effective, null);
  assert.equal(scope.sections.location.effective, null);
  assert.equal(custom.entries.length, 3);
  assert.equal(custom.entries.every((entry) => entry.events.some((event) => event.type === "input")), true);
  assert.equal(custom.entries.every((entry) => entry.events.some((event) => event.type === "change")), true);
  assert.equal(renderedAppearance.viewport, "desktop");
  assert.equal(renderedAppearance.rawPresent, true);
  assert.deepEqual(Object.keys(adjacent.sections).sort(), ["donation", "location"]);
  assert.equal(adjacent.sections.donation.rendered.sectionId, "donation");
  assert.equal(adjacent.sections.location.rendered.sectionId, "location");
  assert.equal(recoveredScope.sections.greeting.rawPresent, false);
  assert.deepEqual(recoveredScope.sections.greeting.effective, runtimeDefault);
  assert.deepEqual(mutations, []);
  process.stdout.write(`${JSON.stringify({
    status: "passed",
    route,
    before,
    pointer: point,
    after,
    scope,
    argumentBearingLocatorEvaluateEvidence: {
      customEventCounts: Object.fromEntries(custom.entries.map((entry) => [entry.field, entry.events.length])),
      openMenuProfiles: openMenuProfiles.map((profile) => ({
        label: profile.label,
        interactiveCount: profile.exactInteractiveCount,
        minimumTarget: profile.interactive.reduce((minimum, target) => Math.min(minimum, target.width, target.height), Number.POSITIVE_INFINITY),
        menuRect: profile.menuRect,
        stageRect: profile.stageRect,
        rawOverflow: { frame: profile.frameOverflow, parent: profile.parentOverflow },
        normalizedPositiveOverflow: profile.normalizedPositiveOverflow,
        entryScrollPositions: profile.entryScrollPositions,
        selectionEvidence: profile.selectionEvidence,
        selectionPointer: profile.selectionPointer,
        backgroundFloatingSurfaceEvidence: profile.backgroundFloatingSurfaceEvidence,
        wheelToResetEvidence: profile.wheelToResetEvidence,
        toolbarSuppressionEvidence: profile.toolbarSuppressionEvidence,
      })),
      renderedAppearance: {
        viewport: renderedAppearance.viewport,
        rawPresent: renderedAppearance.rawPresent,
        effective: renderedAppearance.effective,
        surfaceRect: renderedAppearance.surface.rect,
      },
      adjacent: Object.fromEntries(Object.entries(adjacent.sections).map(([sectionId, evidence]) => [sectionId, {
        menuId: evidence.route.menuId,
        renderedSectionId: evidence.rendered.sectionId,
        surfaceRect: evidence.rendered.surface.rect,
      }])),
      recoveredGreeting: recoveredScope.sections.greeting,
      verifierPointerActionCount: verifierPointerActions.length,
    },
    mutations,
  })}\n`);
  }
} finally {
  await context.close();
  await browser.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}
