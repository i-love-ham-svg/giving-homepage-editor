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
const viewports = [
  { name: "tablet", profile: "tablet", width: 768, height: 1024 },
  { name: "mobile", profile: "phone", width: 390, height: 844 },
  { name: "narrow-mobile", profile: "phone", width: 360, height: 800 },
  { name: "small-mobile", profile: "phoneSmall", width: 320, height: 720 }
];

const overlaps = (a, b, padding = 1) => Boolean(a && b
  && a.left < b.right - padding
  && a.right > b.left + padding
  && a.top < b.bottom - padding
  && a.bottom > b.top + padding);

try {
  // 실제 공개 URL에는 viewport 쿼리가 없으므로 브라우저 폭만으로 모바일을 선택해야 한다.
  const directMobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  directMobile.on("pageerror", (error) => issues.push(`direct-mobile: ${error.message}`));
  await directMobile.goto(`${editorUrl}?mode=view`, { waitUntil: "commit" });
  await directMobile.waitForSelector("#homepageMenu", { state: "visible" });
  const directMetrics = await directMobile.evaluate(() => ({
    viewport: state.viewport,
    overflow: document.documentElement.scrollWidth - window.innerWidth
  }));
  if (directMetrics.viewport !== "phone") issues.push(`direct-mobile: 자동 화면이 phone이 아님 (${directMetrics.viewport})`);
  if (directMetrics.overflow > 2) issues.push(`direct-mobile: 가로 ${directMetrics.overflow}px 넘침`);
  await directMobile.close();

  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    page.on("pageerror", (error) => issues.push(`${viewport.name}: ${error.message}`));
    await page.goto(`${editorUrl}?mode=view&viewport=${viewport.profile}`, { waitUntil: "commit" });
    await page.waitForSelector("#homepageMenu", { state: "visible" });
    const menuData = await page.evaluate(() => {
      const labels = [];
      visitHomeMenuItems((item) => labels.push({ id: item.id, label: String(item.label || "").trim() }));
      return {
        empty: labels.filter((item) => !item.label),
        account: labels.filter((item) => item.id === "home-menu-account" || item.label === "로그인·회원가입")
      };
    });
    if (menuData.empty.length) issues.push(`${viewport.name}: 문구가 비어 있는 메뉴 ${menuData.empty.map((item) => item.id).join(", ")}`);
    if (menuData.account.length !== 1 || menuData.account[0]?.id !== "home-menu-account") {
      issues.push(`${viewport.name}: 로그인·회원가입 메뉴 중복 또는 예전 ID 잔존`);
    }

    // 실제 방문자가 쓰는 클릭 흐름으로 최상위와 중간 메뉴를 펼친다.
    await page.evaluate(() => {
      state.homeMenu.layoutMode = "cascade";
      state.homeMenu.open = true;
      renderHomeMenu({ syncInputs: false });
    });
    await page.locator('[data-menu-id="home-menu-1"]:visible').first().click();
    const rootExpanded = await page.locator('[data-menu-id="home-menu-1"]:visible').first().getAttribute("aria-expanded");
    if (rootExpanded !== "true") issues.push(`${viewport.name}: 복지관 소개 펼치기 실패`);
    await page.locator('[data-menu-id="home-menu-intro-guide"]:visible').first().click();
    const guideExpanded = await page.locator('[data-menu-id="home-menu-intro-guide"]:visible').first().getAttribute("aria-expanded");
    if (guideExpanded !== "true") issues.push(`${viewport.name}: 기관 안내 펼치기 실패`);

    const selected = page.locator('[data-menu-id="home-menu-intro-main"]:visible').first();
    if (!(await selected.count())) issues.push(`${viewport.name}: 메인 소개 목적지가 보이지 않음`);
    else {
      await selected.click();
      await page.waitForTimeout(80);
      const menuClosed = await page.evaluate(() => !state.homeMenu.open && state.activeHomeMenuId === "home-menu-intro-main");
      if (!menuClosed) issues.push(`${viewport.name}: 목적지 선택 후 이동·메뉴 닫힘 실패`);
      await page.locator("#homepageMenuToggle").click();
      await page.waitForTimeout(30);
      const activeStyle = await page.locator('[data-menu-id="home-menu-intro-main"][aria-current="page"]:visible').first().evaluate((el) => {
        const style = getComputedStyle(el);
        return { text: el.textContent.trim(), color: style.color, background: style.backgroundColor, opacity: style.opacity };
      });
      if (!activeStyle.text) issues.push(`${viewport.name}: 선택된 메뉴 문구가 비어 있음`);
      if (/rgba?\(255,\s*255,\s*255(?:,\s*1)?\)/.test(activeStyle.background) && /rgba?\(255,\s*255,\s*255/.test(activeStyle.color)) {
        issues.push(`${viewport.name}: 선택 메뉴가 흰 글자·흰 배경임`);
      }
      if (Number(activeStyle.opacity) < .99) issues.push(`${viewport.name}: 선택 메뉴가 흐리게 표시됨`);
    }

    // 관장 정보의 실제 글자 경계와 서명·직인 경계가 겹치지 않아야 한다.
    await page.evaluate(() => {
      state.homeMenu.open = false;
      navigateToHomeMenuSection("home-menu-intro-main");
      renderIdentityItems("greeting");
      renderSignature("greeting");
      applyLayouts();
      fitAllSignatureText();
    });
    await page.waitForTimeout(80);
    const boxes = await page.evaluate(() => {
      const rect = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      };
      const refs = getGreetingRefs("greeting");
      const identity = [...(refs.identityLayer?.querySelectorAll(".identity-box") || [])]
        .filter((el) => getComputedStyle(el).display !== "none")
        .map((el) => ({ type: el.dataset.type, rect: rect(el.querySelector(".identity-box-text")) }));
      return {
        identity,
        signature: rect(refs.signatureLayer?.querySelector(".signature-text")),
        seal: rect(refs.sealLayer)
      };
    });
    if (boxes.identity.length < 3 || !boxes.signature || !boxes.seal) {
      issues.push(`${viewport.name}: 관장 정보·서명·직인 검사 대상을 찾지 못함`);
    }
    for (const item of boxes.identity) {
      if (overlaps(item.rect, boxes.signature)) issues.push(`${viewport.name}: ${item.type} 글자와 서명이 겹침`);
      if (overlaps(item.rect, boxes.seal)) issues.push(`${viewport.name}: ${item.type} 글자와 직인이 겹침`);
    }
    if (overlaps(boxes.signature, boxes.seal)) issues.push(`${viewport.name}: 서명과 직인이 겹침`);
    await page.close();
  }
} finally {
  await browser.close();
}

if (issues.length) {
  console.error(issues.join("\n"));
  process.exitCode = 1;
} else console.log("mobile menu and greeting visitor tests OK");
