import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const managerPath = path.resolve("outputs/editor-viewport-manager.js");
const code = fs.readFileSync(managerPath, "utf8");
const context = {
  structuredClone,
  window: {}
};
vm.createContext(context);
vm.runInContext(code, context, { filename: managerPath });

const manager = context.window.EditorViewportManager;
const profiles = {
  desktop: { label: "PC" },
  phoneSmall: { label: "소형폰" },
  phone: { label: "휴대폰" },
  tablet: { label: "태블릿" }
};
const viewportKeys = Object.keys(profiles);
const assertJsonEqual = (actual, expected) => {
  assert.equal(JSON.stringify(actual), JSON.stringify(expected));
};

assert.equal(typeof manager, "object");
assert.equal(manager.normalizeViewportKey("mobile", profiles), "phone");
assert.equal(manager.normalizeViewportKey("tablet", profiles), "tablet");
assert.equal(manager.normalizeViewportKey("unknown", profiles), "desktop");
assert.equal(manager.isResponsiveViewport("desktop", profiles), false);
assert.equal(manager.isResponsiveViewport("phone", profiles), true);
assert.equal(manager.isResponsiveViewport("mobile", profiles), true);

const created = manager.createViewportMap({
  desktop: { x: 1 },
  mobile: { x: 2 },
  tablet: { x: 3 }
}, {
  desktop: { x: 10 },
  phoneSmall: { x: 11 },
  phone: { x: 12 },
  tablet: { x: 13 }
}, viewportKeys);

assertJsonEqual(created.desktop, { x: 1 });
assertJsonEqual(created.phoneSmall, { x: 2 });
assertJsonEqual(created.phone, { x: 2 });
assertJsonEqual(created.tablet, { x: 3 });
assert.equal(created.mobile, created.phone);

const ensured = manager.ensureViewportMap({
  desktop: { y: 1 },
  phone: { y: 2 }
}, {
  desktop: { y: 10 },
  phoneSmall: { y: 11 },
  phone: { y: 12 },
  tablet: { y: 13 }
}, viewportKeys);

assertJsonEqual(ensured.desktop, { y: 1 });
assertJsonEqual(ensured.phoneSmall, { y: 2 });
assertJsonEqual(ensured.phone, { y: 2 });
assertJsonEqual(ensured.tablet, { y: 2 });
assert.equal(ensured.mobile, ensured.phone);

const scoped = {
  desktop: { title: { size: 40 } },
  phone: { title: { size: 18 } }
};
const scopedBase = {
  desktop: { body: { size: 20 } },
  phoneSmall: { body: { size: 14 } },
  phone: { body: { size: 16 } },
  tablet: { body: { size: 18 } }
};

assertJsonEqual(manager.getViewportLayerValue(scoped, "desktop", "title", profiles), { size: 40 });
assertJsonEqual(manager.getViewportLayerValue(scoped, "phone", "title", profiles), { size: 18 });
assert.equal(manager.getViewportLayerValue(scoped, "tablet", "title", profiles), null);

const ensuredBody = manager.ensureViewportLayerValue(scoped, "tablet", "body", scopedBase, profiles);
assertJsonEqual(ensuredBody, { size: 18 });
ensuredBody.size = 30;
assertJsonEqual(scopedBase.tablet.body, { size: 18 });
assertJsonEqual(scoped.tablet.body, { size: 30 });

console.log("viewport manager tests OK");
