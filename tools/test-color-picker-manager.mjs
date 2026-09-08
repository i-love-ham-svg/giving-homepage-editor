import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const managerPath = path.resolve("outputs/editor-color-picker-manager.js");
const code = fs.readFileSync(managerPath, "utf8");
assert.match(code, /const THEME_COLOR_TOKENS = \[/);
assert.match(code, /function getThemeColors\(\)/);
assert.match(code, /className = "editor-theme-color-button"/);
assert.match(code, /applyColor\(input, color\)/);
class FakeEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.bubbles = Boolean(options.bubbles);
  }
}
const context = { window: {} };
vm.createContext(context);
vm.runInContext(code, context, { filename: managerPath });

const manager = context.window.EditorColorPickerManager;
assert.equal(typeof manager.create, "function");
assert.equal(manager.cssColorToHex("#abc"), "#aabbcc");
assert.equal(manager.cssColorToHex("rgb(12, 34, 56)"), "#0c2238");
assert.equal(manager.cssColorToHex("rgba(255, 0, 0, .5)"), "#ff8080");
assert.equal(manager.cssColorToHex("transparent"), null);

const runtime = manager.create({
  document: { defaultView: { Event: FakeEvent }, documentElement: {} },
  window: { Event: FakeEvent },
  target: {}
});
const events = [];
const input = {
  value: "#000000",
  dispatchEvent(event) {
    events.push([event.type, event.bubbles]);
  }
};
assert.equal(runtime.applyColor(input, "#A1B2C3"), true);
assert.equal(input.value, "#a1b2c3");
assert.deepEqual(events, [["input", true], ["change", true]]);
assert.equal(runtime.applyColor(input, "invalid"), false);
assert.equal(typeof runtime.cancelAll, "function");
assert.equal(typeof runtime.closePalette, "function");
assert.equal(runtime.active, false);
assert.equal(runtime.paletteOpen, false);
assert.equal(runtime.cancelAll(), false);

console.log("color picker manager tests OK");
