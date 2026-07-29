import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const schemaPath = resolve("outputs", "editor-storage-schema.js");
const source = readFileSync(schemaPath, "utf8");
const context = {
  structuredClone,
  window: {}
};

vm.createContext(context);
vm.runInContext(source, context, { filename: schemaPath });

const schema = context.window.EditorStorageSchema;
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

assert(schema?.SCHEMA_VERSION === 4, "schema version should be 4");
assert(schema.normalizeSectionId({ id: "greeting77", type: "greeting" }) === "greeting77", "greeting section id should be preserved");
assert(schema.normalizeSectionId({ id: "mainIntro9", type: "mainIntro" }) === "mainIntro9", "main intro section id should be preserved");
assert(schema.normalizeSectionId({ id: "program4", type: "program" }) === "program4", "program section id should be preserved");
assert(schema.normalizeSectionId({ id: "process4", type: "process" }) === "process4", "process section id should be preserved");
assert(schema.normalizeSectionId({ id: "history4", type: "history" }) === "history4", "history section id should be preserved");

const saved = schema.hydrateLegacyContentFromSectionDocument({
  schemaVersion: 3,
  document: {
    schemaVersion: 3,
    activeSectionId: "greeting77",
    sectionOrder: ["mainIntro", "greeting77"],
    sections: [{
      id: "greeting77",
      type: "greeting",
      hidden: false,
      content: { title: "공동 대표자 인사말" },
      layouts: { phone: { greeting77Title: { x: 1, y: 2, w: 3, h: 4 } } },
      textStyles: { phone: { greeting77Title: { size: 24 } } }
    }]
  }
}, { viewportKeys: ["desktop", "phoneSmall", "phone", "tablet"] });

assert(saved.content.activeSection === "greeting77", "activeSection should preserve unknown-but-valid greeting id");
assert(saved.content.greetingSections.some((section) => section.sectionId === "greeting77"), "greetingSections should include preserved greeting id");
assert(saved.layouts.phone.greeting77Title.w === 3, "phone layout should be merged from section array");
assert(saved.textStyles.phone.greeting77Title.size === 24, "phone text style should be merged from section array");

const programSaved = schema.hydrateLegacyContentFromSectionDocument({
  document: {
    sectionOrder: ["program"],
    sections: [{ id: "program", type: "program", content: { headline: "프로그램 소개", cards: [{ id: "card-1" }] } }]
  }
});
assert(programSaved.content.programSections[0].content.cards.length === 1, "program sections should hydrate from section array");

const processSaved = schema.hydrateLegacyContentFromSectionDocument({
  document: {
    sectionOrder: ["process"],
    sections: [{ id: "process", type: "process", content: { headline: "사례관리 과정", steps: [{ id: "step-1" }] } }]
  }
});
assert(processSaved.content.processSections[0].content.steps.length === 1, "process sections should hydrate from section array");

const historySaved = schema.hydrateLegacyContentFromSectionDocument({
  document: {
    sectionOrder: ["history"],
    sections: [{ id: "history", type: "history", content: { headline: "세부 연혁", groups: [{ id: "month-1" }] } }]
  }
});
assert(historySaved.content.historySections[0].content.groups.length === 1, "history sections should hydrate from section array");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("storage schema tests OK");
}
