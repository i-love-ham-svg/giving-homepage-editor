import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { loadPlaywrightCore } from "../manual-video/v2/record-manual-v2.cjs";

const { chromium } = loadPlaywrightCore();
const executablePath = [
  process.env.BROWSER_EXECUTABLE,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
].filter(Boolean).find(existsSync);
const outputRoot = resolve(process.env.SONGAK_EDITOR_ASSET_ROOT || "outputs");
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://127.0.0.1");
    if (url.pathname === "/api/board/admin/session") {
      response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ admin: true }));
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      response.writeHead(404, { "content-type": "application/json" }).end("{}");
      return;
    }
    const relative = decodeURIComponent(url.pathname)
      .replace(/^\/songak\//, "")
      .replace(/^\/+/, "") || "representative-greeting-editor.html";
    const file = resolve(outputRoot, relative);
    if (file !== outputRoot && !file.startsWith(`${outputRoot}${sep}`)) throw new Error("invalid path");
    const info = await stat(file);
    const resolvedFile = info.isDirectory() ? resolve(file, "index.html") : file;
    response.writeHead(200, { "content-type": contentTypes[extname(resolvedFile)] || "application/octet-stream" });
    response.end(await readFile(resolvedFile));
  } catch {
    response.writeHead(404).end("Not found");
  }
});

async function pointerClick(page, locator, label) {
  await locator.scrollIntoViewIfNeeded();
  const point = await locator.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const candidates = [
      [rect.left + rect.width / 2, rect.top + rect.height / 2],
      [rect.left + Math.min(18, rect.width / 3), rect.top + rect.height / 2],
      [rect.right - Math.min(18, rect.width / 3), rect.top + rect.height / 2]
    ];
    for (const [x, y] of candidates) {
      const hit = document.elementFromPoint(x, y);
      if (hit === node || node.contains(hit)) return { x, y };
    }
    return null;
  });
  if (!point) {
    const diagnostic = await locator.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const hit = document.elementFromPoint(x, y);
      return {
        rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
        viewport: { width: innerWidth, height: innerHeight },
        hitTag: hit?.tagName || null,
        hitClass: hit?.className || null,
        hitText: hit?.textContent?.trim().slice(0, 80) || null,
        hidden: node.hidden,
        display: getComputedStyle(node).display,
        visibility: getComputedStyle(node).visibility
      };
    });
    assert.fail(`${label}: actual pointer hit point is unavailable ${JSON.stringify(diagnostic)}`);
  }
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.waitForTimeout(35);
  await page.mouse.up();
}

async function pointerSelectNative(page, locator, value, label) {
  const contract = await locator.evaluate((node, target) => ({
    targetIndex: [...node.options].findIndex((option) => option.value === target),
    values: [...node.options].map((option) => option.value)
  }), value);
  assert.ok(contract.targetIndex >= 0, `${label}: option ${value} is missing`);
  await pointerClick(page, locator, `${label} select`);
  await page.keyboard.press("Home");
  for (let index = 0; index < contract.targetIndex; index += 1) await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  assert.equal(await locator.inputValue(), value, `${label}: native selection did not apply`);
}

async function openAppearanceMenu(page) {
  const control = page.locator('.section-appearance-control[data-section-id="greeting"]');
  await control.waitFor({ state: "visible", timeout: 30_000 });
  const trigger = control.locator('[data-section-appearance-action="toggle"]');
  if (await trigger.getAttribute("aria-expanded") !== "true") {
    await pointerClick(page, trigger, "색상·장식 열기");
  }
  await control.locator(".section-appearance-menu").waitFor({ state: "visible", timeout: 5_000 });
  assert.equal(await trigger.getAttribute("aria-expanded"), "true", "appearance trigger must expose expanded state");
  return control;
}

async function closeAppearanceMenu(page, control) {
  const trigger = control.locator('[data-section-appearance-action="toggle"]');
  await pointerClick(page, trigger, "색상·장식 닫기");
  await control.locator(".section-appearance-menu").waitFor({ state: "hidden", timeout: 5_000 });
}

async function measureAppearanceControl(control) {
  return control.evaluate((root) => {
    const rect = (node) => {
      const value = node.getBoundingClientRect();
      return { left: value.left, top: value.top, right: value.right, bottom: value.bottom, width: value.width, height: value.height };
    };
    const trigger = root.querySelector('[data-section-appearance-action="toggle"]');
    const menu = root.querySelector(".section-appearance-menu");
    const buttons = [...menu.querySelectorAll("button")].map((node) => ({
      label: node.textContent.trim(),
      ariaPressed: node.getAttribute("aria-pressed"),
      rect: rect(node)
    }));
    const fields = [...menu.querySelectorAll(".section-appearance-fields label")].map((node) => ({
      label: node.childNodes[0]?.textContent.trim(),
      rect: rect(node),
      controlAria: node.querySelector("input, select")?.getAttribute("aria-label"),
      controlRect: rect(node.querySelector("input, select")),
      hexAria: node.querySelector("[data-section-appearance-hex]")?.getAttribute("aria-label") || null,
      hexRect: node.querySelector("[data-section-appearance-hex]") ? rect(node.querySelector("[data-section-appearance-hex]")) : null,
      hexInvalid: node.querySelector("[data-section-appearance-hex]")?.getAttribute("aria-invalid") || null,
      errorText: node.querySelector("[data-section-appearance-hex-error]")?.textContent.trim() || null,
      errorHidden: node.querySelector("[data-section-appearance-hex-error]")?.hidden ?? null
    }));
    const menuRect = rect(menu);
    const stage = document.querySelector("#stage");
    return {
      viewport: stage?.dataset.viewport || [...stage.classList].find((name) => ["desktop", "tablet", "phone", "phone-small"].includes(name)),
      trigger: { label: trigger.textContent.trim(), rect: rect(trigger) },
      menuRect,
      buttons,
      fields,
      presetLabels: buttons.filter((item) => item.ariaPressed !== null).map((item) => item.label),
      motifLabels: [...root.querySelectorAll("[data-section-appearance-decoration] option")].map((option) => option.textContent.trim()),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      menuOverflow: Math.max(0, menu.scrollWidth - menu.clientWidth),
      openMenus: document.querySelectorAll(".section-appearance-menu:not([hidden])").length
    };
  });
}

async function measureRenderedContrast(page, expected, label) {
  const evidence = await page.evaluate(({ expectedAppearance, evidenceLabel }) => {
    const parse = (value) => {
      const parts = String(value || "").match(/[\d.]+/g)?.map(Number) || [];
      if (parts.length < 3) throw new Error(`cannot parse color ${value}`);
      return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 };
    };
    const composite = (foreground, background) => ({
      r: foreground.r * foreground.a + background.r * (1 - foreground.a),
      g: foreground.g * foreground.a + background.g * (1 - foreground.a),
      b: foreground.b * foreground.a + background.b * (1 - foreground.a),
      a: 1
    });
    const luminance = ({ r, g, b }) => {
      const channel = (value) => {
        const normalized = value / 255;
        return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    };
    const ratio = (foreground, background) => {
      const first = luminance(foreground);
      const second = luminance(background);
      return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
    };
    const hex = (value) => {
      const normalized = String(value).replace("#", "");
      return parseInt(normalized.slice(0, 2), 16) + "," + parseInt(normalized.slice(2, 4), 16) + "," + parseInt(normalized.slice(4, 6), 16);
    };
    const surface = document.querySelector('.section-theme-surface[data-section-id="greeting"]');
    const editLabel = document.querySelector('[data-section-custom-theme="true"] .edit-label');
    if (!surface || !editLabel) throw new Error(`${evidenceLabel}: visible themed surface or edit label is missing`);
    const surfaceRect = surface.getBoundingClientRect();
    const labelRect = editLabel.getBoundingClientRect();
    const surfaceStyle = getComputedStyle(surface);
    const labelStyle = getComputedStyle(editLabel);
    const surfaceBackground = parse(surfaceStyle.backgroundColor);
    const labelBackground = composite(parse(labelStyle.backgroundColor), surfaceBackground);
    const control = document.querySelector('.section-appearance-control[data-section-id="greeting"]');
    if (!control) throw new Error(`${evidenceLabel}: greeting appearance control is missing`);
    const actualAppearance = {
      background: control.querySelector('[data-section-appearance-color="background"]')?.value.toLowerCase(),
      accent: control.querySelector('[data-section-appearance-color="accent"]')?.value.toLowerCase(),
      text: control.querySelector('[data-section-appearance-color="text"]')?.value.toLowerCase(),
      preset: control.querySelector('[data-section-appearance-action="preset"][aria-pressed="true"]')?.dataset.preset || "custom",
      decoration: control.querySelector("[data-section-appearance-decoration]")?.value
    };
    return {
      label: evidenceLabel,
      actualAppearance,
      expectedAppearance,
      surfaceRect: { width: surfaceRect.width, height: surfaceRect.height },
      editLabelRect: { width: labelRect.width, height: labelRect.height },
      computed: {
        surfaceBackground: surfaceStyle.backgroundColor,
        editLabelColor: labelStyle.color,
        editLabelBackground: labelStyle.backgroundColor
      },
      ratios: {
        textOnBackground: ratio(parse(`rgb(${hex(actualAppearance.text)})`), parse(`rgb(${hex(actualAppearance.background)})`)),
        accentOnBackground: ratio(parse(`rgb(${hex(actualAppearance.accent)})`), parse(`rgb(${hex(actualAppearance.background)})`)),
        whiteOnAccent: ratio(parse("rgb(255,255,255)"), parse(`rgb(${hex(actualAppearance.accent)})`)),
        visibleEditLabel: ratio(parse(labelStyle.color), labelBackground)
      }
    };
  }, { expectedAppearance: expected, evidenceLabel: label });
  assert.deepEqual(evidence.actualAppearance, expected, `${label}: actual appearance mismatch`);
  assert.ok(evidence.surfaceRect.width > 0 && evidence.surfaceRect.height > 0, `${label}: themed surface is not visible`);
  assert.ok(evidence.editLabelRect.width > 0 && evidence.editLabelRect.height > 0, `${label}: edit label is not visible`);
  for (const [name, ratio] of Object.entries(evidence.ratios)) {
    assert.ok(ratio >= 4.5, `${label}: ${name} contrast ${ratio.toFixed(3)} is below 4.5`);
  }
  return evidence;
}

await new Promise((resolveReady) => server.listen(0, "127.0.0.1", resolveReady));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

try {
  const profiles = [
    { value: "desktop", label: "PC", width: 1440, height: 960 },
    { value: "tablet", label: "태블릿", width: 768, height: 960 },
    { value: "phone", label: "모바일", width: 390, height: 844 },
    { value: "phoneSmall", label: "소형폰", width: 320, height: 740 }
  ];
  const measurements = [];
  const contrastMatrix = [];
  let recovery = null;
  for (const profile of profiles) {
    const page = await browser.newPage({ viewport: { width: profile.width, height: profile.height }, locale: "ko-KR" });
    const pageErrors = [];
    const mutationRequests = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("request", (request) => {
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method().toUpperCase())) mutationRequests.push(`${request.method()} ${request.url()}`);
    });
    try {
      const query = new URLSearchParams({ mode: "edit", editorRole: "staff", viewport: profile.value, previewSection: "greeting" });
      await page.goto(`${origin}/songak/representative-greeting-editor.html?${query}`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => document.body.dataset.editorBootState === "ready", null, { timeout: 60_000 });
      await page.locator('.section-appearance-control[data-section-id="greeting"]').waitFor({ state: "visible" });
      const viewportButton = page.locator(`#staffViewportSwitch [data-staff-viewport="${profile.value}"]`);
      assert.equal(await viewportButton.getAttribute("aria-pressed"), "true", `${profile.value}: internal viewport mismatch`);

      const control = await openAppearanceMenu(page);
      const result = await measureAppearanceControl(control);
      result.profile = profile.value;
      result.physicalViewport = { width: profile.width, height: profile.height };
      measurements.push(result);
      const interactiveRects = [
        result.trigger.rect,
        ...result.buttons.map((item) => item.rect),
        ...result.fields.map((item) => item.rect),
        ...result.fields.map((item) => item.controlRect),
        ...result.fields.map((item) => item.hexRect).filter(Boolean)
      ];
      assert.ok(interactiveRects.every((item) => item.width >= 44 - 0.01 && item.height >= 44 - 0.01),
        `${profile.value}: every appearance target must be physically at least 44x44; ${JSON.stringify(result)}`);
      assert.equal(result.overflow <= 0, true, `${profile.value}: positive document horizontal overflow`);
      assert.equal(result.menuOverflow <= 0, true, `${profile.value}: positive appearance menu horizontal overflow`);
      assert.ok(result.menuRect.left >= -1 && result.menuRect.right <= profile.width + 1,
        `${profile.value}: appearance menu must remain within the physical viewport; ${JSON.stringify(result.menuRect)}`);
      assert.equal(result.openMenus, 1, `${profile.value}: exactly one appearance menu must be open`);
      assert.deepEqual(result.presetLabels, ["산뜻한 초록", "따뜻한 크림", "맑은 하늘", "활기찬 코랄", "차분한 보라"]);
      assert.deepEqual(result.motifLabels, ["장식 없음", "원형", "잎사귀", "점무늬", "격자", "물결", "반짝임"]);
      assert.ok(result.fields.every((item) => item.controlAria), `${profile.value}: every direct control must have an accessible name`);
      const colorFields = result.fields.filter((item) => item.hexRect);
      assert.equal(colorFields.length, 3, `${profile.value}: exactly three visible HEX inputs are required`);
      assert.ok(colorFields.every((item) => item.hexAria?.endsWith("HEX 값") && item.hexInvalid === "false"
        && item.errorText === "#RRGGBB 형식으로 입력해 주세요." && item.errorHidden === true),
      `${profile.value}: visible HEX input accessibility/error contract mismatch ${JSON.stringify(colorFields)}`);

      if (profile.value === "desktop") {
        await pointerClick(page, page.locator('.editable[data-id="title"] .title-text'), "대표자 인사말 제목 선택");
        const presetExpectations = {
          green: { background: "#f1f8f3", accent: "#2f7656", text: "#17372b", preset: "green", decoration: "leaves" },
          cream: { background: "#fff8e8", accent: "#a9540f", text: "#3b2a18", preset: "cream", decoration: "leaves" },
          sky: { background: "#eef7fb", accent: "#2f6f91", text: "#153749", preset: "sky", decoration: "leaves" },
          coral: { background: "#fff1ef", accent: "#ac5045", text: "#4a2420", preset: "coral", decoration: "leaves" },
          lavender: { background: "#f6f1fb", accent: "#7157a0", text: "#302444", preset: "lavender", decoration: "leaves" }
        };
        for (const [preset, expected] of Object.entries(presetExpectations)) {
          const liveControl = await openAppearanceMenu(page);
          await pointerClick(page, liveControl.locator(`[data-section-appearance-action="preset"][data-preset="${preset}"]`), expected.preset);
          await page.waitForTimeout(220);
          contrastMatrix.push(await measureRenderedContrast(page, expected, `preset-${preset}`));
        }
        let synchronizedControl = await openAppearanceMenu(page);
        const synchronizedSwatch = synchronizedControl.locator('[data-section-appearance-color="accent"]');
        await synchronizedSwatch.fill("#4d67a6");
        await page.waitForTimeout(160);
        assert.equal(await synchronizedControl.locator('[data-section-appearance-hex="accent"]').inputValue(), "#4D67A6",
          "native swatch input must synchronize the visible accent HEX field");
        synchronizedControl = await openAppearanceMenu(page);
        await pointerClick(page, synchronizedControl.locator('[data-section-appearance-action="preset"][data-preset="cream"]'), "cream-sync-reset");
        await page.waitForTimeout(180);
        synchronizedControl = await openAppearanceMenu(page);
        assert.equal(await synchronizedControl.locator('[data-section-appearance-hex="accent"]').inputValue(), "#A9540F",
          "preset selection must synchronize the visible accent HEX field");
        const custom = { background: "#f3f7ff", accent: "#4d67a6", text: "#1f2b45", preset: "custom", decoration: "leaves" };
        const invalidControl = await openAppearanceMenu(page);
        const invalidHex = invalidControl.locator('[data-section-appearance-hex="background"]');
        const rawBeforeInvalid = await page.evaluate(() => structuredClone(window.EditorModules.storage.createSectionDocument().globals.sectionAppearances.greeting));
        await pointerClick(page, invalidHex, "invalid-background-hex");
        await invalidHex.press("Control+A");
        await invalidHex.pressSequentially("#12");
        await invalidHex.press("Tab");
        await page.waitForTimeout(120);
        const invalidState = {
          value: await invalidHex.inputValue(),
          ariaInvalid: await invalidHex.getAttribute("aria-invalid"),
          errorVisible: await invalidControl.locator('[data-section-appearance-hex-error="background"]').isVisible()
        };
        assert.equal(invalidState.ariaInvalid, "true", `invalid HEX must expose aria-invalid=true ${JSON.stringify(invalidState)}`);
        assert.equal(await invalidControl.locator('[data-section-appearance-hex-error="background"]').isVisible(), true,
          "invalid HEX must expose the Korean inline error");
        assert.deepEqual(await page.evaluate(() => window.EditorModules.storage.createSectionDocument().globals.sectionAppearances.greeting), rawBeforeInvalid,
          "invalid HEX must not change the section appearance model");
        for (const [field, value] of Object.entries(custom).filter(([field]) => ["background", "accent", "text"].includes(field))) {
          const liveControl = await openAppearanceMenu(page);
          const hexInput = liveControl.locator(`[data-section-appearance-hex="${field}"]`);
          await pointerClick(page, hexInput, `custom-${field}-hex`);
          await hexInput.press("Control+A");
          await hexInput.pressSequentially(value);
          await hexInput.press("Tab");
          await page.waitForTimeout(180);
          assert.equal(await hexInput.inputValue(), value.toUpperCase(), `${field}: HEX field did not normalize visibly`);
          assert.equal(await hexInput.getAttribute("aria-invalid"), "false", `${field}: valid HEX remained invalid`);
          assert.equal(await liveControl.locator(`[data-section-appearance-color="${field}"]`).inputValue(), value,
            `${field}: native swatch did not synchronize from HEX`);
        }
        contrastMatrix.push(await measureRenderedContrast(page, custom, "custom-safe-trio"));
        const resetControl = await openAppearanceMenu(page);
        await pointerClick(page, resetControl.locator('[data-section-appearance-action="reset"]'), "추천 기본값");
        await page.waitForTimeout(250);
        recovery = await page.evaluate(() => {
          const controlNode = document.querySelector('.section-appearance-control[data-section-id="greeting"]');
          const documentSnapshot = window.EditorModules.storage.createSectionDocument();
          return {
            rawPresent: Object.prototype.hasOwnProperty.call(documentSnapshot.globals.sectionAppearances, "greeting"),
            effective: {
              background: controlNode.querySelector('[data-section-appearance-color="background"]').value,
              accent: controlNode.querySelector('[data-section-appearance-color="accent"]').value,
              text: controlNode.querySelector('[data-section-appearance-color="text"]').value,
              preset: controlNode.querySelector('[data-section-appearance-action="preset"][aria-pressed="true"]')?.dataset.preset,
              decoration: controlNode.querySelector("[data-section-appearance-decoration]").value
            },
            openMenus: document.querySelectorAll(".section-appearance-menu:not([hidden])").length
          };
        });
        assert.equal(recovery.rawPresent, false, "추천 기본값 must delete the raw greeting appearance key");
        assert.deepEqual(recovery.effective, {
          background: "#fff8e8",
          accent: "#a9540f",
          text: "#3b2a18",
          preset: "cream",
          decoration: "leaves"
        });
        assert.equal(recovery.openMenus, 0, "reset recovery must leave the appearance menu closed after rerender");
      } else {
        await closeAppearanceMenu(page, control);
      }
      assert.deepEqual(pageErrors, [], `${profile.value}: page errors ${JSON.stringify(pageErrors)}`);
      assert.deepEqual(mutationRequests, [], `${profile.value}: unexpected mutation requests ${JSON.stringify(mutationRequests)}`);
    } finally {
      await page.close();
    }
  }
  console.log(JSON.stringify({ status: "passed", measurements, contrastMatrix, recovery }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolveClosed) => server.close(resolveClosed));
}
