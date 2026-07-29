import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const managerPath = path.resolve("outputs/editor-performance-manager.js");
const code = fs.readFileSync(managerPath, "utf8");
const context = {
  window: {
    requestAnimationFrame: () => {
      throw new Error("test should pass an explicit frame api");
    },
    cancelAnimationFrame: () => {}
  }
};
vm.createContext(context);
vm.runInContext(code, context, { filename: managerPath });

const manager = context.window.EditorPerformanceManager;

assert.equal(typeof manager, "object");
assert.equal(typeof manager.createFrameScheduler, "function");
assert.equal(typeof manager.createTaskRegistry, "function");

let nextId = 0;
const callbacks = new Map();
const cancelled = [];
const frameApi = {
  requestAnimationFrame(callback) {
    const id = ++nextId;
    callbacks.set(id, callback);
    return id;
  },
  cancelAnimationFrame(id) {
    cancelled.push(id);
    callbacks.delete(id);
  }
};

const calls = [];
const scheduler = manager.createFrameScheduler((...args) => calls.push(args), frameApi);

const firstId = scheduler.schedule("first");
const secondId = scheduler.schedule("second", 2);
assert.equal(firstId, secondId);
assert.equal(scheduler.pending, true);
assert.equal(calls.length, 0);

callbacks.get(firstId)();
assert.equal(scheduler.pending, false);
assert.deepEqual(calls, [["second", 2]]);

const flushId = scheduler.schedule("flush");
assert.equal(scheduler.flush(), true);
assert.equal(cancelled.includes(flushId), true);
assert.deepEqual(calls.at(-1), ["flush"]);
assert.equal(scheduler.pending, false);

const cancelId = scheduler.schedule("cancel");
assert.equal(scheduler.cancel(), true);
assert.equal(cancelled.includes(cancelId), true);
assert.equal(scheduler.pending, false);
assert.equal(scheduler.cancel(), false);

const registryCalls = [];
const registry = manager.createTaskRegistry(frameApi);
registry.register("layout", (...args) => registryCalls.push(args));
assert.equal(registry.has("layout"), true);
const registryId = registry.schedule("layout", "first");
assert.equal(registry.schedule("layout", "latest", 3), registryId);
assert.equal(registry.pending, true);
callbacks.get(registryId)();
assert.deepEqual(registryCalls, [["latest", 3]]);
assert.equal(registry.pending, false);

const cancelledRegistryId = registry.schedule("layout", "cancelled");
assert.equal(registry.cancelAll(), 1);
assert.equal(cancelled.includes(cancelledRegistryId), true);
assert.equal(registry.pending, false);
assert.throws(() => registry.schedule("missing"), /Unknown frame task/);

console.log("performance manager tests OK");
