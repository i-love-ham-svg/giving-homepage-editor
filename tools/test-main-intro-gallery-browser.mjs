import { createRequire } from "node:module";
import { existsSync } from "node:fs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const url = "http://127.0.0.1:4185/representative-greeting-editor.html?v=main-intro-gallery-final";
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 820, height: 1180 }
];

const browserCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
];
const executablePath = browserCandidates.find(existsSync);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const failures = [];
const failedResponses = [];

for (const viewport of viewports) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on("response", (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);

  const mainIntroSectionId = await page.evaluate(() => {
    const select = document.querySelector("#sectionSelect");
    const option = select && [...select.options].find((item) => item.textContent.trim().startsWith("메인 소개"));
    if (!select || !option) return "";
    select.value = option.value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return option.value;
  });
  if (!mainIntroSectionId) failures.push(`${viewport.name}: 메인 소개 섹션 선택 실패`);
  await page.waitForTimeout(250);

  for (const style of ["gallery", "text", "gallery", "text", "gallery"]) {
    const clicked = await page.evaluate(({ nextStyle, sectionId }) => {
      const button = document.querySelector(
        `[data-main-intro-style-switcher][data-section-id="${sectionId}"] [data-main-intro-style="${nextStyle}"]`
      );
      button?.click();
      return Boolean(button);
    }, { nextStyle: style, sectionId: mainIntroSectionId });
    if (!clicked) failures.push(`${viewport.name}: ${style} 스타일 버튼 없음`);
    await page.waitForTimeout(180);
  }

  const result = await page.evaluate((mainIntroId) => {
    const select = document.querySelector("#sectionSelect");
    const optionTexts = select ? [...select.options].map((option) => option.textContent.trim()) : [];
    const mainIntroOptions = optionTexts.filter((text) => text.startsWith("메인 소개"));
    const hiddenMainIntro = optionTexts.filter((text) => text.includes("메인 소개") && text.includes("숨김"));
    const paired = [...document.querySelectorAll(".gallery-section-layer[data-id]")].filter((section) => {
      const model = getGallerySectionContent(section.dataset.id);
      return model?.heroOnly && model?.mainIntroStyleSection
        && model?.mainIntroSourceSectionId === mainIntroId;
    });
    return {
      optionTexts,
      mainIntroOptions,
      hiddenMainIntro,
      pairedCount: paired.length,
      pairedId: paired[0]?.dataset.id || ""
    };
  }, mainIntroSectionId);

  const previewButton = page.locator('[data-mode="view"]').first();
  if (await previewButton.count()) {
    await previewButton.click();
    await page.waitForTimeout(350);
  }

  const spacing = await page.evaluate((pairedId) => {
    const visibleSections = [...document.querySelectorAll(
      ".gallery-section-layer, .program-section-layer"
    )].filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.height > 1;
    });
    const gallery = visibleSections.find((element) =>
      element.classList.contains("gallery-section-layer") && element.dataset.id === pairedId
    );
    const program = visibleSections.find((element) => element.classList.contains("program-section-layer"));
    if (!gallery || !program) return { found: false };
    const galleryRect = gallery.getBoundingClientRect();
    const programRect = program.getBoundingClientRect();
    const galleryHeroRect = gallery.querySelector(".gallery-hero")?.getBoundingClientRect();
    const programContentRect = program.querySelector(".program-section-content")?.getBoundingClientRect();
    const programHeadRect = program.querySelector(".program-section-head")?.getBoundingClientRect();
    return {
      found: true,
      gap: Math.round(programRect.top - galleryRect.bottom),
      perceivedGap: galleryHeroRect && programHeadRect ? Math.round(programHeadRect.top - galleryHeroRect.bottom) : null,
      galleryInternalBottomGap: galleryHeroRect ? Math.round(galleryRect.bottom - galleryHeroRect.bottom) : null,
      programInternalTopGap: programContentRect && programHeadRect ? Math.round(programHeadRect.top - programContentRect.top) : null,
      galleryHeight: Math.round(galleryRect.height),
      programTop: Math.round(programRect.top),
      gallery: {
        id: gallery.dataset.id,
        top: Math.round(galleryRect.top),
        bottom: Math.round(galleryRect.bottom),
        inlineTop: gallery.style.top,
        inlineHeight: gallery.style.height,
        marginBottom: getComputedStyle(gallery).marginBottom,
        paddingBottom: getComputedStyle(gallery).paddingBottom
      },
      program: {
        id: program.dataset.id,
        inlineTop: program.style.top,
        inlineHeight: program.style.height,
        marginTop: getComputedStyle(program).marginTop,
        paddingTop: getComputedStyle(program).paddingTop
      },
      stageGap: getComputedStyle(document.querySelector(".stage")).getPropertyValue("--section-insert-gap")
    };
  }, result.pairedId);

  if (result.mainIntroOptions.length !== 1) {
    failures.push(`${viewport.name}: 메인 소개 선택 항목 ${result.mainIntroOptions.length}개`);
  }
  if (result.hiddenMainIntro.length) {
    failures.push(`${viewport.name}: 숨김 메인 소개 항목 노출`);
  }
  if (result.pairedCount !== 1) {
    failures.push(`${viewport.name}: 내부 갤러리 ${result.pairedCount}개`);
  }
  if (!spacing.found) {
    failures.push(`${viewport.name}: 소개/프로그램 섹션 측정 실패`);
  } else if (spacing.gap > 32) {
    failures.push(`${viewport.name}: 섹션 간격 ${spacing.gap}px`);
  }
  if (errors.length) {
    failures.push(`${viewport.name}: 브라우저 오류 ${errors.join(" | ")}`);
  }

  console.log(JSON.stringify({
    viewport: viewport.name,
    result,
    spacing,
    errors,
    failedResponses: [...new Set(failedResponses)]
  }));
  await page.screenshot({
    path: `tools/.tmp-main-intro-${viewport.name}.png`,
    fullPage: true
  });
  await page.close();
}

await browser.close();

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("main intro gallery browser regression OK");












