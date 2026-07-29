import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const managerPath = resolve("outputs", "editor-storage-manager.js");
const source = readFileSync(managerPath, "utf8");
const context = {
  Blob,
  structuredClone,
  window: {}
};

vm.createContext(context);
vm.runInContext(source, context, { filename: managerPath });

const manager = context.window.EditorStorageManager;
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

assert(typeof manager?.getByteLength === "function", "getByteLength should be exported");
assert(manager.getByteLength("abc") === 3, "getByteLength should use Blob byte length when available");

const saved = {
  assets: {
    backgroundImageDataUrl: "bg",
    photoDataUrl: "photo",
    signatureDataUrl: "signature",
    sealDataUrl: "seal"
  },
  content: {
    greetingSections: [{
      sectionId: "greeting",
      content: {
        assets: {
          photo: {
            dataUrl: "p",
            removedDataUrl: "r",
            strongRemovedDataUrl: "sr",
            manualDataUrl: "m",
            name: "photo.png"
          },
          signature: { dataUrl: "s", name: "signature.png" },
          seal: { dataUrl: "seal", name: "seal.png" }
        }
      }
    }]
  },
  document: {
    globals: {
      background: { imageDataUrl: "bg" },
      homeMenu: { logo: { dataUrl: "logo", name: "logo.png" } }
    },
    sections: [{
      id: "greeting",
      type: "greeting",
      content: {
        assets: {
          photo: { dataUrl: "p", name: "photo.png" },
          signature: { dataUrl: "s", name: "signature.png" },
          seal: { dataUrl: "seal", name: "seal.png" }
        }
      }
    }]
  },
  storage: {}
};

manager.removeLegacyGreetingImageDuplicates(saved);
assert(saved.assets.photoDataUrl === null, "legacy photo data should be removed when canonical greeting assets exist");
assert(saved.assets.signatureDataUrl === null, "legacy signature data should be removed when canonical greeting assets exist");
assert(saved.storage.legacyGreetingImagesDeduped === true, "legacy dedupe flag should be set");
assert(!("greetingSections" in saved.content), "legacy section arrays should be removed when canonical sections exist");
assert(saved.assets.backgroundImageDataUrl === null, "legacy background image should be removed when canonical background exists");

const compact = manager.stripImageDataForCompactSave(saved);
const greetingAssets = compact.document.sections[0].content.assets;
assert(compact.assets.backgroundImageDataUrl === null, "compact save should remove background image data");
assert(greetingAssets.photo.dataUrl === null, "compact save should remove nested photo data");
assert(greetingAssets.photo.name === "photo.png", "compact save should preserve nested photo metadata");
assert(greetingAssets.signature.dataUrl === null, "compact save should remove nested signature data");
assert(compact.storage.imagesOmitted === true, "compact save should set imagesOmitted");
assert(compact.document.globals.background.imageDataUrl === null, "compact save should remove canonical background image data");
assert(compact.document.globals.homeMenu.logo.dataUrl === null, "compact save should remove canonical logo image data");
assert(Number.isFinite(compact.storage.estimatedBytesAfter), "compact save should estimate storage size");

const largeDataUrl = `data:image/png;base64,${"A".repeat(750_000)}`;
const largeSaved = {
  schemaVersion: 3,
  layouts: {
    desktop: { title: { x: 1, y: 2, w: 3, h: 4 } },
    phone: { title: { x: 5, y: 6, w: 7, h: 8 } }
  },
  textStyles: {
    desktop: { title: { size: 42, color: "#111111", font: "serif" } },
    phone: { title: { size: 18, color: "#222222", font: "serif" } }
  },
  assets: {
    backgroundImageName: "large-background.png",
    backgroundImageDataUrl: largeDataUrl,
    photoName: "legacy-photo.png",
    photoDataUrl: largeDataUrl
  },
  content: {
    greetingSections: [{
      sectionId: "greeting",
      content: {
        title: "저장 안정성 테스트",
        assets: {
          photo: {
            name: "representative.png",
            dataUrl: largeDataUrl,
            manualDataUrl: largeDataUrl,
            naturalWidth: 2400,
            naturalHeight: 1600
          },
          signature: { name: "signature.png", dataUrl: largeDataUrl },
          seal: { name: "seal.png", dataUrl: largeDataUrl }
        }
      }
    }]
  },
  document: {
    globals: {
      background: { imageDataUrl: largeDataUrl },
      homeMenu: { logo: { name: "logo.png", dataUrl: largeDataUrl } }
    },
    sections: [{
      id: "greeting",
      type: "greeting",
      content: {
        title: "저장 안정성 테스트",
        assets: {
          photo: {
            name: "representative.png",
            dataUrl: largeDataUrl,
            manualDataUrl: largeDataUrl,
            naturalWidth: 2400,
            naturalHeight: 1600
          },
          signature: { name: "signature.png", dataUrl: largeDataUrl },
          seal: { name: "seal.png", dataUrl: largeDataUrl }
        }
      }
    }, {
      id: "program",
      type: "program",
      content: { cards: [{ image: { name: "program.png", dataUrl: largeDataUrl } }] }
    }, {
      id: "history",
      type: "history",
      content: { groups: [{ events: [{ image: { name: "history.png", dataUrl: largeDataUrl } }] }] }
    }]
  },
  storage: {}
};

const largeBefore = manager.getByteLength(JSON.stringify(largeSaved));
const largeCompact = manager.stripImageDataForCompactSave(largeSaved);
const largeAfter = manager.getByteLength(JSON.stringify(largeCompact));
assert(largeAfter < largeBefore * 0.15, "compact save should drastically reduce large image payloads");
assert(largeCompact.layouts.phone.title.x === 5, "compact save should preserve mobile layouts");
assert(largeCompact.textStyles.phone.title.size === 18, "compact save should preserve mobile text styles");
assert(largeCompact.assets.backgroundImageName === "large-background.png", "compact save should preserve background filename");
assert(largeCompact.document.sections[0].content.assets.photo.name === "representative.png", "compact save should preserve nested photo filename");
assert(largeCompact.document.sections[0].content.assets.photo.naturalWidth === 2400, "compact save should preserve nested photo metadata");
assert(largeCompact.document.sections[0].content.assets.photo.manualDataUrl === null, "compact save should remove nested manual cutout image data");
assert(largeCompact.document.sections[1].content.cards[0].image.dataUrl === null, "compact save should remove program image data");
assert(largeCompact.document.sections[2].content.groups[0].events[0].image.dataUrl === null, "compact save should remove history image data");
assert(largeCompact.storage.estimatedBytesAfter === largeAfter, "compact save byte estimate should match compact payload");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("storage manager tests OK");
}
