import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const schemaPath = resolve("outputs", "editor-storage-schema.js");
const source = readFileSync(schemaPath, "utf8");
const context = {
  Blob,
  structuredClone,
  window: {}
};

vm.createContext(context);
vm.runInContext(source, context, { filename: schemaPath });
const storageManagerPath = resolve("outputs", "editor-storage-manager.js");
vm.runInContext(readFileSync(storageManagerPath, "utf8"), context, { filename: storageManagerPath });

const schema = context.window.EditorStorageSchema;
const storageManager = context.window.EditorStorageManager;
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

assert(schema?.SCHEMA_VERSION === 5, "schema version should be 5");
assert(schema.normalizeSectionId({ id: "greeting77", type: "greeting" }) === "greeting77", "greeting section id should be preserved");
assert(schema.normalizeSectionId({ id: "mainIntro9", type: "mainIntro" }) === "mainIntro9", "main intro section id should be preserved");
assert(schema.normalizeSectionId({ id: "program4", type: "program" }) === "program4", "program section id should be preserved");
assert(schema.normalizeSectionId({ id: "process4", type: "process" }) === "process4", "process section id should be preserved");
assert(schema.normalizeSectionId({ id: "history4", type: "history" }) === "history4", "history section id should be preserved");
assert(schema.normalizeSectionId({ id: "facility", type: "essential" }) === "facility", "base essential section id should be preserved");
assert(schema.normalizeSectionId({ id: "essential4", type: "essential" }) === "essential4", "duplicated essential section id should be preserved");

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

const essentialSaved = schema.hydrateLegacyContentFromSectionDocument({
  document: {
    sectionOrder: ["facility", "footer"],
    sections: [
      { id: "facility", type: "essential", content: { template: "facility", headline: "시설현황" } },
      { id: "footer", type: "essential", content: { template: "footer", headline: "하단 정보" } }
    ]
  }
});
assert(essentialSaved.content.essentialSections.length === 2, "essential sections should hydrate from section array");
assert(essentialSaved.content.sectionOrder.join(",") === "facility,footer", "essential section order should be preserved");

const canonicalSections = [
  {
    id: "mainIntro",
    type: "mainIntro",
    label: "메인 소개",
    hidden: false,
    content: { headline: "송악사회복지관", body: "지역주민과 함께합니다." },
    layouts: {
      desktop: { mainIntro: { x: 0, y: 0, w: 1360, h: 900 } },
      phone: { mainIntro: { x: 0, y: 0, w: 390, h: 1100 } },
      mobile: { mainIntro: { x: 0, y: 0, w: 390, h: 1100 } }
    },
    textStyles: {
      desktop: { mainIntroTitle: { size: 72 } },
      phone: { mainIntroTitle: { size: 38 } },
      mobile: { mainIntroTitle: { size: 38 } }
    }
  },
  {
    id: "gallery",
    type: "gallery",
    label: "갤러리",
    hidden: false,
    content: { headline: "복지관에서는 어떤 일이?", items: [{ id: "gallery-1", image: { dataUrl: "/assets/gallery.webp" } }] },
    layouts: { desktop: { gallery: { x: 0, y: 0, w: 1360, h: 1200 } } },
    textStyles: { desktop: { galleryTitle: { size: 64 } } }
  },
  {
    id: "footer",
    type: "essential",
    label: "하단 정보",
    hidden: false,
    content: { template: "footer", organization: "송악사회복지관" },
    layouts: { desktop: { footer: { x: 0, y: 0, w: 1360, h: 320 } } },
    textStyles: { desktop: { footerTitle: { size: 42 } } }
  }
];
const remoteSource = {
  schemaVersion: 5,
  savedAt: "2026-08-11T00:00:00.000Z",
  responsive: { viewportOrder: ["desktop", "phone", "tablet"] },
  layouts: {
    desktop: {
      mainIntro: { x: 0, y: 0, w: 1360, h: 900 },
      gallery: { x: 0, y: 0, w: 1360, h: 1200 },
      footer: { x: 0, y: 0, w: 1360, h: 320 },
      globalOverlay: { x: 9, y: 8, w: 7, h: 6 }
    },
    phone: { mainIntro: { x: 0, y: 0, w: 390, h: 1100 } },
    mobile: { mainIntro: { x: 0, y: 0, w: 390, h: 1100 } }
  },
  textStyles: {
    desktop: {
      mainIntroTitle: { size: 72 },
      galleryTitle: { size: 64 },
      footerTitle: { size: 42 },
      globalOverlayText: { size: 14 }
    },
    phone: { mainIntroTitle: { size: 38 } },
    mobile: { mainIntroTitle: { size: 38 } }
  },
  theme: { primary: "#14543d" },
  assets: { backgroundMode: "default", photoDataUrl: null },
  content: {
    activeSection: "gallery",
    sectionOrder: ["mainIntro", "gallery", "footer"],
    hiddenSections: { mainIntro: false, gallery: false, footer: false },
    detailPresentationVersion: 8,
    nextMainIntroId: 2,
    nextGalleryId: 2,
    nextEssentialId: 9,
    pageDecorationModel: { cards: [{ id: "decoration-1" }], decorations: [], nextDecorationId: 2 },
    homeMenu: { brand: "송악사회복지관" },
    sectionAppearances: { gallery: { background: "#f7f2fb" } },
    mainIntroSections: [{ sectionId: "mainIntro", content: canonicalSections[0].content }],
    gallerySections: [{ sectionId: "gallery", content: canonicalSections[1].content }],
    essentialSections: [{ sectionId: "footer", content: canonicalSections[2].content }]
  },
  document: {
    schemaVersion: 5,
    activeSectionId: "gallery",
    sectionOrder: ["mainIntro", "gallery", "footer"],
    sections: canonicalSections,
    globals: {
      theme: { primary: "#14543d" },
      background: { mode: "default", color: "#ffffff" },
      homeMenu: { brand: "송악사회복지관" },
      sectionAppearances: { gallery: { background: "#f7f2fb" } }
    }
  },
  storage: { imagesOmitted: false }
};
const compactRemote = storageManager.compactForRemotePublish(remoteSource);
assert(!compactRemote.content.mainIntroSections, "remote compact should remove duplicated main intro sections");
assert(!compactRemote.content.gallerySections, "remote compact should remove duplicated gallery sections");
assert(!compactRemote.content.essentialSections, "remote compact should remove duplicated essential sections");
assert(!compactRemote.content.homeMenu, "remote compact should remove duplicated home menu");
assert(!compactRemote.content.sectionAppearances, "remote compact should remove duplicated section appearances");
assert(compactRemote.content.pageDecorationModel.cards.length === 1, "remote compact should preserve page decorations");
assert(compactRemote.content.detailPresentationVersion === 8, "remote compact should preserve detail presentation version");
assert(compactRemote.layouts.desktop.globalOverlay.w === 7, "remote compact should preserve non-section layout entries");
assert(!compactRemote.layouts.desktop.mainIntro, "remote compact should remove canonical layout duplicates");
assert(compactRemote.textStyles.desktop.globalOverlayText.size === 14, "remote compact should preserve non-section text styles");
assert(!compactRemote.document.sections[0].layouts.mobile, "remote compact should remove the phone mobile layout alias");
assert(!compactRemote.document.sections[0].textStyles.mobile, "remote compact should remove the phone mobile style alias");
assert(JSON.stringify(compactRemote.document.sections.map((section) => section.content)) === JSON.stringify(canonicalSections.map((section) => section.content)), "remote compact should preserve all canonical section content");
assert(compactRemote.storage.remoteCanonicalSnapshot === true, "remote compact should identify the canonical remote format");

const compactHydrated = schema.hydrateLegacyContentFromSectionDocument(structuredClone(compactRemote), {
  viewportKeys: ["desktop", "phoneSmall", "phone", "tablet"]
});
assert(compactHydrated.content.activeSection === "gallery", "compact remote should hydrate the active section");
assert(compactHydrated.content.sectionOrder.join(",") === "mainIntro,gallery,footer", "compact remote should hydrate the section order");
assert(compactHydrated.content.mainIntroSections[0].content.headline === "송악사회복지관", "compact remote should hydrate main intro content");
assert(compactHydrated.content.gallerySections[0].content.items[0].image.dataUrl === "/assets/gallery.webp", "compact remote should hydrate gallery images");
assert(compactHydrated.content.essentialSections[0].content.organization === "송악사회복지관", "compact remote should hydrate the footer");
assert(compactHydrated.layouts.desktop.mainIntro.w === 1360, "compact remote should hydrate canonical desktop layouts");
assert(compactHydrated.layouts.desktop.globalOverlay.w === 7, "compact remote should retain residual desktop layouts");
assert(compactHydrated.layouts.mobile === compactHydrated.layouts.phone, "compact remote should recreate the mobile layout alias");
assert(compactHydrated.textStyles.desktop.galleryTitle.size === 64, "compact remote should hydrate canonical text styles");
assert(compactHydrated.document.globals.sectionAppearances.gallery.background === "#f7f2fb", "compact remote should preserve section appearance globals");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("storage schema tests OK");
}
