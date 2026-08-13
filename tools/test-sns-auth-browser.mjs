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

try {
  for (const viewport of [
    { name: "pc", width: 1440, height: 960 },
    { name: "tablet", width: 820, height: 1080 },
    { name: "mobile", width: 390, height: 844 },
    { name: "small-mobile", width: 320, height: 740 }
  ]) {
    const page = await browser.newPage({ viewport });
    await page.addInitScript(() => localStorage.removeItem("sacwcWebsiteEditor"));
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${editorUrl}?mode=view&stylePage=account`, { waitUntil: "commit" });
    await page.waitForSelector('.sns-auth-button[data-sns-provider="kakao"]', { timeout: 60000 });
    await page.evaluate((name) => {
      setMode("view");
      setViewport(name === "pc" ? "desktop" : name === "tablet" ? "tablet" : name === "small-mobile" ? "phoneSmall" : "phone");
    }, viewport.name);
    await page.waitForFunction(() => [...document.querySelectorAll(".sns-auth-visual img")].some((image) => image.naturalWidth > 0));
    await page.waitForTimeout(350);
    const state = await page.evaluate(() => {
      const panelRect = document.querySelector(".sns-auth-panel").getBoundingClientRect();
      const visualRect = document.querySelector(".sns-auth-visual").getBoundingClientRect();
      const layoutRect = document.querySelector(".sns-auth-layout").getBoundingClientRect();
      const detailRect = document.querySelector('[data-detail-page-kind="account"][data-detail-section-kind="social"] .detail-bundle-section').getBoundingClientRect();
      const panelStyle = getComputedStyle(document.querySelector(".sns-auth-panel"));
      const socialLayer = document.querySelector('[data-detail-page-kind="account"][data-detail-section-kind="social"]')?.closest(".essential-section-layer");
      const footerLayer = socialLayer?.nextElementSibling;
      const image = [...document.querySelectorAll(".sns-auth-visual img")].find((candidate) => getComputedStyle(candidate).display !== "none");
      const imageStyle = getComputedStyle(image);
      const stage = document.getElementById("stage");
      const responsive = stage.classList.contains("mobile");
      const smallPhone = stage.classList.contains("phone-small");
      const panelBackgroundParts = panelStyle.backgroundColor.match(/[\d.]+/g)?.map(Number) || [];
      const panelAlpha = panelBackgroundParts.length > 3 ? panelBackgroundParts[3] : 1;
      const measure = (element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return { left: rect.left, top: rect.top, width: rect.width, height: rect.height, fontSize: style.fontSize, lineHeight: style.lineHeight };
      };
      return ({
        buttons: [...document.querySelectorAll(".sns-auth-button")].map((button) => ({
        provider: button.dataset.snsProvider,
        height: button.getBoundingClientRect().height,
        opacity: Number(getComputedStyle(button).opacity)
        })),
        passwordInputs: document.querySelectorAll('input[type="password"]').length,
        generalAccountInputs: document.querySelectorAll('.sns-auth-panel input[type="email"], .sns-auth-panel input[name*="user" i], .sns-auth-panel input[name*="login" i]').length,
        generalLoginText: document.body.innerText.includes("아이디 로그인"),
        redundantGuidance: ["사용할 SNS 계정 선택", "간편하고 안전하게", "별도 비밀번호 없음", "사용할 SNS를 선택해 주세요"].some((text) => document.querySelector('[data-detail-page-kind="account"][data-detail-section-kind="social"]')?.innerText.includes(text)),
        accountMenu: Boolean(document.querySelector('[data-menu-id="home-menu-account"]')),
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
        imageLoaded: image.naturalWidth > 0 && image.clientHeight >= (smallPhone ? 140 : responsive ? 170 : 220),
        imageAlt: image.alt,
        panelInsideVisual: panelRect.left >= visualRect.left - 2
          && panelRect.right <= visualRect.right + 2
          && panelRect.top >= visualRect.top - 2
          && panelRect.bottom <= visualRect.bottom + 2,
        imageFillsLoginSection: Math.abs(layoutRect.left - detailRect.left) <= 2
          && Math.abs(layoutRect.right - detailRect.right) <= 2
          && Math.abs(visualRect.left - layoutRect.left) <= 2
          && Math.abs(visualRect.right - layoutRect.right) <= 2
          && Math.abs(visualRect.top - layoutRect.top) <= 2
          && Math.abs(visualRect.bottom - layoutRect.bottom) <= 2,
        mobilePanelIsSurfaceFree: !responsive || (
          panelStyle.backgroundColor === "rgba(0, 0, 0, 0)"
          && parseFloat(panelStyle.borderTopWidth) === 0
          && panelStyle.boxShadow === "none"
        ),
        desktopPanelIsTranslucent: responsive || (
          panelAlpha >= .18
          && panelAlpha <= .42
          && panelStyle.backdropFilter !== "none"
        ),
        presetTitleClearsMenu: responsive || Math.abs(new DOMMatrix(imageStyle.transform).f) >= 12,
        tightFooterFlow: !socialLayer || !footerLayer || Math.abs(footerLayer.getBoundingClientRect().top - socialLayer.getBoundingClientRect().bottom) <= 2,
        topIntroductionHidden: [...document.querySelectorAll('[data-detail-page-kind="account"][data-detail-section-kind="hero"]')]
          .every((element) => getComputedStyle(element).display === "none" || element.closest('[hidden]')),
        configHidden: !document.querySelector("[data-sns-auth-config-dialog]")?.open,
        publicStatusRemoved: !document.querySelector("[data-sns-auth-status]"),
        layout: document.querySelector(".sns-auth-layout")?.dataset.snsLayout,
        viewMetrics: {
          visual: measure(document.querySelector(".sns-auth-visual")),
          panel: measure(document.querySelector(".sns-auth-panel")),
          buttons: [...document.querySelectorAll(".sns-auth-button")].map(measure)
        }
      });
    });
    if (state.buttons.length !== 3 || state.buttons.some((button) => button.height < 44)) throw new Error(`${viewport.name} SNS button failure ${JSON.stringify(state)}`);
    const responsiveButtonOpacityOk = viewport.name === "pc"
      ? state.buttons.every((button) => button.opacity === 1)
      : state.buttons.every((button) => button.opacity >= .8 && button.opacity <= .9);
    if (!responsiveButtonOpacityOk) throw new Error(`${viewport.name} SNS button transparency failure ${JSON.stringify(state.buttons)}`);
    if (state.passwordInputs || state.generalAccountInputs || state.generalLoginText || state.redundantGuidance || !state.accountMenu || state.overflow) throw new Error(`${viewport.name} SNS layout failure ${JSON.stringify(state)}`);
    if (!state.imageLoaded || !state.imageAlt || !state.panelInsideVisual || !state.imageFillsLoginSection || !state.mobilePanelIsSurfaceFree || !state.desktopPanelIsTranslucent || !state.presetTitleClearsMenu || !state.tightFooterFlow || !state.topIntroductionHidden || !state.configHidden || !state.publicStatusRemoved || state.layout !== "drive-split") throw new Error(`${viewport.name} SNS visual failure ${JSON.stringify(state)}`);
    await page.locator('.sns-auth-button[data-sns-provider="kakao"]').click();
    const policyButton = page.locator('.footer-document-title-link[data-footer-document-key="privacy"]');
    await policyButton.scrollIntoViewIfNeeded();
    await policyButton.click();
    if (await page.locator("#footerDocumentModal").getAttribute("hidden") !== null) throw new Error(`${viewport.name} privacy modal did not open`);
    await page.locator("#footerDocumentCloseBtn").click();
    await page.evaluate(() => {
      setMode("edit");
      const accountSectionId = Object.keys(state.essentialSections).find((sectionId) => {
        const model = state.essentialSections[sectionId];
        return model?.detailPageKind === "account" && model?.detailSectionKind === "social";
      });
      if (accountSectionId) selectLayer(accountSectionId);
    });
    await page.waitForTimeout(120);
    const editState = await page.evaluate(() => {
      const imageControl = document.querySelector(".sns-auth-visual-editor .detail-bundle-action");
      const configTrigger = document.querySelector(".sns-auth-config-trigger");
      const configDialog = document.querySelector("[data-sns-auth-config-dialog]");
      const imagePicker = document.querySelector(".sns-auth-image-picker");
      const layoutPicker = document.querySelector(".sns-auth-layout-picker");
      const fileInput = document.querySelector(".sns-auth-visual-editor [data-detail-source-file]");
      const panel = document.querySelector(".sns-auth-panel");
      const editActions = document.querySelector(".sns-auth-edit-actions");
      const measure = (element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return { left: rect.left, top: rect.top, width: rect.width, height: rect.height, fontSize: style.fontSize, lineHeight: style.lineHeight };
      };
      return {
        imageControlVisible: Boolean(imageControl) && getComputedStyle(imageControl).display !== "none" && imageControl.offsetHeight >= 44,
        configTriggerVisible: Boolean(configTrigger) && getComputedStyle(configTrigger).display !== "none" && configTrigger.offsetHeight >= 44,
        configDialogClosed: Boolean(configDialog) && !configDialog.open,
        imagePickerCollapsed: Boolean(imagePicker) && !imagePicker.open,
        layoutPickerCollapsed: Boolean(layoutPicker) && !layoutPicker.open,
        accountStyleChoiceRemoved: !document.querySelector('.section-style-choice[data-page-kind="account"]'),
        fileInputAvailable: Boolean(fileInput) && fileInput.getAttribute("accept") === "image/*",
        layoutChoices: document.querySelectorAll("[data-sns-layout-value]").length,
        imageChoices: document.querySelectorAll(".sns-auth-image-choice").length,
        imageFontChoices: [...document.querySelectorAll("#inlineFontFamilySelect option")].filter((option) => ["hahmlet", "pretendard"].includes(option.value)).length,
        appearanceNested: Boolean(panel?.querySelector(".sns-auth-appearance-slot .section-appearance-control")),
        actionsAboveLoginBox: Boolean(editActions && panel) && editActions.getBoundingClientRect().bottom <= panel.getBoundingClientRect().top + 1,
        actionControlCount: editActions?.querySelectorAll(":scope > details, :scope > .sns-auth-visual-editor, :scope > .sns-auth-appearance-slot").length || 0,
        editMetrics: {
          visual: measure(document.querySelector(".sns-auth-visual")),
          panel: measure(document.querySelector(".sns-auth-panel")),
          buttons: [...document.querySelectorAll(".sns-auth-button")].map(measure)
        }
      };
    });
    if (!editState.imageControlVisible || !editState.configTriggerVisible || !editState.configDialogClosed || !editState.imagePickerCollapsed || !editState.layoutPickerCollapsed || !editState.accountStyleChoiceRemoved || !editState.fileInputAvailable || !editState.appearanceNested || !editState.actionsAboveLoginBox || editState.actionControlCount !== 4 || editState.layoutChoices !== 4 || editState.imageChoices !== 3 || editState.imageFontChoices !== 2) throw new Error(`${viewport.name} SNS edit controls failure ${JSON.stringify(editState)}`);
    const metricsMatch = (viewMetric, editMetric) => ["width", "height"].every((key) => Math.abs(viewMetric[key] - editMetric[key]) <= 1)
      && viewMetric.fontSize === editMetric.fontSize
      && viewMetric.lineHeight === editMetric.lineHeight;
    const relativePositionMatches = (viewMetric, viewParent, editMetric, editParent) => ["left", "top"].every((key) => (
      Math.abs((viewMetric[key] - viewParent[key]) - (editMetric[key] - editParent[key])) <= 1
    ));
    if (!metricsMatch(state.viewMetrics.visual, editState.editMetrics.visual)
      || !metricsMatch(state.viewMetrics.panel, editState.editMetrics.panel)
      || !relativePositionMatches(state.viewMetrics.panel, state.viewMetrics.visual, editState.editMetrics.panel, editState.editMetrics.visual)
      || state.viewMetrics.buttons.some((metric, index) => (
        !metricsMatch(metric, editState.editMetrics.buttons[index])
        || !relativePositionMatches(metric, state.viewMetrics.panel, editState.editMetrics.buttons[index], editState.editMetrics.panel)
      ))) {
      throw new Error(`${viewport.name} edit-preview geometry mismatch ${JSON.stringify({ view: state.viewMetrics, edit: editState.editMetrics })}`);
    }
    for (const socialLayout of ["fresh-split", "drive-split", "immersive", "mobile-curve"]) {
      const persistence = await page.evaluate(async (requestedLayout) => {
        document.querySelector(`[data-sns-layout-value="${requestedLayout}"]`)?.click();
        await new Promise((resolveFrame) => requestAnimationFrame(() => resolveFrame()));
        const findSocialSectionId = () => Object.keys(state.essentialSections).find((sectionId) => {
          const model = state.essentialSections[sectionId];
          return model?.detailPageKind === "account" && model?.detailSectionKind === "social";
        });
        const sectionId = findSocialSectionId();
        const renderedLayout = document.querySelector(".sns-auth-layout")?.dataset.snsLayout;
        const buttonHeights = [...document.querySelectorAll(".sns-auth-button")].map((button) => button.getBoundingClientRect().height);
        await window.EditorModules.storage.save();
        const saved = JSON.parse(localStorage.getItem("sacwcWebsiteEditor"));
        const storedLayout = saved.content.essentialSections.find((entry) => entry.sectionId === sectionId)?.content?.socialLayout;
        state.essentialSections[sectionId].socialLayout = "drive-split";
        renderEssentialSection(sectionId);
        const restored = window.EditorModules.storage.load(saved);
        const restoredSectionId = findSocialSectionId();
        return {
          renderedLayout,
          storedLayout,
          restored,
          restoredModelLayout: state.essentialSections[restoredSectionId]?.socialLayout,
          restoredDomLayout: document.querySelector(".sns-auth-layout")?.dataset.snsLayout,
          buttonHeights,
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2
        };
      }, socialLayout);
      if (!persistence.restored
        || persistence.renderedLayout !== socialLayout
        || persistence.storedLayout !== socialLayout
        || persistence.restoredModelLayout !== socialLayout
        || persistence.restoredDomLayout !== socialLayout
        || persistence.buttonHeights.length !== 3
        || persistence.buttonHeights.some((height) => height < 44)
        || persistence.overflow) {
        throw new Error(`${viewport.name} ${socialLayout} persistence failure ${JSON.stringify(persistence)}`);
      }
    }
    await page.locator(".sns-auth-config-trigger").click();
    const configDialogState = await page.evaluate(() => {
      const dialog = document.querySelector("[data-sns-auth-config-dialog]");
      return { open: Boolean(dialog?.open), fields: dialog?.querySelectorAll(".essential-detail").length || 0 };
    });
    if (!configDialogState.open || configDialogState.fields !== 4) throw new Error(`${viewport.name} SNS config dialog failure ${JSON.stringify(configDialogState)}`);
    await page.locator(".sns-auth-config-dialog-close").click();
    await page.locator('.sns-auth-image-choice[data-sns-image-value*="account-sns-pop-v1.webp"]').evaluate((button) => button.click());
    await page.waitForTimeout(120);
    const selectedImages = await page.evaluate(() => ({
      desktop: document.querySelector(".sns-auth-desktop-image")?.getAttribute("src"),
      mobile: document.querySelector(".sns-auth-mobile-image")?.getAttribute("src")
    }));
    if (!selectedImages.desktop?.includes("account-sns-pop-v1.webp") || !selectedImages.mobile?.includes("account-sns-pop-mobile-v2.webp")) throw new Error(`${viewport.name} paired image switch failure ${JSON.stringify(selectedImages)}`);
    await page.locator('.sns-auth-image-choice[data-sns-image-value*="account-sns-character-desktop-v4.webp"]').evaluate((button) => button.click());
    await page.waitForTimeout(120);
    const selectedCharacterImages = await page.evaluate(() => ({
      desktop: document.querySelector(".sns-auth-desktop-image")?.getAttribute("src"),
      mobile: document.querySelector(".sns-auth-mobile-image")?.getAttribute("src")
    }));
    if (!selectedCharacterImages.desktop?.includes("account-sns-character-desktop-v4.webp") || !selectedCharacterImages.mobile?.includes("account-sns-character-mobile-v5.webp")) throw new Error(`${viewport.name} paired character image failure ${JSON.stringify(selectedCharacterImages)}`);
    await page.locator('.sns-auth-button[data-sns-provider="kakao"]').click();
    const ctaToolbar = await page.evaluate(() => ({
      toolbar: !document.getElementById("inlineToolbar").hidden,
      ctaControl: !document.getElementById("inlineCtaBackgroundControl").hidden,
      title: document.getElementById("inlineLayerName").textContent
    }));
    if (!ctaToolbar.toolbar || !ctaToolbar.ctaControl || !ctaToolbar.title.includes("CTA")) throw new Error(`${viewport.name} CTA toolbar failure ${JSON.stringify(ctaToolbar)}`);
    await page.evaluate(() => updateCtaBackground("#245642"));
    const ctaColor = await page.locator('.sns-auth-button[data-sns-provider="kakao"]').evaluate((button) => getComputedStyle(button).backgroundColor);
    if (ctaColor !== "rgb(36, 86, 66)") throw new Error(`${viewport.name} CTA style not applied: ${ctaColor}`);
    await page.evaluate(() => {
      const sectionId = Object.keys(state.essentialSections).find((id) => {
        const model = state.essentialSections[id];
        return model?.detailPageKind === "account" && model?.detailSectionKind === "social";
      });
      if (sectionId) {
        selectEssentialSourceImage(sectionId);
        updateInlineToolbar();
      }
    });
    const imageToolbar = await page.evaluate(() => ({
      upload: !document.getElementById("inlineUploadBtn").hidden,
      fit: !document.getElementById("inlinePhotoFitBtn").hidden,
      fill: !document.getElementById("inlinePhotoFillBtn").hidden
    }));
    if (!imageToolbar.upload || !imageToolbar.fit || !imageToolbar.fill) throw new Error(`${viewport.name} image toolbar failure ${JSON.stringify(imageToolbar)}`);
    if (errors.length) throw new Error(`${viewport.name} page errors: ${errors.join(" | ")}`);
    await page.close();
  }
  console.log("SNS-only account browser tests OK");
} finally {
  await browser.close();
}
