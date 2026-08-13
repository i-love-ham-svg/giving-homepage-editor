import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const root = new URL("../", import.meta.url);

const plain = (value) => JSON.parse(JSON.stringify(value));

function json(data, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

async function loadCommunityEditorContractModule() {
  const source = await readFile(new URL("lib/community-editor-contract.ts", root), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
  }).outputText;
  const loadedModule = { exports: {} };
  vm.runInNewContext(output, {
    module: loadedModule,
    exports: loadedModule.exports,
    structuredClone,
    console,
  }, { filename: "lib/community-editor-contract.ts" });
  return loadedModule.exports;
}

async function loadSiteContentModule(row, { versionRow = null } = {}) {
  const communityEditorContract = await loadCommunityEditorContractModule();
  const source = await readFile(new URL("lib/site-content-server.ts", root), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
  }).outputText;
  const statements = [];
  const database = {
    batch: async () => [],
    prepare(sql) {
      return {
        args: [],
        bind(...args) { this.args = args; return this; },
        async first() {
          if (/SELECT content_json FROM site_versions/i.test(sql)) return versionRow;
          return row;
        },
        async run() {
          statements.push({ sql, args: [...this.args] });
          return { meta: { changes: 1 } };
        },
        async all() { return { results: [] }; },
      };
    },
  };
  const loadedModule = { exports: {} };
  const sandbox = {
    module: loadedModule,
    exports: loadedModule.exports,
    require(specifier) {
      if (specifier === "cloudflare:workers") return { env: { DB: database } };
      if (specifier === "./board-server") {
        return { assertSameOrigin() {}, isAdminRequest: async () => true, json };
      }
      if (specifier === "./community-editor-contract") return communityEditorContract;
      throw new Error(`Unexpected import: ${specifier}`);
    },
    URL,
    Request,
    Response,
    Headers,
    TextEncoder,
    structuredClone,
    crypto,
    console,
  };
  vm.runInNewContext(output, sandbox, { filename: "lib/site-content-server.ts" });
  Object.defineProperty(loadedModule.exports, "__statements", { value: statements });
  return loadedModule.exports;
}

function pollutedCommunitySurface() {
  return {
    schemaVersion: 999,
    surfaceId: "legacy-board-with-posts",
    fields: {
      title: "안전한 소통 공간",
      description: "표시 가능한 소개 문구",
      authorEmail: "resident@example.test",
    },
    posts: [{ id: "post-1", author: "홍길동", phone: "010-1234-5678", body: "비공개 문의" }],
    moderation: { reviewerEmail: "staff@example.test", internalMemo: "비공개 메모" },
    layouts: {
      desktop: { contentWidth: 999, infoColumns: 99, residentPhone: "010-9999-9999" },
      attackerViewport: { contentWidth: 1 },
    },
    background: {
      mode: "image",
      imageDataUrl: "javascript:alert(1)",
      residentPhone: "010-7777-7777",
      layouts: { desktop: { imageX: 9999, residentEmail: "hidden@example.test" } },
    },
    pageDecorations: {
      cards: [{ author: "홍길동", phone: "010-1111-2222" }],
      decorations: [{
        id: "community-decoration-1",
        icon: "heart",
        style: "plain",
        color: "#112233",
        layer: "front",
        layouts: { desktop: { x: 20, y: 30, residentEmail: "private@example.test" } },
        sizes: { desktop: 50 },
        post: { author: "홍길동" },
      }],
      nextDecorationId: 2,
      moderationQueue: [{ phone: "010-0000-0000" }],
    },
    unknownRoot: { residentName: "홍길동" },
  };
}

function publishedFixture() {
  return {
    schemaVersion: 5,
    savedAt: "2026-08-11T00:00:00.000Z",
    layouts: { desktop: { introTitle: { x: 1 }, otherTitle: { x: 2 }, footerTitle: { x: 3 } } },
    textStyles: { desktop: { introTitle: { size: 40 }, otherTitle: { size: 30 } } },
    assets: { backgroundMode: "default" },
    content: {
      detailPresentationVersion: 2,
      hiddenSections: { intro: false, other: true, footer: false },
      mainIntroSections: [{ sectionId: "intro", content: { duplicate: true } }],
      essentialSections: [{ sectionId: "footer", content: { duplicate: true } }],
      pageDecorationModel: { cards: [], decorations: [], nextDecorationId: 1 },
    },
    document: {
      schemaVersion: 5,
      activeSectionId: "other",
      sectionOrder: ["intro", "other", "footer"],
      sections: [
        { id: "intro", type: "mainIntro", content: { title: "Intro" }, layouts: { desktop: { introTitle: { x: 1 } } }, textStyles: { desktop: { introTitle: { size: 40 } } } },
        { id: "other", type: "essential", content: { title: "Other" }, layouts: { desktop: { otherTitle: { x: 2 } } }, textStyles: { desktop: { otherTitle: { size: 30 } } } },
        { id: "footer", type: "essential", content: { title: "Footer", documents: { privacy: "Policy" } }, layouts: { desktop: { footerTitle: { x: 3 } } }, textStyles: { desktop: { footerTitle: { size: 16 } } } },
      ],
      globals: {
        theme: { accent: "#356b55" },
        background: { mode: "default" },
        externalSurfaces: { community: { schemaVersion: 1, fields: { title: "소통 공간" } } },
        homeMenu: {
          brand: "Songak",
          items: [
            { id: "home-menu-about", sectionId: "intro", sectionIds: ["intro"], children: [] },
            { id: "home-menu-news", sectionId: "other", sectionIds: ["other"], children: [] },
          ],
        },
        sectionAppearances: { intro: { preset: "soft" }, other: { preset: "plain" }, footer: { preset: "dark" } },
      },
    },
    storage: { imagesOmitted: false },
  };
}

function databaseRow(published, draft = { draftOnly: true }) {
  return {
    key: "songak-homepage",
    draft_json: JSON.stringify(draft),
    published_json: JSON.stringify(published),
    revision: 12,
    updated_by: "editor@example.test",
    updated_at: "2026-08-11T00:00:00.000Z",
    published_at: "2026-08-11T00:00:00.000Z",
  };
}

test("scopes a canonical public snapshot to linked sections plus footer without mutating the source", async () => {
  const original = publishedFixture();
  const before = structuredClone(original);
  const { scopePublishedSiteContent } = await loadSiteContentModule(databaseRow(original));
  const scoped = scopePublishedSiteContent(original, "home-menu-about");

  assert.equal(scoped.scope, "home-menu-about");
  assert.equal(scoped.fallback, null);
  assert.deepEqual(plain(scoped.sectionIds), ["intro", "footer"]);
  assert.deepEqual(plain(scoped.content.document.sectionOrder), ["intro", "footer"]);
  assert.deepEqual(plain(scoped.content.document.sections.map((section) => section.id)), ["intro", "footer"]);
  assert.equal(scoped.content.document.activeSectionId, "intro");
  assert.equal(scoped.content.document.globals.homeMenu.items.length, 2, "the full navigation tree remains available");
  assert.equal(scoped.content.document.globals.externalSurfaces.community.fields.title, "소통 공간");
  assert.deepEqual(plain(Object.keys(scoped.content.document.globals.sectionAppearances)), ["intro", "footer"]);
  assert.deepEqual(plain(scoped.content.layouts), {});
  assert.deepEqual(plain(scoped.content.textStyles), {});
  assert.equal("mainIntroSections" in scoped.content.content, false);
  assert.equal("essentialSections" in scoped.content.content, false);
  assert.deepEqual(plain(scoped.content.content.hiddenSections), { intro: false, footer: false });
  assert.deepEqual(original, before, "scoping must not change the stored published snapshot");
});

test("normalizes legacy community payloads to the visual allowlist while preserving sibling globals", async () => {
  const original = publishedFixture();
  original.document.globals.externalSurfaces.community = pollutedCommunitySurface();
  original.document.globals.externalSurfaces.gallery = {
    schemaVersion: 3,
    privateEditorMetadata: { untouched: true },
  };
  const before = structuredClone(original);
  const { normalizeSiteContentExternalSurfaces, scopePublishedSiteContent } = await loadSiteContentModule(databaseRow(original));

  const normalized = normalizeSiteContentExternalSurfaces(original);
  const surface = normalized.document.globals.externalSurfaces.community;
  assert.equal(surface.fields.title, "안전한 소통 공간");
  assert.equal(surface.fields.description, "표시 가능한 소개 문구");
  assert.equal("authorEmail" in surface.fields, false);
  assert.equal("posts" in surface, false);
  assert.equal("moderation" in surface, false);
  assert.equal("unknownRoot" in surface, false);
  assert.equal("residentPhone" in surface.background, false);
  assert.equal(surface.background.imageDataUrl, null);
  assert.deepEqual(plain(surface.pageDecorations.cards), []);
  assert.equal("post" in surface.pageDecorations.decorations[0], false);
  assert.equal("residentEmail" in surface.pageDecorations.decorations[0].layouts.desktop, false);
  assert.equal(surface.layouts.desktop.contentWidth, 100, "visual values are clamped by the typed contract");
  assert.equal("attackerViewport" in surface.layouts, false);
  assert.deepEqual(
    plain(normalized.document.globals.externalSurfaces.gallery),
    { schemaVersion: 3, privateEditorMetadata: { untouched: true } },
    "other external surfaces remain unchanged",
  );
  assert.deepEqual(plain(normalized.document.globals.theme), { accent: "#356b55" });
  assert.deepEqual(original, before, "server normalization must not mutate its input");

  const scoped = scopePublishedSiteContent(original, "home-menu-about");
  assert.equal("posts" in scoped.content.document.globals.externalSurfaces.community, false);
  assert.deepEqual(
    plain(scoped.content.document.globals.externalSurfaces.gallery),
    { schemaVersion: 3, privateEditorMetadata: { untouched: true } },
  );
});

test("public reads and persistence boundaries remove board data from polluted legacy community snapshots", async () => {
  const polluted = publishedFixture();
  polluted.document.globals.externalSurfaces.community = pollutedCommunitySurface();
  const row = databaseRow(polluted, polluted);
  const loaded = await loadSiteContentModule(row, {
    versionRow: { content_json: JSON.stringify(polluted) },
  });

  const publicResponse = await loaded.getSiteContent(
    new Request("https://example.test/api/site-content/songak-homepage"),
    "songak-homepage",
  );
  const publicSurface = (await publicResponse.json()).content.document.globals.externalSurfaces.community;
  assert.equal("posts" in publicSurface, false);
  assert.equal("moderation" in publicSurface, false);

  await loaded.saveSiteDraft(new Request("https://example.test/api/site-content/songak-homepage", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content: polluted, expectedRevision: 12 }),
  }), "songak-homepage");
  const draftUpdate = loaded.__statements.find(({ sql }) => /UPDATE site_documents\s+SET draft_json/i.test(sql));
  const savedDraft = JSON.parse(draftUpdate.args[0]);
  assert.equal("posts" in savedDraft.document.globals.externalSurfaces.community, false);

  await loaded.publishSiteContent(new Request("https://example.test/api/site-content/songak-homepage", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ expectedRevision: 12 }),
  }), "songak-homepage");
  const publishedUpdate = loaded.__statements.find(({ sql }) => /SET draft_json = \?, published_json = \?/i.test(sql));
  const publishedDraft = JSON.parse(publishedUpdate.args[0]);
  const publishedPublic = JSON.parse(publishedUpdate.args[1]);
  assert.equal("posts" in publishedDraft.document.globals.externalSurfaces.community, false);
  assert.equal("posts" in publishedPublic.document.globals.externalSurfaces.community, false);

  const restoredResponse = await loaded.restoreSiteVersion(new Request("https://example.test/api/site-content/songak-homepage/versions/version-1", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ expectedRevision: 12 }),
  }), "songak-homepage", "version-1");
  const restored = (await restoredResponse.json()).content;
  assert.equal("posts" in restored.document.globals.externalSurfaces.community, false);
});

test("defines safe errors and full fallback behavior for invalid or non-canonical scopes", async () => {
  const original = publishedFixture();
  const { readPublicContentScope, scopePublishedSiteContent, SiteContentError } = await loadSiteContentModule(databaseRow(original));

  assert.equal(readPublicContentScope(new URL("https://example.test/api/site-content/songak-homepage")), null);
  assert.equal(readPublicContentScope(new URL("https://example.test/api/site-content/songak-homepage?scope=%20HOME-MENU-ABOUT%20")), "home-menu-about");
  assert.throws(
    () => readPublicContentScope(new URL("https://example.test/api/site-content/songak-homepage?scope=about")),
    (error) => error instanceof SiteContentError && error.status === 400,
  );
  assert.throws(
    () => readPublicContentScope(new URL("https://example.test/api/site-content/songak-homepage?scope=home-menu-about&scope=home-menu-news")),
    (error) => error instanceof SiteContentError && error.status === 400,
  );
  assert.throws(
    () => scopePublishedSiteContent(original, "home-menu-missing"),
    (error) => error instanceof SiteContentError && error.status === 404,
  );

  const legacy = { schemaVersion: 3, content: { title: "legacy" } };
  const legacyResult = scopePublishedSiteContent(legacy, "home-menu-about");
  assert.equal(legacyResult.fallback, "legacy-document");
  assert.equal(legacyResult.content, legacy);

  const incomplete = publishedFixture();
  incomplete.document.sections = incomplete.document.sections.filter((section) => section.id !== "footer");
  const incompleteResult = scopePublishedSiteContent(incomplete, "home-menu-about");
  assert.equal(incompleteResult.fallback, "incomplete-scope");
  assert.notEqual(incompleteResult.content, incomplete, "fallback content is still defensively normalized");
  assert.deepEqual(plain(incompleteResult.content.document.sections), incomplete.document.sections);
  assert.equal(incompleteResult.content.document.globals.externalSurfaces.community.fields.title, "소통 공간");
});

test("public GET returns scoped ETags while draft GET remains a complete document", async () => {
  const published = publishedFixture();
  const draft = { draftOnly: true, document: { sections: ["all"] } };
  const { getSiteContent } = await loadSiteContentModule(databaseRow(published, draft));

  const aboutResponse = await getSiteContent(new Request("https://example.test/api/site-content/songak-homepage?scope=home-menu-about"), "songak-homepage");
  const about = await aboutResponse.json();
  assert.equal(aboutResponse.status, 200);
  assert.equal(aboutResponse.headers.get("x-site-content-scope"), "home-menu-about");
  assert.deepEqual(plain(about.scopeSectionIds), ["intro", "footer"]);
  assert.deepEqual(plain(about.content.document.sections.map((section) => section.id)), ["intro", "footer"]);

  const newsResponse = await getSiteContent(new Request("https://example.test/api/site-content/songak-homepage?scope=home-menu-news"), "songak-homepage");
  assert.notEqual(newsResponse.headers.get("etag"), aboutResponse.headers.get("etag"), "each scope has a distinct validator");

  const notModified = await getSiteContent(new Request("https://example.test/api/site-content/songak-homepage?scope=home-menu-about", {
    headers: { "if-none-match": aboutResponse.headers.get("etag") },
  }), "songak-homepage");
  assert.equal(notModified.status, 304);
  assert.equal(notModified.headers.get("x-site-content-scope"), "home-menu-about");

  const fullResponse = await getSiteContent(new Request("https://example.test/api/site-content/songak-homepage"), "songak-homepage");
  const full = (await fullResponse.json()).content;
  assert.equal(full.document.globals.externalSurfaces.community.fields.title, "소통 공간");
  assert.equal("posts" in full.document.globals.externalSurfaces.community, false);
  assert.deepEqual(plain(full.document.sections), published.document.sections);

  const draftResponse = await getSiteContent(new Request("https://example.test/api/site-content/songak-homepage?mode=draft&scope=not-a-valid-public-scope"), "songak-homepage");
  assert.deepEqual((await draftResponse.json()).content, draft, "scope is ignored for authenticated draft/edit reads");
});
