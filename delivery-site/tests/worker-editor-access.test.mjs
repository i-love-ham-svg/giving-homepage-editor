import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const root = new URL("../", import.meta.url);

async function loadWorkerModule() {
  const source = await readFile(new URL("worker/index.ts", root), "utf8");
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
    require(specifier) {
      if (specifier === "vinext/server/image-optimization") {
        return { handleImageOptimization() {}, DEFAULT_DEVICE_SIZES: [], DEFAULT_IMAGE_SIZES: [] };
      }
      if (specifier === "vinext/server/app-router-entry") return { fetch() {} };
      throw new Error(`Unexpected import: ${specifier}`);
    },
    URL,
    Request,
    Response,
    TextEncoder,
    console,
  };
  vm.runInNewContext(output, sandbox, { filename: "worker/index.ts" });
  return loadedModule.exports;
}

test("direct editor anonymous access is fail-closed across role aliases and duplicate parameters", async () => {
  const { isAnonymousPublicEditorRequest } = await loadWorkerModule();
  const allowed = [
    "?mode=view",
    "?mode=view&editorRole=public",
    "?mode=view&editorRole=visitor",
    "?mode=view&editorRole=consumer",
    "?mode=view&role=public",
    "?mode=view&role=%20Visitor%20",
    "?mode=view&editorRole=public&role=consumer",
  ];
  const protectedRequests = [
    "",
    "?mode=edit",
    "?mode=VIEW&role=public",
    "?mode=view&editorRole=staff",
    "?mode=view&editorRole=editor",
    "?mode=view&editorRole=manager",
    "?mode=view&editorRole=developer",
    "?mode=view&role=staff",
    "?mode=view&role=editor",
    "?mode=view&role=manager",
    "?mode=view&role=developer",
    "?mode=view&role=unknown",
    "?mode=view&editorRole=public&role=staff",
    "?mode=view&role=public&role=developer",
    "?mode=view&mode=view",
    "?mode=view&mode=edit&role=public",
  ];

  for (const query of allowed) {
    assert.equal(isAnonymousPublicEditorRequest(new URL(`https://example.test/songak/representative-greeting-editor.html${query}`)), true, query);
  }
  for (const query of protectedRequests) {
    assert.equal(isAnonymousPublicEditorRequest(new URL(`https://example.test/songak/representative-greeting-editor.html${query}`)), false, query);
  }
});

test("serves production Vite chunks from the Worker-first ASSETS binding", async () => {
  const { default: worker } = await loadWorkerModule();
  const fetched = [];
  const response = await worker.fetch(
    new Request("https://example.test/assets/index-DFlzmh-M.js"),
    {
      ASSETS: {
        async fetch(request) {
          fetched.push({ method: request.method, url: request.url });
          return new Response("export const ready = true;", {
            headers: { "content-type": "text/javascript; charset=utf-8" },
          });
        },
      },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );

  assert.deepEqual(fetched, [{ method: "GET", url: "https://example.test/assets/index-DFlzmh-M.js" }]);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "export const ready = true;");
  assert.equal(response.headers.get("content-type"), "text/javascript; charset=utf-8");
  assert.equal(response.headers.get("cache-control"), "public, max-age=31536000, immutable");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
});

test("does not cache a missing production chunk", async () => {
  const { default: worker } = await loadWorkerModule();
  const response = await worker.fetch(
    new Request("https://example.test/assets/missing-HASH.js"),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );

  assert.equal(response.status, 404);
  assert.equal(response.headers.get("cache-control"), "no-store");
});
