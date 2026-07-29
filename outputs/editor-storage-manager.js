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
    getByteLength,
    removeLegacyGreetingImageDuplicates,
    stripImageDataForCompactSave
  });
})();
