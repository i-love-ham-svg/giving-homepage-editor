import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = new URL("../", import.meta.url);
const clone = (value) => value == null ? value : structuredClone(value);

class FakeStatement {
  constructor(database, sql, values = []) {
    this.database = database;
    this.sql = sql;
    this.values = values;
  }

  bind(...values) { return new FakeStatement(this.database, this.sql, values); }
  first() { return this.database.first(this.sql, this.values); }
  all() { return this.database.all(this.sql, this.values); }
  run() { return this.database.run(this.sql, this.values); }
}

class FakeBoardDatabase {
  constructor({ post, media }) {
    this.posts = new Map([[post.id, clone(post)]]);
    this.media = new Map(media.map((item) => [item.id, clone(item)]));
  }

  prepare(sql) { return new FakeStatement(this, sql); }

  async batch(statements) {
    const results = [];
    for (const statement of statements) results.push(await statement.run());
    return results;
  }

  async first(sql, values) {
    const query = sql.replace(/\s+/g, " ").trim();
    if (/SELECT \* FROM posts WHERE id = \?/.test(query)) {
      const post = this.posts.get(String(values[0]));
      if (!post || (query.includes("status != 'deleted'") && post.status === "deleted")) return null;
      return clone(post);
    }
    if (/FROM media WHERE id = \?/.test(query)) return clone(this.media.get(String(values[0])) || null);
    throw new Error(`Unexpected first SQL: ${query}`);
  }

  async all(sql, values) {
    const query = sql.replace(/\s+/g, " ").trim();
    if (query.includes("WHERE post_id = ? AND status IN ('attached', 'pending_delete')")) {
      return { results: [...this.media.values()]
        .filter((item) => item.post_id === values[0] && ["attached", "pending_delete"].includes(item.status))
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map(clone) };
    }
    if (query.includes("WHERE status = 'attached' AND post_id IN")) {
      const postIds = new Set(values.map(String));
      return { results: [...this.media.values()]
        .filter((item) => item.status === "attached" && postIds.has(String(item.post_id)))
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map(clone) };
    }
    throw new Error(`Unexpected all SQL: ${query}`);
  }

  async run(sql, values) {
    const query = sql.replace(/\s+/g, " ").trim();
    if (/^(CREATE|INSERT OR IGNORE|PRAGMA)/.test(query)) return { meta: { changes: 0 } };
    if (query.startsWith("INSERT INTO audit_logs")) return { meta: { changes: 1 } };

    if (query.startsWith("UPDATE posts SET category")) {
      const [category, status, title, body, author, contact, pinned, thumbnail, updatedAt, , postId] = values;
      const post = this.posts.get(String(postId));
      if (!post) return { meta: { changes: 0 } };
      Object.assign(post, {
        category, status, title, body, author, contact, pinned,
        thumbnail_media_id: thumbnail,
        updated_at: updatedAt,
        published_at: status === "pending" ? null : post.published_at,
      });
      return { meta: { changes: 1 } };
    }

    if (query.startsWith("UPDATE media SET post_id = ?, status = 'attached'")) {
      const [postId, alt, mediaId, ownerTokenHash] = values;
      const media = this.media.get(String(mediaId));
      if (!media || media.status !== "temporary" || media.owner_token_hash !== ownerTokenHash) return { meta: { changes: 0 } };
      Object.assign(media, { post_id: postId, status: "attached", alt_text: alt });
      return { meta: { changes: 1 } };
    }
    if (query.startsWith("UPDATE media SET alt_text")) {
      const [alt, mediaId, postId] = values;
      const media = this.media.get(String(mediaId));
      if (!media || media.post_id !== postId || media.status !== "attached") return { meta: { changes: 0 } };
      media.alt_text = alt;
      return { meta: { changes: 1 } };
    }
    if (query.startsWith("UPDATE media SET status = 'pending_delete'") && query.includes("post_id = ?")) {
      const [mediaId, postId] = values;
      const media = this.media.get(String(mediaId));
      if (!media || media.post_id !== postId || !["attached", "pending_delete"].includes(media.status)) return { meta: { changes: 0 } };
      media.status = "pending_delete";
      return { meta: { changes: 1 } };
    }
    if (query.startsWith("UPDATE media SET status = 'pending_delete'") && query.includes("post_id IS NULL")) {
      const [mediaId, ownerTokenHash] = values;
      const media = this.media.get(String(mediaId));
      if (!media || media.post_id != null || !["temporary", "pending_delete"].includes(media.status) || media.owner_token_hash !== ownerTokenHash) return { meta: { changes: 0 } };
      media.status = "pending_delete";
      return { meta: { changes: 1 } };
    }
    if (query.startsWith("UPDATE media SET post_id = NULL, status = 'deleted'")) {
      const media = this.media.get(String(values[0]));
      if (!media || !["pending_delete", "deleted"].includes(media.status)) return { meta: { changes: 0 } };
      Object.assign(media, { post_id: null, status: "deleted" });
      return { meta: { changes: 1 } };
    }
    throw new Error(`Unexpected run SQL: ${query}`);
  }
}

function fixturePost(overrides = {}) {
  return {
    id: "post-1", category: "resident", status: "published", title: "기존 게시글", body: "기존 게시글의 충분한 본문입니다.",
    author: "작성자", contact: "", password_salt: "", password_hash: "", thumbnail_media_id: "old-1", pinned: 0,
    official: 0, views: 0, report_count: 0, share_count: 0, moderation_note: "", created_at: "2026-08-11T00:00:00.000Z",
    updated_at: "2026-08-11T00:00:00.000Z", published_at: "2026-08-11T00:00:00.000Z", deleted_at: null,
    ...overrides,
  };
}

function fixtureMedia(id, overrides = {}) {
  return {
    id, post_id: "post-1", object_key: `board/${id}.jpg`, kind: "image", content_type: "image/jpeg",
    original_name: `${id}.jpg`, byte_size: 100, alt_text: "기존 설명", owner_token_hash: "owner", status: "attached",
    created_at: `2026-08-11T00:00:0${id === "old-1" ? 1 : 2}.000Z`,
    ...overrides,
  };
}

async function loadBoardServer(database, deletedObjects) {
  const source = await readFile(new URL("lib/board-server.ts", root), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const runtime = {
    DB: database,
    MEDIA: { async delete(key) { deletedObjects.push(key); } },
    BOARD_EDITOR_EMAILS: "admin@example.test",
    BOARD_HASH_PEPPER: "test-board-hash-pepper",
    BOARD_SESSION_SECRET: "test-session-secret",
  };
  const loadedModule = { exports: {} };
  const sandbox = {
    module: loadedModule,
    exports: loadedModule.exports,
    require(specifier) {
      if (specifier === "cloudflare:workers") return { env: runtime };
      if (specifier === "./board-types") return {
        CATEGORIES: [
          { id: "notice", adminOnly: true }, { id: "welfare", adminOnly: true },
          { id: "resident", adminOnly: false }, { id: "question", adminOnly: false },
        ],
        STATUSES: ["pending", "published", "rejected", "hidden", "deleted"],
      };
      throw new Error(`Unexpected import: ${specifier}`);
    },
    Buffer, URL, Request, Response, Headers, TextEncoder, TextDecoder, Uint8Array, structuredClone, crypto, console,
  };
  vm.runInNewContext(output, sandbox, { filename: "lib/board-server.ts" });
  return loadedModule.exports;
}

test("PATCH attaches uploads, removes omitted media, updates alt text and changes the thumbnail", async () => {
  const deletedObjects = [];
  const database = new FakeBoardDatabase({
    post: fixturePost(),
    media: [
      fixtureMedia("old-1"),
      fixtureMedia("old-2"),
      fixtureMedia("new-1", { post_id: null, status: "temporary", owner_token_hash: "new-owner", alt_text: "" }),
      fixtureMedia("discard-1", { post_id: null, status: "temporary", owner_token_hash: "discard-owner", alt_text: "" }),
    ],
  });
  const server = await loadBoardServer(database, deletedObjects);
  database.media.get("new-1").owner_token_hash = await server.hashClaimToken("new-claim");
  database.media.get("discard-1").owner_token_hash = await server.hashClaimToken("discard-claim");

  const request = new Request("https://example.test/api/board/posts/post-1", {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "oai-authenticated-user-email": "admin@example.test",
      "oai-authenticated-user-id": "admin-1",
    },
    body: JSON.stringify({
      title: "수정한 게시글", body: "수정한 게시글의 충분한 본문입니다.", author: "담당자", category: "welfare",
      media: [
        { id: "old-1", alt: "수정한 기존 사진 설명" },
        { id: "new-1", claimToken: "new-claim", alt: "새 사진 설명" },
      ],
      discardedMedia: [{ id: "discard-1", claimToken: "discard-claim" }],
      thumbnailMediaId: "new-1",
    }),
  });
  const result = await server.updatePost(request, "post-1");

  assert.equal(result.thumbnailMediaId, "new-1");
  assert.deepEqual(JSON.parse(JSON.stringify(result.media.map((item) => [item.id, item.alt]))), [
    ["old-1", "수정한 기존 사진 설명"], ["new-1", "새 사진 설명"],
  ]);
  assert.deepEqual(
    { status: database.media.get("new-1").status, postId: database.media.get("new-1").post_id },
    { status: "attached", postId: "post-1" },
  );
  assert.equal(database.media.get("old-2").status, "deleted");
  assert.equal(database.media.get("discard-1").status, "deleted");
  assert.deepEqual(deletedObjects.sort(), ["board/discard-1.jpg", "board/old-2.jpg"]);
});

test("PATCH rejects a new upload with the wrong claim before changing the post or media", async () => {
  const deletedObjects = [];
  const database = new FakeBoardDatabase({
    post: fixturePost(),
    media: [
      fixtureMedia("old-1"),
      fixtureMedia("new-1", { post_id: null, status: "temporary", owner_token_hash: "placeholder", alt_text: "" }),
    ],
  });
  const server = await loadBoardServer(database, deletedObjects);
  const password = await server.createVisitorPassword("visitor-secret");
  Object.assign(database.posts.get("post-1"), { password_salt: password.salt, password_hash: password.hash });
  database.media.get("new-1").owner_token_hash = await server.hashClaimToken("correct-claim");
  const beforePost = clone(database.posts.get("post-1"));
  const beforeMedia = clone([...database.media.values()]);

  const request = new Request("https://example.test/api/board/posts/post-1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      password: "visitor-secret", title: "수정한 게시글", body: "수정한 게시글의 충분한 본문입니다.", author: "작성자",
      category: "resident", media: [{ id: "old-1" }, { id: "new-1", claimToken: "wrong-claim" }], thumbnailMediaId: "new-1",
    }),
  });

  await assert.rejects(() => server.updatePost(request, "post-1"), /첨부파일 소유 정보를 확인/);
  assert.deepEqual(database.posts.get("post-1"), beforePost);
  assert.deepEqual([...database.media.values()], beforeMedia);
  assert.deepEqual(deletedObjects, []);
});

test("the edit UI can remove existing attachments and submits discarded temporary claims", async () => {
  const client = await readFile(new URL("app/board-app.tsx", root), "utf8");
  assert.match(client, /function removeDraftMedia\(item: BoardMedia\)/);
  assert.match(client, /onClick=\{\(\) => removeDraftMedia\(item\)\}>삭제<\/button>/);
  assert.match(client, /discardedMedia: discardedDraftMedia\.map/);
  assert.doesNotMatch(client, /\{item\.claimToken && <button[^>]+>삭제<\/button>\}/);
});
