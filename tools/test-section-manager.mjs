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
  facility: true,
  mainIntro2: true,
  greeting2: true
};

const order = manager.normalizeSectionOrder(["greeting"], labels);
assert(order.join(",") === "mainIntro,mainIntro2,program,process,history,facility,greeting,greeting2", "normalizeSectionOrder should place content sections before greeting");
assert(manager.getDisplayLabel("mainIntro2", { labels, order }) === "메인 소개 2", "main intro label should include sequence number");
assert(manager.getDisplayLabel("greeting2", { labels, order }) === "대표자 인사말 2", "greeting label should include sequence number");
assert(manager.getDisplayLabel("program", { labels, order }) === "프로그램 소개", "program label should be available");
assert(manager.getDisplayLabel("process", { labels, order }) === "프로세스", "process label should be available");
assert(manager.getDisplayLabel("history", { labels, order }) === "연혁", "history label should be available");
assert(manager.getDisplayLabel("facility", { labels: { ...labels, facility: "시설현황" }, order }) === "시설현황", "essential label should be available");
assert(manager.canPasteSectionSnapshot("program", { sectionId: "program2" }, { ...labels, program2: true }), "program snapshot should paste into program section");
assert(manager.canPasteSectionSnapshot("process", { sectionId: "process2" }, { ...labels, process2: true }), "process snapshot should paste into process section");
assert(manager.canPasteSectionSnapshot("history", { sectionId: "history2" }, { ...labels, history2: true }), "history snapshot should paste into history section");
assert(manager.canPasteSectionSnapshot("facility", { sectionId: "essential2" }, { ...labels, essential2: true }), "essential snapshot should paste into essential section");
assert(manager.normalizeSectionId("missing", labels) === "greeting", "unknown section id should fall back to greeting");
assert(manager.canPasteSectionSnapshot("greeting2", { sectionId: "greeting" }, labels), "greeting snapshot should paste into greeting section");
assert(!manager.canPasteSectionSnapshot("mainIntro", { sectionId: "greeting" }, labels), "greeting snapshot should not paste into main intro section");
assert(manager.getClipboardPasteLabel({ sectionId: "mainIntro", label: "메인 소개" }) === "메인 소개 붙여넣기", "main intro paste label should be direct paste");
assert(manager.getClipboardPasteLabel({ sectionId: "greeting", label: "대표자 인사말" }) === "대표자 인사말 새 섹션으로 붙여넣기", "greeting paste label should describe new section paste");
assert(manager.getInsertIndexForSlot("top", null, order, ["mainIntro", "greeting"]) === 0, "top insert should use index 0");
assert(manager.getInsertIndexForSlot("between", null, order, ["mainIntro", "greeting"]) === order.indexOf("greeting"), "between insert should target second visible section");
assert(manager.placeSectionInOrder("greeting2", "top", null, order, ["mainIntro", "greeting"]).at(0) === "greeting2", "placeSectionInOrder should move existing section");

const labelsWithFooter = { mainIntro: "메인", greeting: "인사말", program: "프로그램", footer: "하단 정보" };
assert(
  Array.from(manager.normalizeSectionOrder(["footer", "mainIntro", "greeting", "program"], labelsWithFooter)).join(",") === "mainIntro,greeting,program,footer",
  "footer should always normalize to the final document position"
);
assert(
  Array.from(manager.placeSectionInOrder("program", "bottom", null, ["mainIntro", "greeting", "footer"], ["mainIntro", "greeting", "footer"])).join(",") === "mainIntro,greeting,program,footer",
  "new sections should be inserted before footer"
);
assert(
  Array.from(manager.placeSectionInOrder("footer", "top", 0, ["mainIntro", "greeting", "footer"], ["mainIntro", "greeting", "footer"])).join(",") === "mainIntro,greeting,footer",
  "footer moves should remain pinned to the final position"
);

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("section manager tests OK");
}
