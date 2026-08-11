import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../outputs/community-board.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../outputs/community-board.js", import.meta.url), "utf8");
const editor = readFileSync(new URL("../outputs/representative-greeting-editor.html", import.meta.url), "utf8");
const server = readFileSync(new URL("./serve-editor.mjs", import.meta.url), "utf8");

[
  "postGrid", "writeDialog", "detailDialog", "mediaInput", "mediaPreview", "sharePostBtn",
  "reportPostBtn", "moderationTools", "adminStatusSelect", "mobileWriteBtn"
].forEach((id) => assert.match(html, new RegExp(`id=["']${id}["']`), `${id} should exist`));

assert.match(html, /accept="[^"]*image\/jpeg[^"]*video\/mp4/);
assert.match(html, /@media \(max-width: 640px\)/);
assert.match(script, /navigator\.share/);
assert.match(script, /captureVideoThumbnail/);
assert.match(script, /songak-board-draft/);
assert.match(script, /const expiresAt = Date\.now\(\) \+ 30 \* 60 \* 1000;[\s\S]*?sessionStorage\.setItem\("songak-board-draft"[\s\S]*?expiresAt[\s\S]*?scheduleBoardDraftExpiry\(expiresAt\)/);
assert.match(script, /function scheduleBoardDraftExpiry\(expiresAt\)[\s\S]*?clearBoardDraftExpiryTimer\(\)[\s\S]*?window\.setTimeout\(removeBoardDraft, remaining\)/);
assert.match(script, /postConsent\.addEventListener\("change"[\s\S]*?if \(!elements\.postConsent\.checked\) removeBoardDraft\(\)/);
assert.match(script, /addEventListener\("pagehide", clearBoardDraftExpiryTimer[\s\S]*?addEventListener\("pageshow", scheduleStoredBoardDraftExpiry\)/);
assert.match(script, /if \(!elements\.postConsent\.checked\)/);
assert.match(script, /window\.confirm\("이 탭에 임시저장된 글을 불러올까요/);
assert.match(html, /id="deleteDraftBtn"/);
assert.match(script, /function deleteDraft\(\)[\s\S]*?removeBoardDraft\(\)[\s\S]*?postContact\.value = ""/);
assert.doesNotMatch(script, /localStorage\.setItem\("songak-board-draft"/);
assert.match(script, /\/api\/board\/posts/);
assert.match(script, /\/api\/board\/media/);
assert.match(server, /handleBoardRequest/);
assert.match(server, /BOARD_ADMIN_PASSWORD/);
assert.match(server, /normalizedPath\.startsWith\("songak\/"\)/);
assert.match(server, /isCanonicalPublicRoute/);
assert.match(editor, /label: "소통게시판"/);
assert.match(editor, /new URL\("community-board\.html", window\.location\.href\)/);
assert.match(editor, /window\.location\.assign\(getDeliveryBoardUrl\(\)\)/);
assert.doesNotMatch(editor, /window\.open\(getDeliveryBoardUrl\(\)/);
assert.match(editor, /class="donation-view-only" href="representative-greeting-editor\.html\?mode=view&stylePage=application&type=donation"/);
assert.match(editor, /\.donation-cta-input,\s*\.donation-view-only\s*\{[\s\S]*?min-height:\s*58px/);
assert.doesNotMatch(html, /on(?:click|change|submit)=/i);

console.log("community board page tests OK");
