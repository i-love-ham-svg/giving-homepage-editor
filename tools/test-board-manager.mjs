import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// ARCHIVED LEGACY FIXTURE: excluded from tools/test-all.mjs. The supported
// community board lives in delivery-site and must not depend on this manager.

const source = readFileSync(new URL("../outputs/editor-board-manager.js", import.meta.url), "utf8");
const context = { globalThis: {}, URL };
vm.createContext(context);
vm.runInContext(source, context);
const board = context.globalThis.SongakBoardManager;

assert.equal(board.CATEGORIES.length, 4);
assert.equal(board.getCategory("notice").adminOnly, true);
assert.equal(board.validateDraft({ category: "notice", title: "공지", body: "충분한 공지 내용입니다.", author: "관리자", password: "1234" }).ok, false);
assert.equal(board.validateDraft({ category: "notice", title: "공지", body: "충분한 공지 내용입니다.", author: "관리자" }, { isAdmin: true }).ok, true);
assert.equal(board.validateDraft({ category: "resident", title: "주민 소식", body: "함께 나누는 충분한 주민 이야기입니다.", author: "주민", password: "1234" }).ok, true);
assert.equal(board.validateDraft({ category: "resident", title: "주민 소식", body: "짧음", author: "주민", password: "1234" }).ok, false);

const posts = [
  { id: "1", category: "resident", status: "published", title: "산책 소식", body: "동네 산책 이야기", author: "주민", views: 3, createdAt: "2026-01-01" },
  { id: "2", category: "notice", status: "published", title: "중요 공지", body: "복지관 운영 공지", author: "복지관", views: 30, pinned: true, createdAt: "2026-01-02" }
];
assert.equal(board.filterPosts(posts, { category: "resident" }).length, 1);
assert.equal(board.filterPosts(posts, { search: "산책" })[0].id, "1");
assert.equal(board.sortPosts(posts, "views")[0].id, "2");
assert.equal(board.createShareUrl("https://example.com/board", "post-1"), "https://example.com/board?post=post-1");
assert.equal(board.getThumbnail({ ...posts[0], media: [{ type: "image/jpeg", url: "/image.jpg" }] }).url, "/image.jpg");

console.log("board manager tests OK");
