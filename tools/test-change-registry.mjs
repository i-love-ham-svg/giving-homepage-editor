import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registryPath = path.join(root, "docs", "change-registry.json");
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const retiredArtifacts = JSON.parse(fs.readFileSync(path.join(root, "docs", "retired-artifacts.json"), "utf8"));

assert.equal(registry.schemaVersion, 1, "change registry schemaVersion must be 1");
assert.equal(registry.policy?.publicDeploymentAllowed, false, "public deployment must remain disabled until explicit approval");
assert.ok(Array.isArray(registry.records) && registry.records.length > 0, "change registry must contain records");
assert.equal(retiredArtifacts.schemaVersion, 1, "retired artifact registry schemaVersion must be 1");
assert.equal(retiredArtifacts.policy?.deleteSourceFiles, false, "retired sources must remain recoverable");
assert.equal(retiredArtifacts.policy?.publicDeploymentAllowed, false, "retirement work must not authorize deployment");
assert.ok(retiredArtifacts.deploymentExclusions.includes("community-board.html"));
assert.ok(retiredArtifacts.deploymentExclusions.includes("public-about.html"));
assert.ok(!retiredArtifacts.deploymentExclusions.some((file) => file.startsWith("assets/generated/")), "D1-audit-held images cannot be excluded from delivery yet");
assert.equal(new Set(retiredArtifacts.deploymentExclusions).size, retiredArtifacts.deploymentExclusions.length, "deployment exclusions must be unique");
for (const relative of retiredArtifacts.deploymentExclusions) {
  assert.equal(path.posix.dirname(relative), ".", `deployment exclusion must be a top-level generated asset: ${relative}`);
  assert.ok(fs.existsSync(path.join(root, "outputs", relative)), `deployment exclusion source does not exist: ${relative}`);
}

const retiredBoardGroup = retiredArtifacts.groups.find((group) => group.id === "retired-community-board");
const retiredStaticGroup = retiredArtifacts.groups.find((group) => group.id === "legacy-static-public-renderer");
const activeWrappersGroup = retiredArtifacts.groups.find((group) => group.id === "active-legacy-route-wrappers");
const heldImagesGroup = retiredArtifacts.groups.find((group) => group.id === "generated-large-image-originals");
const expectedExclusions = new Set([
  ...retiredBoardGroup.deliveryPaths,
  ...retiredStaticGroup.files
    .filter((source) => source.startsWith("outputs/"))
    .map((source) => source.slice("outputs/".length)),
]);
assert.deepEqual(new Set(retiredArtifacts.deploymentExclusions), expectedExclusions, "manifest groups and deployment exclusions must agree");
for (const wrapper of activeWrappersGroup.files) {
  assert.ok(!retiredArtifacts.deploymentExclusions.includes(wrapper.slice("outputs/".length)), `active wrapper cannot be quarantined: ${wrapper}`);
}
for (const image of heldImagesGroup.files) {
  assert.ok(image.activeDerivative || image.supersededBy, `held image needs an active derivative or replacement: ${image.path}`);
  assert.ok(fs.existsSync(path.join(root, image.activeDerivative || image.supersededBy)), `held image replacement does not exist: ${image.path}`);
}

for (const group of retiredArtifacts.groups) {
  for (const entry of group.files || []) {
    const source = typeof entry === "string" ? entry : entry.path;
    assert.ok(fs.existsSync(path.join(root, source)), `retired source must remain recoverable: ${source}`);
    if (typeof entry === "object") {
      const data = fs.readFileSync(path.join(root, source));
      assert.equal(data.byteLength, entry.bytes, `retired image byte count drifted: ${source}`);
      assert.equal(
        (await import("node:crypto")).createHash("sha256").update(data).digest("hex"),
        entry.sha256,
        `retired image digest drifted: ${source}`,
      );
    }
  }
}

const allowed = registry.policy?.allowed || {};
const ids = new Set();
const assertionIds = new Set();

function assertAllowed(value, values, label) {
  assert.ok(Array.isArray(values) && values.includes(value), `${label} contains unsupported value: ${value}`);
}

function sourcePath(entry) {
  return String(entry || "").split("#", 1)[0];
}

for (const record of registry.records) {
  assert.match(record.id, /^[A-Z]+(?:-[A-Z]+)*-\d{3}$/, `invalid change id: ${record.id}`);
  assert.ok(!ids.has(record.id), `duplicate change id: ${record.id}`);
  ids.add(record.id);

  assertAllowed(record.recordType, allowed.recordTypes, `${record.id}.recordType`);
  assert.match(record.primaryTaxonomyId, /^[a-z0-9-]+\.[a-z0-9-]+\.[a-z0-9-]+$/, `${record.id} taxonomy id must have exactly three levels`);
  for (const taxonomyId of record.relatedTaxonomyIds || []) {
    assert.match(taxonomyId, /^[a-z0-9-]+\.[a-z0-9-]+\.[a-z0-9-]+$/, `${record.id} related taxonomy id must have exactly three levels`);
  }

  for (const surface of record.scope?.surfaces || []) assertAllowed(surface, allowed.surfaces, `${record.id}.scope.surfaces`);
  for (const viewport of record.scope?.viewports || []) assertAllowed(viewport, allowed.viewports, `${record.id}.scope.viewports`);
  for (const role of record.scope?.roles || []) assertAllowed(role, allowed.roles, `${record.id}.scope.roles`);
  for (const mode of record.scope?.modes || []) assertAllowed(mode, allowed.modes, `${record.id}.scope.modes`);

  assertAllowed(record.status?.decision, allowed.decision, `${record.id}.status.decision`);
  assertAllowed(record.status?.implementation, allowed.implementation, `${record.id}.status.implementation`);
  assertAllowed(record.status?.qa, allowed.qa, `${record.id}.status.qa`);
  assertAllowed(record.status?.deployment, allowed.deployment, `${record.id}.status.deployment`);
  assertAllowed(record.cause?.category, allowed.causeCategories, `${record.id}.cause.category`);
  for (const category of record.cause?.relatedCategories || []) assertAllowed(category, allowed.causeCategories, `${record.id}.cause.relatedCategories`);
  assertAllowed(record.risk, allowed.risk, `${record.id}.risk`);

  assert.ok(record.cause?.confirmed, `${record.id} must have a confirmed root cause before implementation`);
  assert.ok(Array.isArray(record.invariants) && record.invariants.length > 0, `${record.id} must define invariants`);
  for (const invariant of record.invariants) {
    assert.match(invariant.assertionId, /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/, `${record.id} has invalid assertion id`);
    assert.ok(!assertionIds.has(invariant.assertionId), `duplicate invariant assertion id: ${invariant.assertionId}`);
    assertionIds.add(invariant.assertionId);
    assert.ok(invariant.statement?.trim(), `${record.id} invariant statement is required`);
  }

  assert.ok(Array.isArray(record.sourceOfTruth) && record.sourceOfTruth.length > 0, `${record.id} must identify source of truth`);
  assert.ok(Array.isArray(record.implementationFiles) && record.implementationFiles.length > 0, `${record.id} must identify implementation files`);
  for (const source of record.sourceOfTruth) {
    const sourceFile = sourcePath(source);
    assert.ok(sourceFile, `${record.id} has an empty source-of-truth path`);
    assert.ok(fs.existsSync(path.join(root, sourceFile)), `${record.id} source of truth does not exist: ${sourceFile}`);
  }
  for (const implementationFile of record.implementationFiles) {
    assert.ok(implementationFile?.trim(), `${record.id} has an empty implementation file path`);
    assert.ok(fs.existsSync(path.join(root, implementationFile)), `${record.id} implementation file does not exist: ${implementationFile}`);
  }
  assert.ok(Array.isArray(record.tests) && record.tests.length > 0, `${record.id} must define regression tests`);
  for (const test of record.tests) {
    assert.ok(test.file?.trim(), `${record.id} has a test without file`);
    assertAllowed(test.status, ["pending", "pass", "failed"], `${record.id}.tests.status`);
    if (record.status.implementation === "verified") {
      assert.equal(test.status, "pass", `${record.id} is verified but ${test.file} has not passed`);
      assert.ok(fs.existsSync(path.join(root, test.file)), `${record.id} verified test does not exist: ${test.file}`);
    }
  }

  if (record.status.deployment === "deployed") {
    assert.equal(record.deployApproval?.publicDeployApproved, true, `${record.id} cannot be deployed without explicit approval`);
    assert.equal(record.status.implementation, "verified", `${record.id} cannot be deployed before verification`);
    assert.equal(record.status.qa, "full-pass", `${record.id} cannot be deployed before full QA`);
  }

  if (!record.deployApproval?.publicDeployApproved) {
    assert.notEqual(record.status.deployment, "deployed", `${record.id} is marked deployed without public approval`);
  }
}

for (const record of registry.records) {
  for (const dependency of record.dependencies || []) {
    assert.ok(ids.has(dependency), `${record.id} references unknown dependency: ${dependency}`);
  }
  for (const superseded of record.supersedes || []) {
    assert.ok(ids.has(superseded), `${record.id} references unknown superseded record: ${superseded}`);
  }
}

console.log(`change registry OK (${registry.records.length} records, public deployment not authorized)`);
