import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const managerPath = path.resolve("outputs/editor-main-intro-manager.js");
const code = fs.readFileSync(managerPath, "utf8");
const context = {
  structuredClone,
  window: {}
};
vm.createContext(context);
vm.runInContext(code, context, { filename: managerPath });

const manager = context.window.EditorMainIntroManager;
const assertJsonEqual = (actual, expected) => {
  assert.equal(JSON.stringify(actual), JSON.stringify(expected));
};

assert.equal(typeof manager, "object");
assert.equal(manager.isSection("mainIntro"), true);
assert.equal(manager.isSection("mainIntro2"), true);
assert.equal(manager.isSection("greeting"), false);

assertJsonEqual(manager.getLayerIds("mainIntro"), [
  "mainIntroKicker",
  "mainIntroTitle",
  "mainIntroBody",
  "mainIntroVisualEyebrow",
  "mainIntroVisualTitle",
  "mainIntroVisualCaption",
  "mainIntroRightText"
]);

assertJsonEqual(manager.getLayerIds("mainIntro3"), [
  "mainIntro3Kicker",
  "mainIntro3Title",
  "mainIntro3Body",
  "mainIntro3VisualEyebrow",
  "mainIntro3VisualTitle",
  "mainIntro3VisualCaption",
  "mainIntro3RightText"
]);

assert.equal(manager.getLayerPart("mainIntroVisualTitle"), "VisualTitle");
assert.equal(manager.getLayerPart("mainIntro3RightText"), "RightText");
assert.equal(manager.getLayerPart("greeting2Title"), "");
assert.equal(manager.getBaseLayerId("mainIntro3Body"), "mainIntroBody");
assert.equal(manager.getRightTextLayerId("mainIntro3"), "mainIntro3RightText");
assert.equal(manager.getPartLabel("VisualCaption"), "장식 문구");
assert.equal(manager.getLayerLabel("메인 소개 2", "RightText"), "메인 소개 2 오른쪽 텍스트");
assert.equal(manager.getPartLayerMap("mainIntro2").Body, "mainIntro2Body");

const columnFlow = {
  mode: "columns",
  columns: [
    { x: 8, items: [{ part: "Kicker" }, { part: "Title" }] },
    { x: 55, items: [{ part: "RightText" }] }
  ]
};

assert.equal(manager.getResponsiveItems(columnFlow).length, 3);
assert.equal(manager.getFlowItem(columnFlow, "RightText").column.x, 55);

const cloned = manager.cloneViewportMap({
  desktop: {
    mainIntro2Kicker: { x: 1 },
    mainIntroTitle: { x: 2 }
  },
  phone: {
    mainIntro2Body: { x: 3 }
  }
}, "mainIntro2", "mainIntro4", ["desktop", "phone"]);

assertJsonEqual(cloned.desktop.mainIntro4Kicker, { x: 1 });
assertJsonEqual(cloned.desktop.mainIntro4Title, { x: 2 });
assertJsonEqual(cloned.phone.mainIntro4Body, { x: 3 });
assert.equal(cloned.mobile, cloned.phone);

console.log("main intro manager tests OK");
