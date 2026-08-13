import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = new URL("../", import.meta.url);
const plain = (value) => JSON.parse(JSON.stringify(value));

async function loadContract() {
  const source = await readFile(new URL("lib/community-editor-contract.ts", root), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
  }).outputText;
  const loadedModule = { exports: {} };
  const sandbox = {
    module: loadedModule,
    exports: loadedModule.exports,
    require(specifier) { throw new Error(`Unexpected import: ${specifier}`); },
    structuredClone,
    JSON,
    Object,
    Set,
    Number,
    String,
    Boolean,
    RegExp,
    Math,
  };
  vm.runInNewContext(output, sandbox, { filename: "lib/community-editor-contract.ts" });
  return loadedModule.exports;
}

test("provides stable community targets and fresh visual-only defaults", async () => {
  const contract = await loadContract();
  const first = contract.createDefaultCommunityEditorSurface();
  const second = contract.createDefaultCommunityEditorSurface();

  assert.equal(first.schemaVersion, 1);
  assert.equal(first.surfaceId, "publishing.page.community-board");
  assert.equal(first.sectionId, "community");
  assert.equal(contract.COMMUNITY_EDITOR_TARGET_IDS.title, "community.intro.title");
  assert.equal(contract.COMMUNITY_EDITOR_TARGET_IDS.primaryCta, "community.intro.primary-cta");
  assert.equal(contract.COMMUNITY_EDITOR_TARGET_IDS.listTitle, "community.list.title");
  assert.equal(contract.COMMUNITY_EDITOR_TARGET_IDS.emptyDescription, "community.list.empty-description");
  assert.equal(new Set(Object.values(contract.COMMUNITY_EDITOR_TARGET_IDS)).size, Object.keys(contract.COMMUNITY_EDITOR_TARGET_IDS).length);
  Object.values(contract.COMMUNITY_EDITOR_TARGET_IDS).forEach((targetId) => {
    assert.equal(contract.isCommunityEditorTargetId(targetId), true);
  });
  assert.equal(contract.isCommunityEditorTargetId("community.post.author"), false);

  first.fields.title = "changed";
  first.textStyles.desktop[contract.COMMUNITY_EDITOR_TARGET_IDS.title].size = 8;
  assert.equal(second.fields.title, "주민의 의견을 듣고 함께 답합니다");
  assert.equal(second.textStyles.desktop[contract.COMMUNITY_EDITOR_TARGET_IDS.title].size, 60);
  assert.equal(second.textStyles.desktop[contract.COMMUNITY_EDITOR_TARGET_IDS.title].background, null);
  assert.equal(second.textStyles.desktop[contract.COMMUNITY_EDITOR_TARGET_IDS.primaryCta].background, "#2f6b49");
  assert.equal(second.textStyles.desktop[contract.COMMUNITY_EDITOR_TARGET_IDS.primaryCta].color, "#ffffff");
  assert.equal(second.textStyles.desktop[contract.COMMUNITY_EDITOR_TARGET_IDS.secondaryCta].background, "#ffffff");
});

test("normalizes the presentation allowlist and discards posts and personal data", async () => {
  const contract = await loadContract();
  const normalized = contract.normalizeCommunityEditorSurface({
    schemaVersion: 999,
    surfaceId: "wrong",
    sectionId: "wrong",
    fields: {
      title: "수정된 소통게시판",
      description: "설명",
      author: "저장되면 안 되는 이름",
      contact: "010-0000-0000",
      password: "secret",
    },
    posts: [{ id: "post-1", author: "개인정보", body: "게시글 본문" }],
    boardPosts: [{ title: "게시글" }],
    personalData: { phone: "010-1111-2222" },
    textStyles: {
      desktop: {
        "community.intro.title": { size: 200, color: "#ABCDEF", background: "javascript:alert(1)", font: "serif", align: "center", boxWidth: 1, boxOffsetX: 999, boxOffsetY: -999 },
        "community.intro.primary-cta": { color: "#010203", background: "#FEDCBA", boxWidth: 72, boxOffsetX: 15, boxOffsetY: -9 },
        "community.post.author": { size: 40 },
      },
    },
    layouts: { phone: { infoColumns: 9, contentWidth: 20 } },
    appearance: { background: "#FFFFFF", accent: "not-a-color", text: "#123456", preset: "custom", decoration: "rings" },
    background: { mode: "image", imageDataUrl: "javascript:alert(1)", opacity: 999 },
    pageDecorations: {
      cards: [{ author: "should not survive" }],
      decorations: [{ id: "unsafe", icon: "heart", layouts: { desktop: { x: 500, y: -1 } } }],
    },
  });
  const serialized = JSON.stringify(normalized);

  assert.equal(normalized.schemaVersion, 1);
  assert.equal(normalized.surfaceId, "publishing.page.community-board");
  assert.equal(normalized.sectionId, "community");
  assert.equal(normalized.fields.title, "수정된 소통게시판");
  assert.equal(normalized.fields.primaryCta, "주민 글쓰기");
  assert.equal(normalized.textStyles.desktop["community.intro.title"].size, 96);
  assert.equal(normalized.textStyles.desktop["community.intro.title"].color, "#abcdef");
  assert.equal(normalized.textStyles.desktop["community.intro.title"].background, null);
  assert.equal(normalized.textStyles.desktop["community.intro.title"].boxWidth, 30);
  assert.equal(normalized.textStyles.desktop["community.intro.title"].boxOffsetX, 320);
  assert.equal(normalized.textStyles.desktop["community.intro.title"].boxOffsetY, -320);
  assert.equal(normalized.textStyles.desktop["community.intro.primary-cta"].background, "#fedcba");
  assert.equal(normalized.textStyles.desktop["community.intro.primary-cta"].color, "#010203");
  assert.equal(normalized.textStyles.desktop["community.intro.primary-cta"].boxWidth, 72);
  assert.equal("community.post.author" in normalized.textStyles.desktop, false);
  assert.equal(normalized.layouts.phone.infoColumns, 3);
  assert.equal(normalized.layouts.phone.contentWidth, 60);
  assert.equal(normalized.appearance.accent, "#2c7158");
  assert.equal(normalized.background.mode, "default");
  assert.equal(normalized.background.imageDataUrl, null);
  assert.equal(normalized.background.opacity, 100);
  assert.deepEqual(plain(normalized.pageDecorations.cards), []);
  assert.equal(normalized.pageDecorations.decorations[0].id, "community-decoration-1");
  for (const forbidden of ["posts", "boardPosts", "personalData", "author", "contact", "password", "010-0000-0000", "게시글 본문"]) {
    assert.equal(serialized.includes(forbidden), false, `${forbidden} must not enter the site-content visual contract`);
  }
});

test("reads and writes document.globals.externalSurfaces.community without replacing sibling globals", async () => {
  const contract = await loadContract();
  const globals = {
    theme: { accent: "#356b55" },
    externalSurfaces: { anotherSurface: { version: 7 } },
  };
  const updated = contract.withCommunityEditorSurface(globals, { fields: { title: "소통 공간" } });
  const document = { globals: updated };
  const read = contract.readCommunityEditorSurface(document);

  assert.deepEqual(plain(updated.theme), globals.theme);
  assert.deepEqual(plain(updated.externalSurfaces.anotherSurface), { version: 7 });
  assert.equal(updated.externalSurfaces.community.fields.title, "소통 공간");
  assert.equal(read.fields.title, "소통 공간");
  assert.equal("externalSurfaces" in globals, true, "the helper must not mutate the original globals object");
  assert.equal("community" in globals.externalSurfaces, false);
});

test("accepts only nonce-bound, versioned, allowlisted editor bridge messages", async () => {
  const contract = await loadContract();
  const nonce = "community-test-nonce-2026";
  const ready = contract.createCommunityEditorReadyMessage(nonce);
  const select = contract.createCommunityEditorSelectMessage(
    nonce,
    contract.COMMUNITY_EDITOR_TARGET_IDS.title,
    { x: 10, y: 20, width: 300, height: 60 },
  );
  const state = contract.createCommunityEditorStateMessage(nonce, { fields: { title: "새 제목" }, posts: [{ author: "비공개작성자이름" }] }, 3);
  const change = contract.createCommunityEditorChangeMessage(nonce, state.state, 4);
  const apply = contract.createCommunityEditorApplyMessage(nonce, state.state, 5);

  assert.equal(contract.isCommunityEditorReadyMessage(ready), true);
  assert.equal(contract.isCommunityEditorSelectMessage(select), true);
  assert.equal(contract.isCommunityEditorStateMessage(state), true);
  assert.equal(contract.isCommunityEditorChangeMessage(change), true);
  assert.equal(contract.isCommunityEditorApplyMessage(apply), true);
  assert.equal(contract.isCommunityEditorMessage(ready), true);
  assert.equal(contract.isCommunityEditorMessage(select), true);
  assert.equal(contract.isCommunityEditorMessage(state), true);
  assert.equal(contract.isCommunityEditorMessage(change), true);
  assert.equal(contract.isCommunityEditorMessage(apply), true);
  assert.equal(JSON.stringify(state).includes("비공개작성자이름"), false);

  assert.equal(contract.isCommunityEditorMessage({ ...ready, nonce: "short" }), false);
  assert.equal(contract.isCommunityEditorMessage({ ...ready, channel: "other" }), false);
  assert.equal(contract.isCommunityEditorMessage({ ...ready, extra: true }), false);
  assert.equal(contract.isCommunityEditorMessage({ ...select, targetId: "community.post.author" }), false);
  assert.equal(contract.isCommunityEditorMessage({ ...select, rect: { x: 0, y: 0, width: -1, height: 10 } }), false);
  assert.equal(contract.isCommunityEditorMessage({ ...state, revision: -1 }), false);
  assert.equal(contract.isCommunityEditorMessage({ ...state, state: { ...state.state, posts: [] } }), false);
  assert.equal(contract.isCommunityEditorMessage({ ...state, state: { ...state.state, fields: { ...state.state.fields, contact: "secret" } } }), false);
});
