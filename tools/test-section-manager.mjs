import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const managerPath = resolve("outputs", "editor-section-manager.js");
const source = readFileSync(managerPath, "utf8");
const context = { window: {} };

vm.createContext(context);
vm.runInContext(source, context, { filename: managerPath });

const manager = context.window.EditorSectionManager;
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

const labels = {
  mainIntro: true,
  greeting: true,
  program: true,
  process: true,
  history: true,
  mainIntro2: true,
  greeting2: true
};

const order = manager.normalizeSectionOrder(["greeting"], labels);
assert(order.join(",") === "mainIntro,mainIntro2,program,process,history,greeting,greeting2", "normalizeSectionOrder should place content sections before greeting");
assert(manager.getDisplayLabel("mainIntro2", { labels, order }) === "메인 소개 2", "main intro label should include sequence number");
assert(manager.getDisplayLabel("greeting2", { labels, order }) === "대표자 인사말 2", "greeting label should include sequence number");
assert(manager.getDisplayLabel("program", { labels, order }) === "프로그램 소개", "program label should be available");
assert(manager.getDisplayLabel("process", { labels, order }) === "프로세스", "process label should be available");
assert(manager.getDisplayLabel("history", { labels, order }) === "연혁", "history label should be available");
assert(manager.canPasteSectionSnapshot("program", { sectionId: "program2" }, { ...labels, program2: true }), "program snapshot should paste into program section");
assert(manager.canPasteSectionSnapshot("process", { sectionId: "process2" }, { ...labels, process2: true }), "process snapshot should paste into process section");
assert(manager.canPasteSectionSnapshot("history", { sectionId: "history2" }, { ...labels, history2: true }), "history snapshot should paste into history section");
assert(manager.normalizeSectionId("missing", labels) === "greeting", "unknown section id should fall back to greeting");
assert(manager.canPasteSectionSnapshot("greeting2", { sectionId: "greeting" }, labels), "greeting snapshot should paste into greeting section");
assert(!manager.canPasteSectionSnapshot("mainIntro", { sectionId: "greeting" }, labels), "greeting snapshot should not paste into main intro section");
assert(manager.getClipboardPasteLabel({ sectionId: "mainIntro", label: "메인 소개" }) === "메인 소개 붙여넣기", "main intro paste label should be direct paste");
assert(manager.getClipboardPasteLabel({ sectionId: "greeting", label: "대표자 인사말" }) === "대표자 인사말 새 섹션으로 붙여넣기", "greeting paste label should describe new section paste");
assert(manager.getInsertIndexForSlot("top", null, order, ["mainIntro", "greeting"]) === 0, "top insert should use index 0");
assert(manager.getInsertIndexForSlot("between", null, order, ["mainIntro", "greeting"]) === order.indexOf("greeting"), "between insert should target second visible section");
assert(manager.placeSectionInOrder("greeting2", "top", null, order, ["mainIntro", "greeting"]).at(0) === "greeting2", "placeSectionInOrder should move existing section");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("section manager tests OK");
}
