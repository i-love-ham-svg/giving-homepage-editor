import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("uses the renewed Songak shell for the community board route", async () => {
  const [board, styles, contract] = await Promise.all([
    readFile(new URL("app/board-app.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("lib/community-editor-contract.ts", root), "utf8"),
  ]);

  assert.match(board, /data-songak-board-shell="renewal"/);
  assert.match(contract, /VISITOR BOARD/);
  assert.match(contract, /주민의 의견을 듣고 함께 답합니다/);
  assert.match(board, /communitySurface\.fields\.eyebrow/);
  assert.match(board, /communitySurface\.fields\.title/);
  assert.match(board, /className="board-info-row"/);
  assert.match(board, /<HomepageBreadcrumb navigation=\{sharedNavigation \|\| publicNavigation\} currentPath="\/community" className="board-breadcrumb" \/>/);
  assert.doesNotMatch(board, /<nav className="board-breadcrumb"/);

  for (const route of [
    "/about",
    "/programs",
    "/participation",
    "/news",
    "/privacy-policy",
    "/email-refusal",
    "/directions",
  ]) {
    assert.match(board, new RegExp(`href: "${route}"|href="${route}"`));
  }
  assert.match(board, /label: "소통게시판", href: "\/community", children: \[\]/);
  assert.match(board, /label: "알림마당"[\s\S]*?label: "소통게시판", href: "\/community"/);
  assert.match(board, /label: "로그인·회원가입", href: "\/", children: \[\]/);
  assert.match(board, /<HomepageNavigation navigation=\{sharedNavigation \|\| publicNavigation\} currentPath="\/community" \/>/);
  assert.match(board, /\/api\/site-navigation/);
  assert.doesNotMatch(board, /className="site-header"|className="header-nav"|className="mobile-nav"/);

  assert.match(board, /SONGAK COMMUNITY WELFARE CENTER/);
  assert.match(board, /className="contact-grid"/);
  assert.match(board, /sacwc2021@hanmail\.net/);
  assert.match(board, /개인정보처리방침/);
  assert.match(board, /이메일무단수집거부/);

  assert.doesNotMatch(board, /복지관과 주민이\s*<br \/>함께 전하는 이야기/);
  assert.doesNotMatch(board, /누구나 안심하고 참여해요|간편하게 작성|안전하게 확인|쉽게 공유/);
  assert.doesNotMatch(board, /https:\/\/www\.sacwc\.kr\//);
  assert.doesNotMatch(board, /className="hero-guide"|className="guide-label"/);

  assert.match(styles, /\.board-intro\s*\{/);
  assert.match(styles, /\.board-info-row\s*\{/);
  assert.match(styles, /\.board-homepage-menu-shell \.homepage-menu\s*\{/);
  assert.match(styles, /\.board-homepage-menu-shell \.homepage-menu-list\s*\{/);
  assert.match(styles, /\.board-homepage-menu-shell \.homepage-menu-item\.level-1\.expanded > \.homepage-submenu/);
  assert.match(styles, /\.board-homepage-menu-shell \.homepage-menu-link\.contains-active \{[^}]*color: #fff;[^}]*background: #1f5a46;[^}]*opacity: 1;[^}]*-webkit-text-fill-color: #fff/);
  assert.match(styles, /\.board-homepage-menu-shell \.homepage-menu-item\.level-1 > \.homepage-menu-link\.contains-active \{[^}]*color: #fff;[^}]*background: #1f5a46/);
  assert.match(styles, /\.homepage-menu-item\.level-1\.expanded > \.homepage-menu-link\.contains-active,[\s\S]*?background: #1f5a46;[^}]*-webkit-text-fill-color: #fff/);
  assert.match(styles, /\.board-homepage-menu-shell \.homepage-submenu \.homepage-menu-link\.active,[\s\S]*?\.homepage-menu-link\[aria-current="page"\][\s\S]*?background: #1f5a46;[^}]*opacity: 1;[^}]*-webkit-text-fill-color: #fff/);
  assert.match(styles, /\.homepage-menu-item\.level-1\.expanded > \.homepage-menu-link:not\(\.contains-active\)/);
  assert.match(styles, /\.contact-grid\s*\{/);
  assert.doesNotMatch(styles, /\.site-header\s*\{|\.header-nav\s*\{|\.mobile-nav-panel\s*\{/);
});

test("renders the community menu with the exact homepage menu contract", async () => {
  const menu = await readFile(new URL("app/homepage-navigation.tsx", root), "utf8");
  for (const contract of [
    "homepage-menu layout-", "homepage-menu-list", "homepage-menu-brand",
    "homepage-menu-mobile-brand", "homepage-menu-item level-1",
    "homepage-menu-link has-children", "homepage-submenu${",
    "homepage-menu-item level-2 quick-destination", "homepage-menu-subbar layout-", "homepage-menu-toggle",
  ]) assert.ok(menu.includes(contract), `missing homepage menu contract: ${contract}`);
  assert.match(menu, /entries\.splice\(brandIndex, 0, brand\)/);
  assert.match(menu, /document\.body\.style\.overflow = "hidden"/);
  assert.match(menu, /setOpen\(false\); setExpandedId\(""\)/);
  assert.match(menu, /data-homepage-brand-link/);
  assert.match(menu, /<Link[\s\S]*?data-homepage-brand-link/);
  assert.doesNotMatch(menu, /<a[\s\S]*?data-homepage-brand-link/);
  assert.match(menu, /<HomepageNavigationContent key=\{`\$\{props\.currentPath\}:\$\{props\.navigation\.layoutMode\}`\}/);
  assert.doesNotMatch(menu, /useEffect\(\(\) => \{\s*setExpandedId\(""\)/);
  assert.match(menu, /usesDropdown = \["selected-dropdown", "cascade", "unified"\]\.includes/);
  assert.match(menu, /export function HomepageBreadcrumb/);
  assert.match(menu, /findNavigationTrail\(item\.children, normalizedCurrentPath\)/);
  assert.match(menu, /firstNavigableDescendantHref\(item\.children\[0\]\)/);
  assert.match(menu, /const root = trail\[0\]/);
  assert.match(menu, /const current = trail\[trail\.length - 1\]/);
  assert.match(menu, /data-homepage-breadcrumb/);
});

test("keeps every durable board interaction behind the renewed shell", async () => {
  const board = await readFile(new URL("app/board-app.tsx", root), "utf8");

  for (const endpoint of [
    "/api/board/posts?",
    "/api/board/media",
    "/api/board/posts/${encodeURIComponent(id)}",
    "/api/board/posts/${activePost.id}/moderate",
    "/api/board/posts/${activePost.id}/share",
    "/api/board/posts/${activePost.id}/report",
  ]) {
    assert.ok(board.includes(endpoint), `missing board operation: ${endpoint}`);
  }

  assert.match(board, /method: "PATCH"/);
  assert.match(board, /method: "DELETE"/);
  assert.match(board, /navigator\.share/);
  assert.match(board, /thumbnailMediaId/);
  assert.match(board, /accept="image\/jpeg,image\/png,image\/webp,image\/gif,video\/mp4,video\/webm"/);
  assert.match(board, /\{admin && !communityEditor\.active && \(\s*<div className="admin-console">/);
  assert.match(board, /담당자 게시물 관리/);
  assert.match(board, /\{admin && !communityEditor\.active && <section className="moderation-panel">/);
  assert.doesNotMatch(board, /function logoutAdmin\(/);
  assert.match(board, /params\.get\("manage"\) === "1"/);
  assert.match(board, /!adminDialog\.current\.open[\s\S]*?adminDialog\.current\.showModal\(\)/);
  assert.doesNotMatch(board, /adminSignOutPath|signout-with-chatgpt/);
});

test("keeps identity and contact data out of the local board draft", async () => {
  const board = await readFile(new URL("app/board-app.tsx", root), "utf8");
  const resetWrite = board.slice(board.indexOf("function resetWrite()"), board.indexOf("function openWrite"));
  const saveDraft = board.slice(board.indexOf("function saveDraft()"), board.indexOf("async function uploadFiles"));
  const submitPost = board.slice(board.indexOf("async function submitPost"), board.indexOf("async function moderate"));

  assert.match(board, /type PersistedBoardDraft = Pick<Draft, "category" \| "title" \| "body" \| "pinned">/);
  assert.match(saveDraft, /const safeDraft: PersistedBoardDraft = \{[\s\S]*?category: draft\.category,[\s\S]*?title: draft\.title,[\s\S]*?body: draft\.body,[\s\S]*?pinned: draft\.pinned/);
  for (const field of ["author", "contact", "password", "website"]) {
    assert.doesNotMatch(saveDraft, new RegExp(`${field}: draft\\.${field}`), `${field} must stay out of localStorage`);
  }
  assert.match(saveDraft, /localStorage\.setItem\("songak-board-draft-v2", JSON\.stringify\(safeDraft\)\)/);
  assert.match(resetWrite, /const safeSaved: PersistedBoardDraft = \{[\s\S]*?category: saved\.category \|\| emptyDraft\.category,[\s\S]*?title: saved\.title \|\| "",[\s\S]*?body: saved\.body \|\| "",[\s\S]*?pinned: Boolean\(saved\.pinned\)/);
  assert.match(resetWrite, /restored = \{ \.\.\.emptyDraft, \.\.\.safeSaved \}/);
  assert.doesNotMatch(resetWrite, /\.\.\.saved(?:\s|,|})/);
  assert.match(resetWrite, /localStorage\.setItem\("songak-board-draft-v2", JSON\.stringify\(safeSaved\)\)/);
  assert.match(submitPost, /const payload = \{[\s\S]*?\.\.\.draft,/);
});

test("adapts community visual fields to the parent editor without mounting another toolbar", async () => {
  const [board, styles] = await Promise.all([
    readFile(new URL("app/board-app.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);

  assert.match(board, /\/api\/site-content\/songak-homepage\?scope=home-menu-news-board/);
  assert.match(board, /readCommunityEditorSurface\(result\.content\)/);
  assert.match(board, /\.catch\(\(\) => \{ \/\* Published visual state is optional; keep the checked-in defaults\. \*\/ \}\)/);

  assert.match(board, /params\.get\("editorEmbed"\) === "1" && window\.parent !== window/);
  assert.match(board, /result\.admin && requestedEditorEmbed/);
  assert.match(board, /\^\[a-z0-9_-\]\{16,128\}\$\/i\.test\(nonce\)/);
  assert.match(board, /event\.origin !== window\.location\.origin \|\| event\.source !== window\.parent/);
  assert.match(board, /event\.data\.nonce !== communityEditor\.nonce/);
  assert.match(board, /window\.parent\.postMessage\(createCommunityEditorReadyMessage\(nonce\), window\.location\.origin\)/);
  assert.match(board, /createCommunityEditorSelectMessage\(communityEditor\.nonce, targetId/);
  assert.match(board, /createCommunityEditorChangeMessage\(communityEditor\.nonce, next, nextRevision\)/);
  assert.match(board, /isCommunityEditorStateMessage\(event\.data\) \|\| isCommunityEditorApplyMessage\(event\.data\)/);
  assert.match(board, /const communityEditorHydrationLockedRef = useRef\(false\)/);
  assert.match(board, /cancelled \|\| communityEditorHydrationLockedRef\.current \|\| !result\.content/);
  assert.match(board, /if \(result\.admin && requestedEditorEmbed\) \{\s*communityEditorHydrationLockedRef\.current = true;/);
  assert.match(board, /event\.data\.nonce !== communityEditor\.nonce\) return;\s*communityEditorHydrationLockedRef\.current = true;/);
  assert.match(board, /setCommunitySurface\(next\);/);
  assert.match(board, /setCommunityRevision\(nextRevision\);/);
  assert.match(board, /readCommunityCaretOffset\(event\.currentTarget\)/);
  assert.match(board, /restoreCommunityCaretOffset\(selected, caret\.offset\)/);

  for (const target of [
    "eyebrow", "title", "description", "primaryCta", "secondaryCta",
    "publicLabel", "publicValue", "privacyLabel", "privacyValue",
    "processLabel", "processValue", "listEyebrow", "listTitle",
    "emptyTitle", "emptyDescription",
  ]) assert.ok(board.includes(`COMMUNITY_EDITOR_TARGET_IDS.${target}`), `missing editor target: ${target}`);

  assert.match(board, /contentEditable: communityEditor\.active/);
  assert.match(board, /data-editor-target-id/);
  assert.doesNotMatch(board, /inlineToolbar|className=".*editor-toolbar|toolbar-modal/);
  assert.match(styles, /\.community-editor-embed \[data-editor-target-id\]\[data-editor-selected="true"\]/);
  assert.doesNotMatch(styles, /\.community-editor-toolbar|\.board-editor-toolbar/);
});

test("keeps the embedded community surface preview-only and routes staff to real operations", async () => {
  const [board, styles] = await Promise.all([
    readFile(new URL("app/board-app.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);

  assert.match(board, /id="community-editor-preview-note"/);
  assert.match(board, /시각 편집 미리보기/);
  assert.match(board, /href="\/community\?manage=1" target="_blank" rel="noopener noreferrer"/);
  assert.match(board, /aria-disabled=\{communityEditor\.active \|\| undefined\}/);
  assert.match(board, /aria-describedby=\{communityEditor\.active \? "community-editor-preview-note" : undefined\}/);
  assert.match(board, /\{admin && !communityEditor\.active && \(\s*<div className="admin-console">/);
  assert.match(board, /\{admin && !communityEditor\.active && <section className="moderation-panel">/);
  assert.match(board, /\{!communityEditor\.active && <div className="detail-tools">/);

  const openPost = board.slice(board.indexOf("async function openPost"), board.indexOf("function closeDetail"));
  const openWrite = board.slice(board.indexOf("function openWrite"), board.indexOf("function saveDraft"));
  const uploadFiles = board.slice(board.indexOf("async function uploadFiles"), board.indexOf("function removeDraftMedia"));
  const submitPost = board.slice(board.indexOf("async function submitPost"), board.indexOf("function loginAdmin"));
  const moderate = board.slice(board.indexOf("async function moderate"), board.indexOf("async function sharePost"));
  const sharePost = board.slice(board.indexOf("async function sharePost"), board.indexOf("async function submitReport"));
  const submitReport = board.slice(board.indexOf("async function submitReport"), board.indexOf("async function deleteActivePost"));
  const deletePost = board.slice(board.indexOf("async function deleteActivePost"), board.indexOf("function applySearch"));
  assert.match(openPost, /const shouldCountView = countView && !communityEditor\.active/);
  assert.match(openWrite, /if \(communityEditor\.active\) return;/);
  assert.match(uploadFiles, /if \(communityEditor\.active \|\| !files\?\.length\) return;/);
  assert.match(submitPost, /if \(communityEditor\.active \|\| uploading \|\| submitting\) return;/);
  assert.match(moderate, /if \(communityEditor\.active \|\| !activePost\) return;/);
  assert.match(sharePost, /if \(communityEditor\.active \|\| !activePost\) return;/);
  assert.match(submitReport, /if \(communityEditor\.active \|\| !activePost\) return;/);
  assert.match(deletePost, /if \(communityEditor\.active \|\| !activePost\) return;/);
  assert.match(styles, /\.community-editor-preview-note\s*\{/);
  assert.match(styles, /\.community-editor-preview-note a\s*\{[\s\S]*?min-height:\s*44px/);
  assert.doesNotMatch(board, /community-editor-preview-note[\s\S]{0,200}(?:POST|PATCH|DELETE)/);
});

test("renders section appearance and responsive CTA/text-box styles through the existing adapter", async () => {
  const [board, styles, contract] = await Promise.all([
    readFile(new URL("app/board-app.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("lib/community-editor-contract.ts", root), "utf8"),
  ]);

  assert.match(contract, /background: string \| null/);
  assert.match(contract, /boxWidth: clamp\(source\.boxWidth/);
  assert.match(contract, /boxOffsetX: clamp\(source\.boxOffsetX/);
  assert.match(contract, /boxOffsetY: clamp\(source\.boxOffsetY/);
  assert.match(board, /data-community-appearance-decoration=\{surfaceAppearance\.decoration \|\| "none"\}/);
  assert.match(board, /const isCta = targetId === COMMUNITY_EDITOR_TARGET_IDS\.primaryCta/);
  assert.match(board, /isCta && value >= 100 \? "auto" : `\$\{value\}%`/);
  assert.match(board, /"--green": surfaceAppearance\.accent/);
  assert.match(board, /className="primary-btn community-editor-cta" style=\{communityTargetStyle/);
  assert.match(board, /className="secondary-btn button-link community-editor-cta" style=\{communityTargetStyle/);
  for (const viewport of ["desktop", "tablet", "phone", "phone-small"]) {
    assert.ok(styles.includes(`--community-editor-width-${viewport}`), `missing text box width for ${viewport}`);
    assert.ok(styles.includes(`--community-editor-offset-x-${viewport}`), `missing text box x offset for ${viewport}`);
    assert.ok(styles.includes(`--community-editor-offset-y-${viewport}`), `missing text box y offset for ${viewport}`);
    assert.ok(styles.includes(`--community-editor-background-${viewport}`), `missing CTA background for ${viewport}`);
  }
  for (const motif of ["rings", "leaves", "dots", "grid", "waves", "sparkles"]) {
    assert.ok(styles.includes(`data-community-appearance-decoration="${motif}"`), `missing appearance motif ${motif}`);
  }
});

test("renders page background opacity and responsive crop/image geometry from the community model", async () => {
  const [board, styles] = await Promise.all([
    readFile(new URL("app/board-app.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);

  assert.match(board, /<CommunityBackgroundLayer surface=\{communitySurface\} \/>/);
  assert.match(board, /--community-page-background-opacity/);
  assert.match(board, /surfaceBackground\.mode === "image" \? surfaceBackground\.color/);
  assert.match(board, /communityBackgroundGeometry\(communitySurface\)/);
  for (const property of ["cropX", "cropY", "cropW", "cropH", "imageX", "imageY", "imageW", "imageH"]) {
    assert.ok(board.includes(property), `missing background geometry field: ${property}`);
  }
  assert.doesNotMatch(board, /const scale = .*imageScale/);
  assert.match(styles, /\.community-page-background-fill\s*\{[^}]*opacity:\s*var\(--community-page-background-opacity/s);
  assert.match(styles, /\.community-page-background-image\s*\{[^}]*background-image:\s*var\(--community-page-background-image/s);
  for (const viewport of ["desktop", "tablet", "phone", "phone-small"]) {
    assert.ok(styles.includes(`--community-background-crop-x-${viewport}`), `missing crop CSS for ${viewport}`);
    assert.ok(styles.includes(`--community-background-image-x-${viewport}`), `missing image CSS for ${viewport}`);
  }
});
