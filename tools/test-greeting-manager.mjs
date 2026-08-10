import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const managerPath = path.resolve("outputs/editor-greeting-manager.js");
const code = fs.readFileSync(managerPath, "utf8");
const editorHtml = fs.readFileSync(path.resolve("outputs/representative-greeting-editor.html"), "utf8");
const context = {
  structuredClone,
  window: {}
};
vm.createContext(context);
vm.runInContext(code, context, { filename: managerPath });

const manager = context.window.EditorGreetingManager;
const assertJsonEqual = (actual, expected) => {
  assert.equal(JSON.stringify(actual), JSON.stringify(expected));
};

assert.equal(typeof manager, "object");
assert.match(editorHtml, /function isSafeEditorImageSource\(source\)[\s\S]*?securityRuntime\.isSafeImageDataUrl\(value\) \|\| isProjectAssetUrl/);
assert.match(editorHtml, /function showPhotoAsset\(src[\s\S]*?if \(!isSafeEditorImageSource\(src\)\)[\s\S]*?refs\.photoImage\.src = src/);
assert.match(editorHtml, /dataUrl: "\.\/assets\/concept\/representative-concept\.webp"/);
assert.equal(manager.isSection("greeting"), true);
assert.equal(manager.isSection("greeting2"), true);
assert.equal(manager.isSection("mainIntro"), false);

assertJsonEqual(manager.getLayerIds("greeting"), [
  "title",
  "body",
  "photo",
  "identity",
  "signature",
  "seal"
]);

assertJsonEqual(manager.getLayerIds("greeting3"), [
  "greeting3Title",
  "greeting3Body",
  "greeting3Photo",
  "greeting3Identity",
  "greeting3Signature",
  "greeting3Seal"
]);

assert.equal(manager.getLayerId("greeting4", "photo"), "greeting4Photo");
assert.equal(manager.getLayerPart("title"), "title");
assert.equal(manager.getLayerPart("greeting2Signature"), "signature");
assert.equal(manager.getLayerPart("mainIntroTitle"), "");
assert.equal(manager.getSectionIdForLayer("body"), "greeting");
assert.equal(manager.getSectionIdForLayer("greeting7Seal"), "greeting7");
assert.equal(manager.getSectionIdForLayer("mainIntroTitle"), null);
assert.equal(manager.getPartLabel("identity"), "텍스트 상자");
assert.equal(manager.getLayerLabel("대표자 인사말 2", "seal"), "대표자 인사말 2 기관 직인");
assert.equal(manager.isTextStylePart("identity"), true);
assert.equal(manager.isTextStylePart("photo"), false);

const cloned = manager.cloneViewportMap({
  desktop: {
    greeting2Title: { x: 1 },
    body: { x: 2 }
  },
  phone: {
    greeting2Seal: { x: 3 }
  }
}, "greeting2", "greeting5", ["desktop", "phone"]);

assertJsonEqual(cloned.desktop.greeting5Title, { x: 1 });
assertJsonEqual(cloned.desktop.greeting5Body, { x: 2 });
assertJsonEqual(cloned.phone.greeting5Seal, { x: 3 });
assert.equal(cloned.mobile, cloned.phone);

console.log("greeting manager tests OK");
