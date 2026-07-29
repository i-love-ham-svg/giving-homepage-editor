import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const managerPath = resolve("outputs", "editor-process-manager.js");
const source = readFileSync(managerPath, "utf8");
const context = { structuredClone, window: {} };

vm.createContext(context);
vm.runInContext(source, context, { filename: managerPath });

const manager = context.window.EditorProcessManager;
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };

assert(manager.isSection("process"), "base process section id should be valid");
assert(manager.isSection("process12"), "duplicated process section id should be valid");
assert(!manager.isSection("program"), "program section should not be a process section");

const model = manager.createDefaultModel();
assert(model.steps.length === 6, "default process should have six steps");
assert(model.highlights.length === 3, "default process should have three highlights");
assert(model.textStyles.phone.headline.size > 0, "phone headline style should exist");
assert(Boolean(manager.ICONS[model.steps[0].icon]), "default step icon should exist");
assert(Object.keys(manager.ICONS).length >= 24, "process icon library should offer diverse choices");
assert(Boolean(manager.ICONS.calendar) && Boolean(manager.ICONS.medical) && Boolean(manager.ICONS.building),
  "common process icon categories should exist");
assert(model.heightVersion === 2, "process height schema should use the current version");
assert(Object.keys(manager.normalizeModel({ ...model, heightVersion: 1, heights: { desktop: 9000 } }).heights).length === 0,
  "legacy process heights should be discarded");
assert(manager.normalizeModel({ ...model, heights: { desktop: 900 } }).heights.desktop === 900,
  "current process heights should be preserved");

const added = manager.addStep(model);
assert(added.steps.length === 7, "addStep should append a step");
assert(model.steps.length === 6, "addStep should not mutate the source model");
const insertedStep = manager.addStep(model, model.steps[0].id);
assert(insertedStep.steps.length === 7 && insertedStep.steps[1].title === "새 단계",
  "addStep should insert immediately after the selected step");

const moved = manager.moveItem(added.steps, added.steps[6].id, "up");
assert(moved[5].id === added.steps[6].id, "moveItem should move a step forward");

const removed = manager.removeStep(added, added.steps[0].id);
assert(removed.steps.length === 6, "removeStep should remove a step");

const noSteps = model.steps.reduce((current, step) => manager.removeStep(current, step.id), model);
assert(noSteps.steps.length === 0, "all process steps should be removable");
assert(manager.normalizeModel(noSteps).steps.length === 0, "an empty process step list should remain empty");

const highlighted = manager.addHighlight(model);
assert(highlighted.highlights.length === 4, "addHighlight should append a highlight");
const insertedHighlight = manager.addHighlight(model, model.highlights[0].id);
assert(insertedHighlight.highlights.length === 4 && insertedHighlight.highlights[1].id !== model.highlights[1].id,
  "addHighlight should insert immediately after the selected highlight");
const noHighlights = model.highlights.reduce((current, item) => manager.removeHighlight(current, item.id), model);
assert(noHighlights.highlights.length === 0, "all process highlights should be removable");
assert(manager.normalizeModel(noHighlights).highlights.length === 0, "an empty process highlight list should remain empty");
assert(manager.addStep(noSteps).steps.length === 1, "an empty process step list should be recoverable");
assert(manager.addHighlight(noHighlights).highlights.length === 1, "an empty process highlight list should be recoverable");
assert(manager.estimateHeight(model, "phone") > manager.estimateHeight(model, "desktop"), "mobile process should reserve vertical flow height");
assert(manager.estimateHeight(noSteps, "desktop") < manager.estimateHeight(model, "desktop"),
  "removing all steps should reduce the estimated section height");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("process manager tests OK");
}
