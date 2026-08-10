(function () {
  "use strict";

  const SCHEMA_VERSION = 5;

  function clone(value) {
    return typeof structuredClone === "function"
      ? structuredClone(value)
      : JSON.parse(JSON.stringify(value));
  }

  function isMainIntroSection(sectionId) {
    return sectionId === "mainIntro" || /^mainIntro\d+$/.test(String(sectionId));
  }

  function isGreetingSection(sectionId) {
    return sectionId === "greeting" || /^greeting\d+$/.test(String(sectionId));
  }

  function isProgramSection(sectionId) {
    return sectionId === "program" || /^program\d+$/.test(String(sectionId));
  }

  function isProcessSection(sectionId) {
    return sectionId === "process" || /^process\d+$/.test(String(sectionId));
  }

  function isHistorySection(sectionId) {
    return sectionId === "history" || /^history\d+$/.test(String(sectionId));
  }

  function isDonationSection(sectionId) {
    return sectionId === "donation" || /^donation\d+$/.test(String(sectionId));
  }

  function isGallerySection(sectionId) {
    return sectionId === "gallery" || /^gallery\d+$/.test(String(sectionId));
  }

  function isEssentialSection(sectionId) {
    return ["facility", "organization", "location", "volunteer", "notice", "schedule", "footer"].includes(String(sectionId))
      || /^essential\d+$/.test(String(sectionId));
  }

  function normalizeSectionType(section = {}, id = "") {
    const type = section.type ?? section.kind;
    if (type === "mainIntro" || type === "greeting" || type === "program" || type === "process" || type === "history" || type === "donation" || type === "gallery" || type === "essential") return type;
    if (isMainIntroSection(id)) return "mainIntro";
    if (isProgramSection(id)) return "program";
    if (isProcessSection(id)) return "process";
    if (isHistorySection(id)) return "history";
    if (isDonationSection(id)) return "donation";
    if (isGallerySection(id)) return "gallery";
    if (isEssentialSection(id)) return "essential";
    return "greeting";
  }

  function normalizeSectionId(section = {}, index = 0) {
    const rawId = section.id ?? section.sectionId;
    if (isMainIntroSection(rawId) || isGreetingSection(rawId) || isProgramSection(rawId) || isProcessSection(rawId) || isHistorySection(rawId) || isDonationSection(rawId) || isGallerySection(rawId) || isEssentialSection(rawId)) return String(rawId);
    const type = normalizeSectionType(section, rawId);
    if (type === "mainIntro") return index === 0 ? "mainIntro" : `mainIntro${index + 1}`;
    if (type === "program") return index === 0 ? "program" : `program${index + 1}`;
    if (type === "process") return index === 0 ? "process" : `process${index + 1}`;
    if (type === "history") return index === 0 ? "history" : `history${index + 1}`;
    if (type === "donation") return index === 0 ? "donation" : `donation${index + 1}`;
    if (type === "gallery") return index === 0 ? "gallery" : `gallery${index + 1}`;
    if (type === "essential") return `essential${index + 1}`;
    return index === 0 ? "greeting" : `greeting${index + 1}`;
  }

  function normalizeOrderId(sectionId) {
    if (isMainIntroSection(sectionId) || isGreetingSection(sectionId) || isProgramSection(sectionId) || isProcessSection(sectionId) || isHistorySection(sectionId) || isDonationSection(sectionId) || isGallerySection(sectionId) || isEssentialSection(sectionId)) return String(sectionId);
    return "greeting";
  }

  function createSectionEntry(snapshot, hidden = false) {
    return {
      id: snapshot.sectionId,
      type: snapshot.kind,
      label: snapshot.label,
      hidden: Boolean(hidden),
      content: snapshot.content,
      layouts: snapshot.layouts,
      textStyles: snapshot.textStyles
    };
  }

  function createDocumentSnapshot(options = {}) {
    return {
      schemaVersion: options.schemaVersion ?? SCHEMA_VERSION,
      activeSectionId: options.activeSectionId ?? "greeting",
      sectionOrder: [...(options.sectionOrder ?? [])],
      sections: (options.sections ?? []).map((section) => clone(section)),
      globals: clone(options.globals ?? {})
    };
  }

  function getSavedSectionArray(saved = {}) {
    const sections = saved.document?.sections ?? saved.sections;
    return Array.isArray(sections) ? sections : null;
  }

  function mergeViewportLayerMap(target, source, options = {}) {
    const viewportKeys = options.viewportKeys ?? Object.keys(source ?? {}).filter((key) => key !== "mobile");
    viewportKeys.forEach((viewport) => {
      target[viewport] = target[viewport] ?? {};
      Object.entries(source?.[viewport] ?? {}).forEach(([id, value]) => {
        target[viewport][id] = clone(value);
      });
    });
    if (target.phone) target.mobile = target.phone;
  }

  function hydrateLegacyContentFromSectionDocument(saved = {}, options = {}) {
    const sections = getSavedSectionArray(saved);
    if (!sections) return saved;

    const next = saved;
    next.content = next.content ?? {};
    const normalizedSections = sections.map((section, index) => {
      const id = normalizeSectionId(section, index);
      return {
        id,
        type: normalizeSectionType(section, id),
        label: section.label,
        hidden: Boolean(section.hidden),
        content: section.content ?? {},
        layouts: section.layouts,
        textStyles: section.textStyles
      };
    });

    const documentOrder = saved.document?.sectionOrder ?? saved.sectionOrder;
    next.content.sectionOrder = Array.isArray(documentOrder) && documentOrder.length
      ? documentOrder.map(normalizeOrderId)
      : normalizedSections.map((section) => section.id);
    next.content.activeSection = normalizeOrderId(saved.document?.activeSectionId ?? saved.activeSectionId ?? next.content.activeSection ?? "greeting");
    next.content.mainIntroSections = normalizedSections
      .filter((section) => section.type === "mainIntro")
      .map((section) => ({
        sectionId: section.id,
        label: section.label,
        hidden: section.hidden,
        content: section.content
      }));
    next.content.greetingSections = normalizedSections
      .filter((section) => section.type === "greeting")
      .map((section) => ({
        sectionId: section.id,
        label: section.label,
        hidden: section.hidden,
        content: section.content
      }));
    next.content.programSections = normalizedSections
      .filter((section) => section.type === "program")
      .map((section) => ({
        sectionId: section.id,
        label: section.label,
        hidden: section.hidden,
        content: section.content
      }));
    next.content.processSections = normalizedSections
      .filter((section) => section.type === "process")
      .map((section) => ({
        sectionId: section.id,
        label: section.label,
        hidden: section.hidden,
        content: section.content
      }));
    next.content.historySections = normalizedSections
      .filter((section) => section.type === "history")
      .map((section) => ({
        sectionId: section.id,
        label: section.label,
        hidden: section.hidden,
        content: section.content
      }));
    next.content.donationSections = normalizedSections
      .filter((section) => section.type === "donation")
      .map((section) => ({
        sectionId: section.id,
        label: section.label,
        hidden: section.hidden,
        content: section.content
      }));
    next.content.gallerySections = normalizedSections
      .filter((section) => section.type === "gallery")
      .map((section) => ({
        sectionId: section.id,
        label: section.label,
        hidden: section.hidden,
        content: section.content
      }));
    next.content.essentialSections = normalizedSections
      .filter((section) => section.type === "essential")
      .map((section) => ({
        sectionId: section.id,
        label: section.label,
        hidden: section.hidden,
        content: section.content
      }));

    const mergedLayouts = clone(next.layouts ?? {});
    const mergedTextStyles = clone(next.textStyles ?? {});
    normalizedSections.forEach((section) => {
      mergeViewportLayerMap(mergedLayouts, section.layouts, options);
      mergeViewportLayerMap(mergedTextStyles, section.textStyles, options);
    });
    next.layouts = mergedLayouts;
    next.textStyles = mergedTextStyles;

    if (saved.document?.globals?.theme && !next.theme) next.theme = saved.document.globals.theme;
    return next;
  }

  window.EditorStorageSchema = Object.freeze({
    SCHEMA_VERSION,
    createDocumentSnapshot,
    createSectionEntry,
    getSavedSectionArray,
    hydrateLegacyContentFromSectionDocument,
    isGreetingSection,
    isDonationSection,
    isEssentialSection,
    isHistorySection,
    isGallerySection,
    isMainIntroSection,
    isProgramSection,
    isProcessSection,
    mergeViewportLayerMap,
    normalizeSectionId,
    normalizeSectionType
  });
})();
