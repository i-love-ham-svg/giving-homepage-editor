(function () {
  "use strict";

  const PARTS = Object.freeze(["title", "body", "photo", "identity", "signature", "seal"]);
  const BASE_LAYER_IDS = Object.freeze([...PARTS]);
  const TEXT_STYLE_PARTS = Object.freeze(["title", "body", "identity"]);

  const PART_LABELS = Object.freeze({
    title: "제목 영역",
    body: "본문 영역",
    photo: "대표자 사진",
    identity: "텍스트 상자",
    signature: "대표자 서명",
    seal: "기관 직인"
  });

  function isSection(sectionId) {
    return sectionId === "greeting" || /^greeting\d+$/.test(String(sectionId));
  }

  function toLayerSuffix(part) {
    return `${part[0].toUpperCase()}${part.slice(1)}`;
  }

  function fromLayerSuffix(suffix) {
    const part = `${suffix[0].toLowerCase()}${suffix.slice(1)}`;
    return PARTS.includes(part) ? part : "";
  }

  function getLayerIds(sectionId = "greeting") {
    if (sectionId === "greeting") return [...BASE_LAYER_IDS];
    return PARTS.map((part) => `${sectionId}${toLayerSuffix(part)}`);
  }

  function getLayerId(sectionId = "greeting", part = "title") {
    const ids = getLayerIds(sectionId);
    const index = PARTS.indexOf(part);
    return ids[index] ?? ids[0];
  }

  function getLayerPart(layerId) {
    if (PARTS.includes(layerId)) return layerId;
    const match = String(layerId).match(/^(greeting\d+)([A-Z][A-Za-z]+)$/);
    return match ? fromLayerSuffix(match[2]) : "";
  }

  function getSectionIdForLayer(layerId) {
    if (PARTS.includes(layerId)) return "greeting";
    const match = String(layerId).match(/^(greeting\d+)([A-Z][A-Za-z]+)$/);
    return match && fromLayerSuffix(match[2]) ? match[1] : null;
  }

  function getPartLabel(part) {
    return PART_LABELS[part] ?? "영역";
  }

  function getLayerLabel(sectionLabel, part) {
    return `${sectionLabel} ${getPartLabel(part)}`;
  }

  function isTextStylePart(part) {
    return TEXT_STYLE_PARTS.includes(part);
  }

  function cloneViewportMap(source, fromSectionId, toSectionId, viewportKeys = []) {
    const sourceIds = getLayerIds(fromSectionId);
    const targetIds = getLayerIds(toSectionId);
    const result = {};
    viewportKeys.forEach((viewport) => {
      result[viewport] = {};
      targetIds.forEach((targetId, index) => {
        const value = source?.[viewport]?.[sourceIds[index]]
          ?? source?.[viewport]?.[BASE_LAYER_IDS[index]];
        if (value) result[viewport][targetId] = structuredClone(value);
      });
    });
    if (result.phone) result.mobile = result.phone;
    return result;
  }

  window.EditorGreetingManager = Object.freeze({
    BASE_LAYER_IDS,
    PARTS,
    TEXT_STYLE_PARTS,
    cloneViewportMap,
    getLayerId,
    getLayerIds,
    getLayerLabel,
    getLayerPart,
    getPartLabel,
    getSectionIdForLayer,
    isSection,
    isTextStylePart
  });
})();
