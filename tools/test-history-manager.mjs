import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const managerPath = resolve("outputs", "editor-history-manager.js");
const source = readFileSync(managerPath, "utf8");
const context = { window: {} };

vm.createContext(context);
vm.runInContext(source, context, { filename: managerPath });

const store = context.window.EditorHistoryManager.createAssetStore();
const failures = [];
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};
const image = `data:image/png;base64,${"A".repeat(100_000)}`;
const snapshot = {
  photo: image,
  nested: [{ image }, { label: "이미지 아닌 텍스트" }]
};

const serialized = store.serialize(snapshot);
assert(store.size === 1, "identical history images should be pooled once");
assert(!serialized.includes("A".repeat(100)), "serialized history should not contain base64 image payloads");
assert(serialized.length < 500, "serialized history should stay compact");

const restored = store.parse(serialized);
assert(restored.photo === image, "history image should be restored from its reference");
assert(restored.nested[0].image === image, "nested history image should be restored");
assert(restored.nested[1].label === "이미지 아닌 텍스트", "non-image values should be preserved");

store.clear();
assert(store.size === 0, "history asset pool should clear with history");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("history manager tests OK");
}
