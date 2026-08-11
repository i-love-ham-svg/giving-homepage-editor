(function () {
  "use strict";

  function clone(value) {
    return typeof structuredClone === "function"
      ? structuredClone(value)
      : JSON.parse(JSON.stringify(value));
  }

  function getByteLength(value) {
    try {
      return new Blob([value]).size;
    } catch (error) {
      return String(value ?? "").length * 2;
    }
  }

  function removeLegacyGreetingImageDuplicates(saved) {
    const canonicalSections = saved.document?.sections;
    const hasCanonicalSections = Array.isArray(canonicalSections) && canonicalSections.length > 0;
    const hasCanonicalGreeting = hasCanonicalSections
      && canonicalSections.some((section) => section.type === "greeting" && section.content?.assets);
    if (hasCanonicalGreeting && saved.assets) {
      saved.assets.photoDataUrl = null;
      saved.assets.photoRemovedDataUrl = null;
      saved.assets.photoStrongRemovedDataUrl = null;
      saved.assets.photoManualDataUrl = null;
      saved.assets.signatureDataUrl = null;
      saved.assets.sealDataUrl = null;
    }
    if (hasCanonicalSections && saved.content) {
      delete saved.content.mainIntroSections;
      delete saved.content.greetingSections;
      delete saved.content.programSections;
      delete saved.content.processSections;
      delete saved.content.historySections;
      delete saved.content.donationSections;
      delete saved.content.gallerySections;
      delete saved.content.essentialSections;
      if (saved.document?.globals?.homeMenu?.logo?.dataUrl && saved.content.homeMenu?.logo) {
        saved.content.homeMenu.logo.dataUrl = null;
      }
    }
    if (saved.document?.globals?.background?.imageDataUrl && saved.assets) {
      saved.assets.backgroundImageDataUrl = null;
    }
    saved.storage = {
      ...saved.storage,
      legacyGreetingImagesDeduped: hasCanonicalGreeting,
      legacySectionCopiesRemoved: hasCanonicalSections
    };
    return saved;
  }

  function isEqualValue(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  function removeCanonicalViewportEntries(savedMap, sections, field) {
    if (!savedMap || typeof savedMap !== "object") return null;
    const residual = clone(savedMap);
    const viewportKeys = new Set(Object.keys(residual).filter((key) => key !== "mobile"));
    sections.forEach((section) => {
      Object.keys(section?.[field] ?? {}).forEach((key) => {
        if (key !== "mobile") viewportKeys.add(key);
      });
    });

    viewportKeys.forEach((viewport) => {
      const target = residual[viewport];
      if (!target || typeof target !== "object") return;
      sections.forEach((section) => {
        Object.entries(section?.[field]?.[viewport] ?? {}).forEach(([id, value]) => {
          if (isEqualValue(target[id], value)) delete target[id];
        });
      });
      if (Object.keys(target).length === 0) delete residual[viewport];
    });

    if (residual.mobile && isEqualValue(residual.mobile, savedMap.phone)) delete residual.mobile;
    return Object.keys(residual).length ? residual : null;
  }

  function removeDocumentMobileAliases(document) {
    (document?.sections ?? []).forEach((section) => {
      [section.layouts, section.textStyles].forEach((viewportMap) => {
        if (viewportMap?.mobile && isEqualValue(viewportMap.mobile, viewportMap.phone)) {
          delete viewportMap.mobile;
        }
      });
    });
  }

  function compactForRemotePublish(saved) {
    const compactSaved = clone(saved);
    const canonicalSections = compactSaved.document?.sections;
    if (!Array.isArray(canonicalSections) || canonicalSections.length === 0) return compactSaved;

    compactSaved.layouts = removeCanonicalViewportEntries(compactSaved.layouts, canonicalSections, "layouts");
    compactSaved.textStyles = removeCanonicalViewportEntries(compactSaved.textStyles, canonicalSections, "textStyles");
    if (!compactSaved.layouts) delete compactSaved.layouts;
    if (!compactSaved.textStyles) delete compactSaved.textStyles;

    removeDocumentMobileAliases(compactSaved.document);
    removeLegacyGreetingImageDuplicates(compactSaved);

    if (compactSaved.document?.globals?.theme && isEqualValue(compactSaved.theme, compactSaved.document.globals.theme)) {
      delete compactSaved.theme;
    }
    if (compactSaved.content) {
      delete compactSaved.content.activeSection;
      delete compactSaved.content.sectionOrder;
      delete compactSaved.content.homeMenu;
      delete compactSaved.content.sectionAppearances;
    }

    compactSaved.storage = {
      ...compactSaved.storage,
      remoteCanonicalSnapshot: true,
      estimatedBytesAfter: 0
    };
    for (let index = 0; index < 5; index += 1) {
      const nextEstimate = getByteLength(JSON.stringify(compactSaved));
      if (compactSaved.storage.estimatedBytesAfter === nextEstimate) break;
      compactSaved.storage.estimatedBytesAfter = nextEstimate;
    }
    return compactSaved;
  }

  function stripAssetImageData(asset, fields) {
    if (!asset) return asset;
    const next = { ...asset };
    fields.forEach((field) => {
      if (field in next) next[field] = null;
    });
    return next;
  }

  function stripImageDataForCompactSave(saved) {
    const compactSaved = clone(saved);
    compactSaved.assets = compactSaved.assets ?? {};
    [
      "backgroundImageDataUrl",
      "photoDataUrl",
      "photoRemovedDataUrl",
      "photoStrongRemovedDataUrl",
      "photoManualDataUrl",
      "signatureDataUrl",
      "sealDataUrl"
    ].forEach((field) => {
      compactSaved.assets[field] = null;
    });

    (compactSaved.content?.greetingSections ?? []).forEach((section) => {
      if (!section.content?.assets) return;
      section.content.assets.photo = stripAssetImageData(section.content.assets.photo, [
        "dataUrl",
        "removedDataUrl",
        "strongRemovedDataUrl",
        "manualDataUrl"
      ]);
      section.content.assets.signature = stripAssetImageData(section.content.assets.signature, ["dataUrl"]);
      section.content.assets.seal = stripAssetImageData(section.content.assets.seal, ["dataUrl"]);
    });

    (compactSaved.document?.sections ?? []).forEach((section) => {
      if (section.type === "greeting" && section.content?.assets) {
        section.content.assets.photo = stripAssetImageData(section.content.assets.photo, [
          "dataUrl",
          "removedDataUrl",
          "strongRemovedDataUrl",
          "manualDataUrl"
        ]);
        section.content.assets.signature = stripAssetImageData(section.content.assets.signature, ["dataUrl"]);
        section.content.assets.seal = stripAssetImageData(section.content.assets.seal, ["dataUrl"]);
      }
      if (section.type === "program") {
        (section.content?.cards ?? []).forEach((card) => {
          if (card.image?.dataUrl) card.image.dataUrl = null;
        });
      }
      if (section.type === "history") {
        (section.content?.groups ?? []).forEach((group) => {
          (group.events ?? []).forEach((event) => {
            if (event.image?.dataUrl) event.image.dataUrl = null;
          });
        });
      }
      if (section.type === "gallery") {
        (section.content?.items ?? []).forEach((item) => {
          if (item.image?.dataUrl) item.image.dataUrl = null;
        });
      }
    });

    if (compactSaved.document?.globals?.background) {
      compactSaved.document.globals.background.imageDataUrl = null;
    }
    if (compactSaved.document?.globals?.homeMenu?.logo) {
      compactSaved.document.globals.homeMenu.logo.dataUrl = null;
    }
    if (compactSaved.content?.homeMenu?.logo) compactSaved.content.homeMenu.logo.dataUrl = null;

    compactSaved.storage = {
      ...compactSaved.storage,
      imagesOmitted: true,
      estimatedBytesAfter: 0
    };

    for (let index = 0; index < 5; index += 1) {
      const nextEstimate = getByteLength(JSON.stringify(compactSaved));
      if (compactSaved.storage.estimatedBytesAfter === nextEstimate) break;
      compactSaved.storage.estimatedBytesAfter = nextEstimate;
    }

    return compactSaved;
  }

  window.EditorStorageManager = Object.freeze({
    compactForRemotePublish,
    getByteLength,
    removeLegacyGreetingImageDuplicates,
    stripImageDataForCompactSave
  });
})();
