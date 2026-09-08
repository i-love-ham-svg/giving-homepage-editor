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
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean).find(existsSync);
assert.ok(executablePath, "Chrome or Edge is required");

const outputRoot = resolve(process.env.SONGAK_EDITOR_ASSET_ROOT || "outputs");
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://127.0.0.1");
    if (url.pathname === "/api/board/admin/session") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ admin: true }));
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      response.writeHead(404, { "content-type": "application/json" });
      response.end("{}");
      return;
    }
    const relative = decodeURIComponent(url.pathname)
      .replace(/^\/songak\//, "")
      .replace(/^\/+/, "") || "representative-greeting-editor.html";
    const file = resolve(outputRoot, relative);
    if (file !== outputRoot && !file.startsWith(`${outputRoot}${sep}`)) {
      throw new Error("invalid path");
    }
    const info = await stat(file);
    const resolvedFile = info.isDirectory() ? resolve(file, "index.html") : file;
    response.writeHead(200, {
      "content-type": contentTypes[extname(resolvedFile)] || "application/octet-stream",
    });
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
      [rect.left + Math.min(14, rect.width / 3), rect.top + rect.height / 2],
      [rect.right - Math.min(14, rect.width / 3), rect.top + rect.height / 2],
    ];
    for (const [x, y] of candidates) {
      const hit = document.elementFromPoint(x, y);
      if (hit === node || node.contains(hit)) return { x, y };
    }
    return null;
  });
  assert.ok(point, `${label}: actual pointer hit point is unavailable`);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.waitForTimeout(35);
  await page.mouse.up();
}

async function collectPresetEvidence(page) {
  return page.locator("#themePresetRow").evaluate((row) => {
    const parse = (value) => {
      const parts = String(value || "").match(/[\d.]+/g)?.map(Number) || [];
      if (parts.length < 3) throw new Error(`cannot parse ${value}`);
      return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 };
    };
    const composite = (foreground, background) => ({
      r: foreground.r * foreground.a + background.r * (1 - foreground.a),
      g: foreground.g * foreground.a + background.g * (1 - foreground.a),
      b: foreground.b * foreground.a + background.b * (1 - foreground.a),
      a: 1,
    });
    const luminance = ({ r, g, b }) => {
      const channel = (value) => {
        const normalized = value / 255;
        return normalized <= 0.03928
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    };
    const ratio = (first, second) => {
      const a = luminance(first);
      const b = luminance(second);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    };
    const rect = (node) => {
      const value = node.getBoundingClientRect();
      return {
        left: value.left,
        top: value.top,
        right: value.right,
        bottom: value.bottom,
        width: value.width,
        height: value.height,
      };
    };
    const buttons = [...row.querySelectorAll(".theme-preset")].map((button) => {
      const label = button.querySelector(".theme-preset-label");
      const buttonStyle = getComputedStyle(button);
      const labelStyle = getComputedStyle(label);
      const buttonBackground = parse(buttonStyle.backgroundColor);
      const labelBackground = composite(parse(labelStyle.backgroundColor), buttonBackground);
      return {
        value: button.dataset.theme,
        label: label.textContent.trim(),
        ariaPressed: button.getAttribute("aria-pressed"),
        active: button.classList.contains("active"),
        buttonRect: rect(button),
        labelRect: rect(label),
        labelColor: labelStyle.color,
        labelBackground: labelStyle.backgroundColor,
        labelOpacity: Number(labelStyle.opacity),
        labelContrast: ratio(parse(labelStyle.color), labelBackground),
        outlineWidth: Number.parseFloat(buttonStyle.outlineWidth) || 0,
      };
    });
    const panel = document.querySelector("#backgroundFloatPanel");
    return {
      buttons,
      panelRect: rect(panel),
      viewport: { width: innerWidth, height: innerHeight },
      documentOverflow:
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
}

const profiles = [
  { name: "desktop", width: 1440, height: 960, viewport: "desktop" },
  { name: "phone", width: 390, height: 844, viewport: "phone" },
  { name: "phoneSmall", width: 320, height: 740, viewport: "phoneSmall" },
];
const expectedLabels = ["브라운", "그린", "블루", "블랙", "로즈"];
const expectedValues = ["warm", "green", "blue", "goldBlack", "rose"];
const results = [];
const mutations = [];
const pageErrors = [];

await new Promise((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
const address = server.address();
const origin = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ executablePath, headless: true });

try {
  for (const profile of profiles) {
    const context = await browser.newContext({
      viewport: { width: profile.width, height: profile.height },
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => pageErrors.push(`${profile.name}: ${error.message}`));
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (request.method() !== "GET" && url.pathname !== "/api/board/admin/session") {
        mutations.push({ profile: profile.name, method: request.method(), route: url.pathname });
      }
    });
    await page.goto(
      `${origin}/songak/representative-greeting-editor.html?mode=edit&editorRole=staff&viewport=${profile.viewport}&previewSection=greeting`,
      { waitUntil: "domcontentloaded", timeout: 30_000 },
    );
    await page.waitForFunction(() => document.body.dataset.editorBootState === "ready", null, {
      timeout: 30_000,
    });
    const toggle = page.locator("#backgroundFloatToggle");
    await pointerClick(page, toggle, `${profile.name}: 배경 열기`);
    await page.locator("#backgroundFloat.open #backgroundFloatPanel").waitFor({
      state: "visible",
      timeout: 5_000,
    });

    let evidence = await collectPresetEvidence(page);
    assert.deepEqual(evidence.buttons.map((item) => item.value), expectedValues);
    assert.deepEqual(evidence.buttons.map((item) => item.label), expectedLabels);
    assert.ok(
      evidence.buttons.every(
        (item) =>
          item.buttonRect.width >= 44 &&
          item.buttonRect.height >= 44 &&
          item.labelRect.width > 0 &&
          item.labelRect.height > 0 &&
          item.labelOpacity > 0 &&
          item.labelContrast >= 4.5,
      ),
      `${profile.name}: label geometry or contrast failed ${JSON.stringify(evidence.buttons)}`,
    );
    assert.ok(
      evidence.panelRect.left >= -1 &&
        evidence.panelRect.right <= evidence.viewport.width + 1 &&
        evidence.panelRect.top >= -1 &&
        evidence.panelRect.bottom <= evidence.viewport.height + 1,
      `${profile.name}: background panel escaped viewport ${JSON.stringify(evidence)}`,
    );
    assert.ok(evidence.documentOverflow <= 1, `${profile.name}: document overflow ${evidence.documentOverflow}`);
    assert.equal(evidence.buttons.filter((item) => item.ariaPressed === "true").length, 1);

    if (profile.name === "desktop") {
      for (const value of expectedValues) {
        await pointerClick(page, page.locator(`.theme-preset[data-theme="${value}"]`), `${value}: preset`);
        await page.waitForTimeout(120);
        evidence = await collectPresetEvidence(page);
        const selected = evidence.buttons.find((item) => item.value === value);
        assert.equal(selected.ariaPressed, "true", `${value}: aria-pressed`);
        assert.equal(selected.active, true, `${value}: active class`);
        assert.ok(selected.outlineWidth >= 2, `${value}: selected outline is not distinct`);
        assert.ok(selected.labelContrast >= 4.5, `${value}: selected inverted label contrast`);
        assert.equal(evidence.buttons.filter((item) => item.ariaPressed === "true").length, 1);
      }
      await pointerClick(page, page.locator('.theme-preset[data-theme="green"]'), "green restore");
      await page.waitForTimeout(120);
      evidence = await collectPresetEvidence(page);
      assert.equal(evidence.buttons.find((item) => item.value === "green").ariaPressed, "true");
    }

    await pointerClick(page, toggle, `${profile.name}: 배경 닫기`);
    assert.equal(await toggle.getAttribute("aria-expanded"), "false");
    results.push({ profile, evidence });
    await context.close();
  }
} finally {
  await browser.close();
  await new Promise((resolvePromise) => server.close(resolvePromise));
}

assert.deepEqual(mutations, [], `unexpected mutation requests ${JSON.stringify(mutations)}`);
assert.deepEqual(pageErrors, [], `page errors ${JSON.stringify(pageErrors)}`);
console.log(JSON.stringify({ status: "passed", results, mutations, pageErrors }));
