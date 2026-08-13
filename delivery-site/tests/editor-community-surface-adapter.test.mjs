import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../../", import.meta.url);

test("canonical editor reuses one toolbar for the authenticated community surface", async () => {
  const [editor, manager] = await Promise.all([
    readFile(new URL("outputs/representative-greeting-editor.html", root), "utf8"),
    readFile(new URL("outputs/editor-community-surface-manager.js", root), "utf8"),
  ]);

  assert.equal((editor.match(/id="inlineToolbar"/g) || []).length, 1);
  assert.match(editor, /editor-community-surface-manager\.js/);
  assert.match(editor, /function activateCommunitySurface\(\)/);
  assert.match(editor, /\/community\?editorEmbed=1&editorNonce=/);
  assert.match(editor, /event\.origin !== window\.location\.origin/);
  assert.match(editor, /event\.source !== communityFrame\.contentWindow/);
  assert.match(editor, /data-editor-target-id/);
  assert.match(editor, /externalSurfaces:\s*\{/);
  assert.match(editor, /externalSurfaces: structuredClone\(state\.externalSurfaces\)/);
  assert.match(editor, /postCommunitySurface\("apply"\)/);
  assert.match(editor, /requestedExternalSurface === communityRuntime\?\.SURFACE_KEY/);
  assert.doesNotMatch(editor, /essential8[^\n]*community/i);

  assert.match(manager, /publishing\.page\.community-board/);
  assert.match(manager, /songak\.external-surface-editor/);
  assert.match(manager, /주민의 의견을 듣고 함께 답합니다/);
  assert.match(manager, /소통게시판 제목/);
});

test("community background and decorations use the external model while active", async () => {
  const editor = await readFile(new URL("outputs/representative-greeting-editor.html", root), "utf8");
  assert.match(editor, /getCommunitySurface\(\)\.background/);
  assert.match(editor, /surface\.pageDecorations = donationRuntime\.normalizeModel/);
  assert.match(editor, /getCommunitySurface\(\)\.pageDecorations = updatedPageDecorations/);
  assert.match(editor, /state\.pageDecorationModel = updatedPageDecorations/);
  assert.match(editor, /소통게시판 배경 이미지 첨부/);
  assert.match(editor, /state\.activeExternalSurface === communityRuntime\?\.SURFACE_KEY/);
  const fitBackground = editor.slice(editor.indexOf("function fitBackgroundImage()"), editor.indexOf("function deleteBackgroundImage()"));
  const dragBackground = editor.slice(editor.indexOf("function setupBackgroundEditDrag()"), editor.indexOf("function autoTextarea("));
  assert.match(fitBackground, /state\.activeExternalSurface === communityRuntime\?\.SURFACE_KEY[\s\S]*?background\.layouts\[viewport\][\s\S]*?getCommunityBackgroundCoverLayout\(viewport\)[\s\S]*?return;/);
  assert.ok(
    fitBackground.indexOf("state.activeExternalSurface === communityRuntime?.SURFACE_KEY")
      < fitBackground.indexOf("state.background.imageDataUrl"),
    "community guard must run before the global background fit mutation",
  );
  assert.match(dragBackground, /state\.activeExternalSurface === communityRuntime\?\.SURFACE_KEY\) return;/);
  const setViewport = editor.slice(editor.indexOf("function setViewport(viewport"), editor.indexOf("function applyResponsiveState"));
  assert.match(setViewport, /state\.activeExternalSurface !== communityRuntime\?\.SURFACE_KEY && state\.background\.imageDataUrl/);
  assert.match(setViewport, /state\.activeExternalSurface !== communityRuntime\?\.SURFACE_KEY\) useBackgroundViewportLayout\(viewport\)/);
});

test("community history keeps global decorations separate and restores the external model before rendering", async () => {
  const editor = await readFile(new URL("outputs/representative-greeting-editor.html", root), "utf8");
  const historySnapshot = editor.slice(
    editor.indexOf("function createEditorHistorySnapshot()"),
    editor.indexOf("function updateHistoryButtons()"),
  );
  const historyRestore = editor.slice(
    editor.indexOf("function restoreEditorHistorySnapshot(snapshot)"),
    editor.indexOf("function undoHistory()"),
  );
  const saveSnapshot = editor.slice(
    editor.indexOf("async function saveSnapshot()"),
    editor.indexOf("function getDeliveryBoardUrl()"),
  );

  assert.match(editor, /function getGlobalPageDecorationModel\(\)/);
  assert.match(historySnapshot, /pageDecorationModel: structuredClone\(getGlobalPageDecorationModel\(\)\)/);
  assert.doesNotMatch(historySnapshot, /pageDecorationModel: structuredClone\(getPageDecorationModel\(\)\)/);
  assert.match(saveSnapshot, /pageDecorationModel: structuredClone\(getGlobalPageDecorationModel\(\)\)/);
  assert.doesNotMatch(saveSnapshot, /pageDecorationModel: structuredClone\(getPageDecorationModel\(\)\)/);
  assert.ok(
    historyRestore.indexOf("state.externalSurfaces = structuredClone")
      < historyRestore.indexOf("renderPageDecorations();"),
    "history must restore external surfaces before rendering the active decoration model",
  );
});

test("community uses nonvisual parent decoration proxies and syncs proxy edits to BoardApp", async () => {
  const editor = await readFile(new URL("outputs/representative-greeting-editor.html", root), "utf8");
  assert.match(
    editor,
    /\.stage\.community-surface-active > \.page-decoration-layer\s*\{[^}]*z-index:\s*130;/s,
  );
  assert.match(editor, /\.stage\.community-surface-active > \.page-decoration-layer \.donation-heart-mark\s*\{[^}]*color:\s*transparent !important;[^}]*background:\s*transparent !important;/s);
  assert.match(editor, /\.stage\.community-surface-active > \.page-decoration-layer \.donation-heart-mark > \*\s*\{[^}]*visibility:\s*hidden !important;/s);
  assert.match(editor, /\.stage\.community-surface-active > \.page-decoration-layer \.donation-heart-mark:focus-visible\s*\{[^}]*outline:/s);
  assert.match(editor, /\["size", "color"\]\.includes\(field\)[\s\S]*?postCommunitySurface\("apply"\)/);
  assert.match(editor, /isPageDecorationSection\(drag\.sectionId\)[\s\S]*?postCommunitySurface\("apply"\)/);
});

test("community page decorations preserve front and back layers during selection", async () => {
  const editor = await readFile(new URL("outputs/representative-greeting-editor.html", root), "utf8");
  const visualModel = editor.slice(
    editor.indexOf("function getVisualDecorationModel(sectionId)"),
    editor.indexOf("function getVisualDecoration(sectionId"),
  );
  assert.match(visualModel, /if \(!isPageDecorationSection\(sectionId\)\)/);
  assert.match(visualModel, /decoration\.layer = "front"/);
});

test("community reuses section appearance, CTA and text-box controls through the parent adapter", async () => {
  const [editor, manager] = await Promise.all([
    readFile(new URL("outputs/representative-greeting-editor.html", root), "utf8"),
    readFile(new URL("outputs/editor-community-surface-manager.js", root), "utf8"),
  ]);

  assert.match(manager, /style\.background = targetId === TARGET_IDS\.primaryCta \? "#2f6b49" : "#ffffff"/);
  assert.match(manager, /background: source\.background === null[\s\S]*?normalizeColor\(source\.background, fallback\.background\)/);
  assert.match(editor, /const supportsTextBoxLayout = isTextLayer && !galleryTextLayout/);
  assert.match(editor, /kind: "community", targetId: communitySelection\.targetId, style: getCommunityTextStyle\(\)/);
  assert.match(editor, /target\.kind === "community"[\s\S]*?target\.style\.background = color;[\s\S]*?postCommunitySurface\("apply"\)/);
  assert.match(editor, /communityActive \? communityRuntime\.SECTION_ID : normalizeSectionId\(state\.activeSection\)/);
  assert.match(editor, /getCommunitySurface\(\)\.appearance = nextAppearance/);
  assert.match(editor, /getCommunitySurface\(\)\.appearance = normalizedAppearance \|\| communityRuntime\.createDefaultSurface\(\)\.appearance/);
  assert.match(editor, /\.stage\.community-surface-active > :not\(\.community-editor-surface\):not\(\.page-decoration-layer\):not\(\.section-appearance-control\)/);
});

test("parent community normalizer preserves CTA presentation without widening operational data", async () => {
  const manager = await readFile(new URL("outputs/editor-community-surface-manager.js", root), "utf8");
  const sandbox = { window: {}, structuredClone };
  vm.runInNewContext(manager, sandbox, { filename: "outputs/editor-community-surface-manager.js" });
  const runtime = sandbox.window.EditorCommunitySurfaceManager;
  const defaults = runtime.createDefaultSurface();

  for (const viewport of runtime.VIEWPORTS) {
    assert.equal(defaults.textStyles[viewport][runtime.TARGET_IDS.primaryCta].background, "#2f6b49");
    assert.equal(defaults.textStyles[viewport][runtime.TARGET_IDS.secondaryCta].background, "#ffffff");
    assert.equal(defaults.textStyles[viewport][runtime.TARGET_IDS.title].background, null);
  }

  const normalized = runtime.normalizeSurface({
    textStyles: {
      desktop: {
        [runtime.TARGET_IDS.primaryCta]: {
          background: "#ABCDEF",
          color: "#010203",
          boxWidth: 68,
          boxOffsetX: 24,
          boxOffsetY: -16,
        },
      },
    },
    posts: [{ author: "must-not-survive" }],
  });
  const style = normalized.textStyles.desktop[runtime.TARGET_IDS.primaryCta];
  assert.equal(style.background, "#abcdef");
  assert.equal(style.color, "#010203");
  assert.equal(style.boxWidth, 68);
  assert.equal(style.boxOffsetX, 24);
  assert.equal(style.boxOffsetY, -16);
  assert.equal("posts" in normalized, false);
});

test("parent community normalizer clamps nested visual state to the typed contract", async () => {
  const manager = await readFile(new URL("outputs/editor-community-surface-manager.js", root), "utf8");
  const sandbox = { window: {}, structuredClone };
  vm.runInNewContext(manager, sandbox, { filename: "outputs/editor-community-surface-manager.js" });
  const runtime = sandbox.window.EditorCommunitySurfaceManager;
  const normalized = runtime.normalizeSurface({
    layouts: {
      desktop: { contentWidth: 999, paddingTop: -20, paddingBottom: 999, infoColumns: 99, gap: -2, author: "discard" },
      attacker: { posts: [{ phone: "discard" }] },
    },
    background: {
      mode: "image",
      imageDataUrl: "data:image/png;base64,QUJDRA==",
      imageName: "x".repeat(400),
      naturalWidth: 999999,
      naturalHeight: -1,
      opacity: 999,
      layouts: {
        desktop: { imageX: -999, imageY: 999, imageW: 0, imageH: 9999, imageScale: 99, cropX: -4, cropY: 101, cropW: 0, cropH: 200, author: "discard" },
        attacker: { phone: "discard" },
      },
      posts: [{ author: "discard" }],
    },
    pageDecorations: {
      cards: [{ resident: "discard" }],
      decorations: [{
        id: "unsafe id",
        icon: "x".repeat(200),
        style: "y".repeat(200),
        color: "not-a-color",
        layer: "invalid",
        layouts: { desktop: { x: -20, y: 99999, author: "discard" }, attacker: { phone: "discard" } },
        sizes: { desktop: 9999, attacker: 9999 },
        post: { resident: "discard" },
      }],
      nextDecorationId: 999999,
      moderation: { resident: "discard" },
    },
  });

  assert.deepEqual(Object.keys(normalized.layouts).sort(), [...runtime.VIEWPORTS].sort());
  assert.deepEqual(
    { ...normalized.layouts.desktop },
    { contentWidth: 100, paddingTop: 0, paddingBottom: 240, infoColumns: 3, gap: 0 },
  );
  assert.equal(normalized.background.imageDataUrl, "data:image/png;base64,QUJDRA==");
  assert.equal(normalized.background.imageName.length, 180);
  assert.equal(normalized.background.naturalWidth, 20000);
  assert.equal(normalized.background.naturalHeight, 0);
  assert.equal(normalized.background.opacity, 100);
  assert.deepEqual(Object.keys(normalized.background.layouts).sort(), [...runtime.VIEWPORTS].sort());
  assert.deepEqual(
    { ...normalized.background.layouts.desktop },
    { imageX: -400, imageY: 400, imageW: 1, imageH: 800, imageScale: 8, cropX: 0, cropY: 100, cropW: 1, cropH: 100 },
  );
  const decoration = normalized.pageDecorations.decorations[0];
  assert.equal(decoration.id, "community-decoration-1");
  assert.equal(decoration.icon.length, 80);
  assert.equal(decoration.style.length, 80);
  assert.equal(decoration.color, null);
  assert.equal(decoration.layer, "front");
  assert.deepEqual(Object.keys(decoration.layouts).sort(), [...runtime.VIEWPORTS].sort());
  assert.deepEqual(Object.keys(decoration.sizes).sort(), [...runtime.VIEWPORTS].sort());
  assert.deepEqual({ ...decoration.layouts.desktop }, { x: 2, y: 4000 });
  assert.equal(decoration.sizes.desktop, 220);
  assert.equal(normalized.pageDecorations.nextDecorationId, 100000);
  assert.equal(Array.isArray(normalized.pageDecorations.cards), true);
  assert.equal(normalized.pageDecorations.cards.length, 0);
  assert.equal("posts" in normalized.background, false);
  assert.equal("moderation" in normalized.pageDecorations, false);
  assert.equal("post" in decoration, false);
});

test("community clipboard is isolated from homepage sections and only pastes to the same surface", async () => {
  const editor = await readFile(new URL("outputs/representative-greeting-editor.html", root), "utf8");
  const copy = editor.slice(editor.indexOf("function copyActiveSection()"), editor.indexOf("function cutActiveSection()"));
  const cut = editor.slice(editor.indexOf("function cutActiveSection()"), editor.indexOf("function pasteSectionToActive()"));
  const paste = editor.slice(editor.indexOf("function pasteSectionToActive()"), editor.indexOf("function deleteActiveSection()"));

  assert.match(editor, /externalSurfaceClipboard:\s*null/);
  assert.match(copy, /state\.externalSurfaceClipboard = \{[\s\S]*?kind: "external-surface"[\s\S]*?surfaceKey: communityRuntime\.SURFACE_KEY[\s\S]*?textStyles: structuredClone\(surface\.textStyles\)[\s\S]*?layouts: structuredClone\(surface\.layouts\)[\s\S]*?appearance: structuredClone\(surface\.appearance\)[\s\S]*?background: structuredClone\(surface\.background\)[\s\S]*?pageDecorations: structuredClone\(surface\.pageDecorations\)/);
  assert.doesNotMatch(copy.slice(0, copy.indexOf("const sectionId")), /fields:|posts:/);
  assert.doesNotMatch(copy.slice(0, copy.indexOf("const sectionId")), /state\.sectionClipboard|state\.activeSection\s*=/);
  assert.match(cut, /state\.activeExternalSurface === communityRuntime\?\.SURFACE_KEY[\s\S]*?showToast\("소통게시판 화면은 잘라낼 수 없습니다/);
  assert.match(paste, /clipboard\.surfaceKey !== communityRuntime\.SURFACE_KEY/);
  assert.match(paste, /state\.externalSurfaces\.community = communityRuntime\.normalizeSurface\(\{[\s\S]*?\.\.\.structuredClone\(clipboard\.surface\)[\s\S]*?fields: structuredClone\(currentSurface\.fields\)/);
  assert.match(paste, /postCommunitySurface\("apply"\)[\s\S]*?recordHistory\("소통게시판 시각 설정 붙여넣기"\)/);
  assert.doesNotMatch(paste.slice(0, paste.indexOf("const sectionId")), /state\.sectionClipboard|setActiveSection\(/);
});

test("community mode locks homepage section selection, insertion, deletion and ordering controls", async () => {
  const editor = await readFile(new URL("outputs/representative-greeting-editor.html", root), "utf8");
  const activation = editor.slice(editor.indexOf("function setCommunitySurfaceActive(active)"), editor.indexOf("function activateCommunitySurface()"));
  const controls = editor.slice(editor.indexOf("function syncSectionControls()"), editor.indexOf("function copyActiveSection()"));
  const insertion = editor.slice(editor.indexOf("function updateSectionInsertControls()"), editor.indexOf("function hideSectionInsertMenu()"));
  const selectListenerStart = editor.indexOf("sectionSelectControls.forEach((control) => {", editor.indexOf("staffSectionManagerSaveBtn?.addEventListener"));
  const selectListener = editor.slice(selectListenerStart, editor.indexOf("sectionCopyButtons.forEach", selectListenerStart));

  assert.match(activation, /syncSectionControls\(\);[\s\S]*?updateSectionInsertControls\(\);/);
  assert.match(controls, /option\.value = communityRuntime\.SURFACE_KEY[\s\S]*?option\.textContent = "소통게시판 화면"[\s\S]*?control\.disabled = true/);
  assert.match(controls, /sectionCutButtons[\s\S]*?setCommunityHidden\(button, communityActive\)/);
  assert.match(controls, /sectionDeleteButtons[\s\S]*?setCommunityHidden\(button, communityActive\)/);
  assert.match(controls, /sectionAddButtons[\s\S]*?button\.disabled = communityActive[\s\S]*?setCommunityHidden\(button, communityActive\)/);
  assert.match(controls, /communityHiddenRestore[\s\S]*?control\.hidden = control\.dataset\.communityHiddenRestore === "true"/);
  assert.match(insertion, /state\.activeExternalSurface === communityRuntime\?\.SURFACE_KEY[\s\S]*?sectionInsertLayer\.innerHTML = ""[\s\S]*?sectionInsertLayer\.hidden = true[\s\S]*?return;/);
  assert.match(selectListener, /state\.activeExternalSurface === communityRuntime\?\.SURFACE_KEY[\s\S]*?syncSectionControls\(\);[\s\S]*?return;/);
  assert.match(editor, /function openStaffSectionManager\(\)[\s\S]*?state\.activeExternalSurface === communityRuntime\?\.SURFACE_KEY[\s\S]*?return;/);
});

test("community reset restores only current viewport text styles and layout", async () => {
  const editor = await readFile(new URL("outputs/representative-greeting-editor.html", root), "utf8");
  const reset = editor.slice(editor.indexOf("function resetCurrentView()"), editor.indexOf("function updateLayoutProp("));
  const communityBranch = reset.slice(0, reset.indexOf("state.layouts[normalizeViewportKey"));

  assert.match(communityBranch, /const viewport = normalizeViewportKey\(state\.viewport\)/);
  assert.match(communityBranch, /surface\.textStyles\[viewport\] = structuredClone\(defaults\.textStyles\[viewport\]\)/);
  assert.match(communityBranch, /surface\.layouts\[viewport\] = structuredClone\(defaults\.layouts\[viewport\]\)/);
  assert.match(communityBranch, /postCommunitySurface\("apply"\)[\s\S]*?recordHistory\(/);
  assert.doesNotMatch(communityBranch, /surface\.(?:fields|appearance|background|pageDecorations)\s*=/);
  assert.doesNotMatch(communityBranch, /state\.activeSection\s*=/);
});

test("community keyboard clipboard follows surface policy and history excludes it from remote save", async () => {
  const editor = await readFile(new URL("outputs/representative-greeting-editor.html", root), "utf8");
  const shortcuts = editor.slice(editor.indexOf("function handleSectionClipboardShortcut(event)"), editor.indexOf("function isConceptPhotoAsset"));
  const historySnapshot = editor.slice(editor.indexOf("function createEditorHistorySnapshot()"), editor.indexOf("function updateHistoryButtons()"));
  const historyRestore = editor.slice(editor.indexOf("function restoreEditorHistorySnapshot(snapshot)"), editor.indexOf("function undoHistory()"));
  const saveSnapshot = editor.slice(editor.indexOf("async function saveSnapshot()"), editor.indexOf("function loadSnapshot("));

  assert.match(shortcuts, /if \(key === "c"\) SectionManager\.copyActive\(\)/);
  assert.match(shortcuts, /key === "x" && state\.activeExternalSurface === communityRuntime\?\.SURFACE_KEY[\s\S]*?showToast\("소통게시판 화면은 잘라낼 수 없습니다/);
  assert.match(shortcuts, /if \(key === "v"\) SectionManager\.pasteToActive\(\)/);
  assert.match(historySnapshot, /externalSurfaceClipboard: structuredClone\(state\.externalSurfaceClipboard\)/);
  assert.match(historyRestore, /state\.externalSurfaceClipboard = structuredClone\(snapshot\.externalSurfaceClipboard/);
  assert.doesNotMatch(saveSnapshot, /externalSurfaceClipboard/);
});
