import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BoardStore } from "./board-store.mjs";

// ARCHIVED LEGACY FIXTURE: excluded from tools/test-all.mjs. The supported
// community board uses delivery-site D1/R2 storage, not this local file store.

const store = new BoardStore({ dataDir: mkdtempSync(join(tmpdir(), "songak-board-test-")), adminKey: "admin-secret" });
const created = store.create({
  category: "resident",
  title: "주민 게시글",
  body: "공개 전 검수가 필요한 충분한 게시글 내용입니다.",
  author: "테스트 주민",
  password: "4321"
});
assert.equal(created.status, "pending");
assert.equal(store.list({ status: "pending" }).items.some((post) => post.id === created.id), false);
assert.equal(store.list({ status: "pending" }, "admin-secret").items.some((post) => post.id === created.id), true);
assert.equal(store.list({ status: "pending" }, "wrong-key").admin, false);
assert.throws(() => store.update(created.id, { title: "변경 제목" }, { password: "wrong" }), /비밀번호/);
assert.equal(store.update(created.id, { title: "변경 제목" }, { password: "4321" }).title, "변경 제목");
assert.equal(store.moderate(created.id, "published", "admin-secret").status, "published");
assert.equal(store.get(created.id, "", true).views, 1);
assert.equal(store.report(created.id).reports, 1);

const official = store.create({ category: "notice", title: "공식 공지", body: "관리자가 작성하는 공식 공지 내용입니다.", author: "송악사회복지관" }, "admin-secret");
assert.equal(official.status, "published");
assert.throws(() => store.create({ category: "notice", title: "잘못된 공지", body: "방문자가 작성할 수 없는 공식 공지입니다.", author: "방문자", password: "1234" }), /관리자/);

const media = store.saveMedia(Buffer.from([0xff, 0xd8, 0xff, 0xd9]), { type: "image/jpeg", name: "사진.jpg" });
assert.equal(media.kind, "image");
assert.ok(store.resolveMedia(media.id)?.filePath);
assert.equal(store.remove(created.id, { password: "4321" }), true);
assert.equal(store.get(created.id), null);

console.log("board store tests OK");
