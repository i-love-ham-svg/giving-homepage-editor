import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

function createButton() {
  const listeners = new Map();
  return {
    hidden: false,
    disabled: false,
    textContent: "",
    dataset: {},
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
    click() {
      listeners.get("click")?.();
    }
  };
}

const managerPath = path.resolve("outputs/editor-category-toolbar-manager.js");
const code = fs.readFileSync(managerPath, "utf8");
const context = { window: {} };
vm.createContext(context);
vm.runInContext(code, context, { filename: managerPath });

const manager = context.window.EditorCategoryToolbarManager;
assert.equal(typeof manager.create, "function");

const viewButton = createButton();
const addButton = createButton();
const deleteButton = createButton();
const calls = [];
const runtime = manager.create({ viewButton, addButton, deleteButton });

assert.equal(viewButton.hidden, true);
assert.equal(addButton.hidden, true);
assert.equal(deleteButton.hidden, true);

runtime.setContext({
  kind: "program",
  viewLabel: "View",
  addLabel: "Add",
  deleteLabel: "Delete",
  canDelete: false,
  onView: () => calls.push("view"),
  onAdd: () => calls.push("add"),
  onDelete: () => calls.push("delete")
});
assert.equal(viewButton.hidden, false);
assert.equal(viewButton.textContent, "View");
assert.equal(viewButton.dataset.categoryContext, "program");
assert.equal(deleteButton.disabled, true);
viewButton.click();
addButton.click();
deleteButton.click();
assert.deepEqual(calls, ["view", "add"]);

runtime.clear();
assert.equal(viewButton.hidden, true);
assert.equal(addButton.hidden, true);
assert.equal(deleteButton.hidden, true);
runtime.destroy();

console.log("category toolbar manager tests OK");
