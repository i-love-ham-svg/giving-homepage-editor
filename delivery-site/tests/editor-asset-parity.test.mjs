import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  verifyBuiltWorkerAssetsConfig,
  verifyEditorAssetParity,
} from "../scripts/verify-editor-assets.mjs";
import { EXCLUDED_EDITOR_FILES } from "../scripts/sync-editor.mjs";

test("keeps the retirement manifest as the generated-delivery boundary", () => {
  assert.ok(EXCLUDED_EDITOR_FILES.includes("community-board.html"));
  assert.ok(EXCLUDED_EDITOR_FILES.includes("public-about.html"));
  assert.ok(EXCLUDED_EDITOR_FILES.includes("representative-greeting-public.html"));
  assert.ok(EXCLUDED_EDITOR_FILES.includes("head-layout-editor.html"));
  assert.ok(!EXCLUDED_EDITOR_FILES.includes("facility-detail.html"), "active redirect wrappers must remain shipped");
  assert.ok(!EXCLUDED_EDITOR_FILES.some((file) => file.startsWith("assets/generated/")), "D1-audit-held image URLs must remain available");
});

test("blocks stale editor builds and every manifest-quarantined artifact", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "songak-editor-parity-"));
  const source = path.join(root, "outputs");
  const publicDestination = path.join(root, "public", "songak");
  const builtDestination = path.join(root, "dist", "client", "songak");
  const builtWranglerConfig = path.join(root, "dist", "server", "wrangler.json");
  const destinations = [publicDestination, builtDestination];

  try {
    await Promise.all([
      source,
      ...destinations,
      path.dirname(builtWranglerConfig),
    ].map((directory) => mkdir(directory, { recursive: true })));
    await writeFile(path.join(source, "representative-greeting-editor.html"), "current", "utf8");
    await writeFile(path.join(source, "editor-essential-manager.js"), "manager", "utf8");
    await writeFile(builtWranglerConfig, JSON.stringify({
      assets: {
        directory: "../client",
        binding: "ASSETS",
        html_handling: "none",
        run_worker_first: true,
      },
    }), "utf8");
    for (const destination of destinations) {
      await writeFile(path.join(destination, "representative-greeting-editor.html"), "current", "utf8");
      await writeFile(path.join(destination, "editor-essential-manager.js"), "manager", "utf8");
    }

    const valid = await verifyEditorAssetParity({
      source,
      publicDestination,
      builtDestination,
      builtWranglerConfig,
    });
    assert.equal(valid.fileCount, 2);
    assert.equal(valid.workerAssets.assets.binding, "ASSETS");
    assert.equal(valid.workerAssets.assets.run_worker_first, true);

    await writeFile(path.join(builtDestination, "representative-greeting-editor.html"), "stale", "utf8");
    await assert.rejects(
      verifyEditorAssetParity({ source, publicDestination, builtDestination, builtWranglerConfig }),
      /differs from outputs/,
    );

    await writeFile(path.join(builtDestination, "representative-greeting-editor.html"), "current", "utf8");
    await writeFile(path.join(publicDestination, "community-board.html"), "legacy", "utf8");
    await assert.rejects(
      verifyEditorAssetParity({ source, publicDestination, builtDestination, builtWranglerConfig }),
      /Retired editor artifact must not be shipped/,
    );

    await rm(path.join(publicDestination, "community-board.html"));
    await writeFile(path.join(publicDestination, "public-about.html"), "legacy public renderer", "utf8");
    await assert.rejects(
      verifyEditorAssetParity({ source, publicDestination, builtDestination, builtWranglerConfig }),
      /Retired editor artifact must not be shipped/,
    );

    await writeFile(builtWranglerConfig, JSON.stringify({
      assets: { directory: "../client", html_handling: "none", run_worker_first: true },
    }), "utf8");
    await assert.rejects(
      verifyBuiltWorkerAssetsConfig(builtWranglerConfig),
      /assets binding must be ASSETS/,
    );

    await writeFile(builtWranglerConfig, JSON.stringify({
      assets: { directory: "../client", binding: "ASSETS", html_handling: "none", run_worker_first: false },
    }), "utf8");
    await assert.rejects(
      verifyBuiltWorkerAssetsConfig(builtWranglerConfig),
      /run_worker_first to true/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
