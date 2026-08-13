import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  EXCLUDED_EDITOR_FILES,
  syncEditorAssets,
} from "../scripts/sync-editor.mjs";

const requiredEditorFiles = [
  "representative-greeting-editor.html",
  "editor-storage-schema.js",
  "editor-essential-manager.js",
  "editor-detail-bundles.css",
];

async function expectMissing(filePath) {
  await assert.rejects(access(filePath), (error) => error?.code === "ENOENT");
}

test("sync keeps required editor assets and removes every manifest-quarantined artifact", async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "songak-editor-sync-"));
  const source = path.join(temporaryRoot, "outputs");
  const destination = path.join(temporaryRoot, "public", "songak");
  const builtDestination = path.join(temporaryRoot, "dist", "client", "songak");

  try {
    await mkdir(path.join(source, "assets", "icons"), { recursive: true });
    await mkdir(destination, { recursive: true });
    await mkdir(builtDestination, { recursive: true });

    for (const fileName of requiredEditorFiles) {
      await writeFile(path.join(source, fileName), `required:${fileName}`, "utf8");
    }
    await writeFile(path.join(source, "assets", "icons", "menu.svg"), "<svg />", "utf8");

    for (const fileName of EXCLUDED_EDITOR_FILES) {
      await writeFile(path.join(source, fileName), `retired-source:${fileName}`, "utf8");
      await writeFile(path.join(destination, fileName), `retired-public:${fileName}`, "utf8");
      await writeFile(path.join(builtDestination, fileName), `retired-build:${fileName}`, "utf8");
    }
    await writeFile(path.join(destination, "stale-public-file.txt"), "stale", "utf8");
    await writeFile(path.join(builtDestination, "keep-build-file.txt"), "keep", "utf8");

    await syncEditorAssets({ source, destination, builtDestination });

    for (const fileName of EXCLUDED_EDITOR_FILES) {
      await expectMissing(path.join(destination, fileName));
      await expectMissing(path.join(builtDestination, fileName));
    }
    await expectMissing(path.join(destination, "stale-public-file.txt"));

    for (const fileName of requiredEditorFiles) {
      assert.equal(await readFile(path.join(destination, fileName), "utf8"), `required:${fileName}`);
    }
    assert.equal(await readFile(path.join(destination, "assets", "icons", "menu.svg"), "utf8"), "<svg />");
    assert.equal(await readFile(path.join(builtDestination, "keep-build-file.txt"), "utf8"), "keep");
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
