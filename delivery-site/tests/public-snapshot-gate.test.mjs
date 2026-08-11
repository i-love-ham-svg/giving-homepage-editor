import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DeploymentGateError,
  validateHostingManifest,
  validatePublishedSnapshotPayload,
  verifyPublicSnapshot,
} from "../scripts/verify-public-snapshot.mjs";

const root = new URL("../", import.meta.url);
const validContent = {
  schemaVersion: 6,
  document: {
    sections: [
      { id: "mainIntro", type: "main-intro" },
      { id: "footer", type: "essential" },
    ],
  },
};
const validPayload = {
  key: "songak-homepage",
  content: validContent,
  revision: 12,
  publishedAt: "2026-08-11T00:00:00.000Z",
};

test("accepts this project's Sites manifest and a non-empty published snapshot", async () => {
  const manifest = JSON.parse(await readFile(new URL(".openai/hosting.json", root), "utf8"));
  assert.equal(validateHostingManifest(manifest).project_id, "appgprj_6a7943c061ec81918c8edf137a42878d");

  assert.deepEqual(validatePublishedSnapshotPayload(validPayload), {
    key: "songak-homepage",
    revision: 12,
    publishedAt: "2026-08-11T00:00:00.000Z",
    sectionCount: 2,
  });
});

test("blocks the exact empty public snapshot regression", () => {
  assert.throws(
    () => validatePublishedSnapshotPayload({ key: "songak-homepage", content: null, revision: 0, publishedAt: null }),
    (error) => error instanceof DeploymentGateError && error.code === "UNPUBLISHED_REVISION",
  );
  assert.throws(
    () => validatePublishedSnapshotPayload({ ...validPayload, content: {} }),
    (error) => error instanceof DeploymentGateError && error.code === "EMPTY_PUBLIC_CONTENT",
  );
  assert.throws(
    () => validatePublishedSnapshotPayload({ ...validPayload, content: { document: { sections: [] } } }),
    (error) => error instanceof DeploymentGateError && error.code === "EMPTY_PUBLIC_SECTIONS",
  );
});

test("requires the persistent DB and media bindings before deployment", () => {
  const base = { project_id: "appgprj_example", d1: "DB", r2: "MEDIA" };
  assert.throws(
    () => validateHostingManifest({ ...base, d1: undefined }),
    (error) => error instanceof DeploymentGateError && error.code === "MISSING_D1_BINDING",
  );
  assert.throws(
    () => validateHostingManifest({ ...base, r2: undefined }),
    (error) => error instanceof DeploymentGateError && error.code === "MISSING_R2_BINDING",
  );
});

test("fetches the uncached public API and returns only verified publication metadata", async () => {
  let requestedUrl = "";
  let requestedOptions;
  const result = await verifyPublicSnapshot({
    baseUrl: "https://songak-welfare-editor.hamsungryong.chatgpt.site/some/ignored/path",
    fetchImpl: async (url, options) => {
      requestedUrl = String(url);
      requestedOptions = options;
      return new Response(JSON.stringify(validPayload), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    },
  });

  const requested = new URL(requestedUrl);
  assert.equal(requested.origin, "https://songak-welfare-editor.hamsungryong.chatgpt.site");
  assert.equal(requested.pathname, "/api/site-content/songak-homepage");
  assert.ok(requested.searchParams.has("deployment_gate"));
  assert.equal(requestedOptions.cache, "no-store");
  assert.equal(requestedOptions.headers["cache-control"], "no-cache");
  assert.equal(result.revision, 12);
  assert.equal(result.sectionCount, 2);
});

test("fails the post-deployment gate on an empty API response or an HTTP error", async () => {
  await assert.rejects(
    verifyPublicSnapshot({
      baseUrl: "https://example.com",
      fetchImpl: async () => new Response(
        JSON.stringify({ key: "songak-homepage", content: null, revision: 0, publishedAt: null }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    }),
    (error) => error instanceof DeploymentGateError && error.code === "UNPUBLISHED_REVISION",
  );
  await assert.rejects(
    verifyPublicSnapshot({
      baseUrl: "https://example.com",
      fetchImpl: async () => new Response("not found", { status: 404 }),
    }),
    (error) => error instanceof DeploymentGateError && error.code === "PUBLIC_API_HTTP_ERROR",
  );
});
