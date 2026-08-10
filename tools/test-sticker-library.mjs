import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registry = JSON.parse(fs.readFileSync(path.join(root, "outputs", "assets", "stickers", "sticker-registry.json"), "utf8"));

assert.equal(registry.sourceSheetCount, 40);
assert.equal(registry.itemCount, 541);
assert.deepEqual(registry.categoryCounts, { daily: 111, animal: 60, nature: 190, neon: 170, botanical: 10 });
assert.equal(new Set(registry.items.map((item) => item.id)).size, registry.itemCount);
assert.ok(registry.items.every((item) => item.transparent && item.status === "approved-source"));
for (const item of registry.items) {
  assert.ok(fs.existsSync(path.join(root, "outputs", item.asset)), `missing ${item.asset}`);
  assert.match(item.taxonomyId, /^asset\.sticker\.imported-/);
}

console.log("sticker library tests OK");
