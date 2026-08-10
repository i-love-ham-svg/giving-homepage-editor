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

const readMetrics = (page) => page.evaluate(() => ({
  elements: document.querySelectorAll("*").length,
  buttons: document.querySelectorAll("button").length,
  inputs: document.querySelectorAll("input, select, textarea").length,
  textareas: document.querySelectorAll("textarea").length,
  mountedManagedSections: Number(document.body.dataset.mountedManagedSections || 0),
  mountedPageKinds: [...document.querySelectorAll("[data-detail-page-kind]")]
    .map((element) => element.dataset.detailPageKind),
  largestBodyRoots: [...document.body.children].map((element) => ({
    name: element.id || element.className || element.tagName,
    descendants: element.querySelectorAll("*").length
  })).sort((a, b) => b.descendants - a.descendants).slice(0, 8),
  largestAppRoots: [...document.querySelector(".app").children].map((element) => ({
    name: element.id || element.className || element.tagName,
    descendants: element.querySelectorAll("*").length
  })).sort((a, b) => b.descendants - a.descendants).slice(0, 12),
  largestWorkspaceRoots: [...document.querySelector(".workspace").children].map((element) => ({
    name: element.id || element.className || element.tagName,
    descendants: element.querySelectorAll("*").length
  })).sort((a, b) => b.descendants - a.descendants).slice(0, 12),
  largestStageShellRoots: [...document.getElementById("stageShell").children].map((element) => ({
    name: element.id || element.className || element.tagName,
    descendants: element.querySelectorAll("*").length
  })).sort((a, b) => b.descendants - a.descendants).slice(0, 12),
  largestStageRoots: [...document.getElementById("stage").children].map((element) => ({
    name: element.id || element.className || element.tagName,
    descendants: element.querySelectorAll("*").length
  })).sort((a, b) => b.descendants - a.descendants).slice(0, 18)
}));

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${editorUrl}?mode=view`, { waitUntil: "commit" });
  await page.waitForSelector('.sns-auth-button[data-sns-provider="kakao"]', { timeout: 60000 });
  await page.waitForTimeout(250);

  const landing = await readMetrics(page);
  if (!landing.mountedPageKinds.includes("account")) throw new Error(`account landing was not mounted: ${JSON.stringify(landing)}`);
  if (landing.elements > 1600 || landing.buttons > 420 || landing.textareas > 60) {
    throw new Error(`initial DOM budget exceeded: ${JSON.stringify(landing)}`);
  }

  await page.evaluate(() => navigateToHomeMenuSection("home-menu-business-schedule"));
  await page.waitForFunction(() => document.querySelector('[data-detail-page-kind="schedule"]'));
  await page.waitForTimeout(250);
  const schedule = await readMetrics(page);
  if (!schedule.mountedPageKinds.includes("schedule") || schedule.mountedPageKinds.includes("account")) {
    throw new Error(`route mount/unmount failed: ${JSON.stringify(schedule)}`);
  }
  if (schedule.elements > 2400 || schedule.buttons > 500 || schedule.textareas > 140) {
    throw new Error(`routed DOM budget exceeded: ${JSON.stringify(schedule)}`);
  }

  await page.evaluate(() => navigateToHomeMenuSection("home-menu-business-application"));
  await page.waitForSelector("[data-detail-application-form]");
  const applicationUrl = page.url();
  await page.locator('[data-detail-action="save-draft"]').click();
  await page.waitForSelector("[data-auth-required-dialog][open]");
  if (page.url() !== applicationUrl) throw new Error("auth request changed the current page before user confirmation");
  await page.locator('[data-auth-required-action="stay"]').click();
  if (await page.locator("[data-auth-required-dialog]").getAttribute("open") !== null) throw new Error("auth dialog did not close");
  if (!await page.locator('[data-detail-page-kind="application"]').count()) throw new Error("auth dialog did not preserve the current application page");
  if (errors.length) throw new Error(`page errors: ${errors.join(" | ")}`);
  console.log(`lazy section mounting browser test OK ${JSON.stringify({ landing, schedule })}`);
} finally {
  await browser.close();
}
