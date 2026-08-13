import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../outputs/representative-greeting-editor.html", import.meta.url), "utf8");

function sourceBetween(startPattern, endPattern) {
  const start = html.search(startPattern);
  assert.notEqual(start, -1, `missing source start: ${startPattern}`);
  const tail = html.slice(start);
  const relativeEnd = tail.search(endPattern);
  assert.notEqual(relativeEnd, -1, `missing source end: ${endPattern}`);
  return tail.slice(0, relativeEnd);
}

const runtimeSource = sourceBetween(
  /async function fetchRemoteSitePayload\(/,
  /async function readRemoteSiteDocument\(/
);
const scope = "home-menu-intro-main";

function response(payload, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json", ...headers },
  });
}

function canonicalPayload() {
  return {
    key: "songak-homepage",
    scope,
    scopeSectionIds: ["mainIntro", "greeting", "footer"],
    revision: 7,
    content: { document: { globals: {}, sections: {}, sectionOrder: ["mainIntro", "greeting", "footer"] } },
  };
}

function fullPayload(scopeFallback) {
  return {
    key: "songak-homepage",
    scope,
    scopeFallback,
    revision: 7,
    content: { full: true, sectionOrder: Array.from({ length: 43 }, (_, index) => `section-${index + 1}`) },
  };
}

function createRuntime({ scopedPayload = canonicalPayload(), fullDocumentPayload = fullPayload("full"), failScoped = false, bootPrefetch = null } = {}) {
  const requests = [];
  const loads = [];
  const window = {
    location: { protocol: "http:" },
    __songakEditorBoot: {},
    __songakPublicBootScopeRequest: bootPrefetch,
  };
  const context = vm.createContext({
    window,
    performance,
    TextEncoder,
    Response,
    console: { warn() {} },
    encodeURIComponent,
    fetch: async (url) => {
      requests.push(url);
      const requestUrl = new URL(url, "http://fixture.local");
      const requestedScope = requestUrl.searchParams.get("scope");
      if (requestedScope && failScoped) throw new Error("scope network failure");
      return response(requestedScope ? scopedPayload : fullDocumentPayload, { etag: '"fixture"' });
    },
    validatePublicScopedPayload(record, requestedScope) {
      assert.equal(record.payload.scope, requestedScope);
      assert.equal(record.payload.scopeFallback, undefined);
      return { sectionIds: record.payload.scopeSectionIds };
    },
    applyPublicScopedPayload(canonical) {
      return canonical.sectionIds.length > 0;
    },
    StorageManager: {
      load(content) {
        loads.push(content);
        return Boolean(content?.full);
      },
    },
  });
  vm.runInContext(`
    const remoteSiteDocumentKey = "songak-homepage";
    const publicScopeInflight = new Map();
    const publicScopeCache = new Map();
    let remoteSiteRevision = 0;
    let publicNavigationSequence = 0;
    let publicActiveScopeSectionOrder = null;
    let publicFullDocumentMode = false;
    ${runtimeSource}
    globalThis.clearScopeCache = () => publicScopeCache.clear();
  `, context, { filename: "public-scope-runtime.js" });
  return { context, requests, loads, window };
}

{
  const runtime = createRuntime();
  assert.equal(await runtime.context.hydratePublicMenuScope(scope), true);
  assert.deepEqual(runtime.requests, [`/api/site-content/songak-homepage?scope=${scope}`]);
  assert.equal(runtime.loads.length, 0, "canonical scope applies only the scoped renderer payload");
}

{
  const runtime = createRuntime({
    scopedPayload: { key: "songak-homepage", scope, scopeFallback: "unpublished", revision: 0, content: null },
  });
  assert.equal(await runtime.context.hydratePublicMenuScope(scope), false);
  assert.deepEqual(runtime.requests, [`/api/site-content/songak-homepage?scope=${scope}`],
    "unpublished scope must not trigger a redundant full-document read");
  assert.equal(runtime.loads.length, 0);
}

for (const fallback of ["legacy-document", "incomplete-scope"]) {
  const runtime = createRuntime({ scopedPayload: fullPayload(fallback) });
  assert.equal(await runtime.context.hydratePublicMenuScope(scope), true, fallback);
  assert.deepEqual(runtime.requests, [`/api/site-content/songak-homepage?scope=${scope}`],
    `${fallback} must reuse the full document returned by the scoped request`);
  assert.equal(runtime.loads.length, 1, fallback);
  assert.equal(runtime.loads[0].sectionOrder.length, 43, `${fallback} retains the complete section order`);
}

{
  const runtime = createRuntime({ failScoped: true });
  assert.equal(await runtime.context.hydratePublicMenuScope(scope), true);
  assert.deepEqual(runtime.requests, [
    `/api/site-content/songak-homepage?scope=${scope}`,
    "/api/site-content/songak-homepage",
  ], "network failure may use the single complete-document recovery read");
  assert.equal(runtime.loads.length, 1);
}

{
  const prefetchedPayload = canonicalPayload();
  const prefetchedText = JSON.stringify(prefetchedPayload);
  const bootPrefetch = {
    scope,
    consumed: false,
    startedAt: 1,
    readyAt: 2,
    promise: Promise.resolve({ response: response(prefetchedPayload), responseText: prefetchedText }),
  };
  const runtime = createRuntime({ bootPrefetch });
  assert.equal(await runtime.context.hydratePublicMenuScope(scope), true);
  assert.equal(bootPrefetch.consumed, true);
  assert.equal(runtime.requests.length, 0, "first hydration consumes the parser-overlapped request");
  runtime.context.clearScopeCache();
  assert.equal(await runtime.context.hydratePublicMenuScope(scope), true);
  assert.deepEqual(runtime.requests, [`/api/site-content/songak-homepage?scope=${scope}`],
    "second hydration must not replay the boot response");
}

console.log("public scope fallback request tests OK");
