import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const sourcePath = path.resolve("outputs/editor-detail-bundle-data.js");
const source = fs.readFileSync(sourcePath, "utf8");
const context = vm.createContext({ structuredClone, window: {} });
vm.runInContext(source, context, { filename: sourcePath });

const runtime = context.window.SongakDetailBundles;
const bundles = runtime.BUNDLES;

assert.equal(runtime.resolveSectionKind("facility", "facts"), "facts");
assert.equal(runtime.resolveSectionKind("facility", "guide"), "facts");
assert.equal(runtime.resolveSectionKind("facility", "unknown"), "");

const legacyFacilityGuide = runtime.createModel("facility", "guide");
assert.equal(legacyFacilityGuide.detailPageKind, "facility");
assert.equal(legacyFacilityGuide.detailSectionKind, "facts");
assert.equal(legacyFacilityGuide.details.length, 3);
assert.equal(bundles.facility.kindAliases.guide, "facts");

for (const [pageKind, config] of Object.entries(bundles)) {
  for (const modelKind of Object.keys(config.models)) {
    assert.ok(config.kinds.includes(modelKind), `${pageKind}.${modelKind} must be an advertised section kind`);
  }
  for (const canonicalKind of Object.values(config.kindAliases || {})) {
    assert.ok(config.kinds.includes(canonicalKind), `${pageKind} alias must resolve to an advertised section kind`);
  }
}

assert.equal("hero" in bundles.account.models, false);
assert.equal(runtime.createModel("account", "hero"), null);
assert.deepEqual(Array.from(bundles.account.kinds), ["social", "guide"]);

console.log("detail bundle data contract tests OK");
