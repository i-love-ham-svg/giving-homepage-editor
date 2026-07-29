(function () {
  "use strict";

  const PARTS = Object.freeze([
    "Kicker",
    "Title",
    "Body",
    "VisualEyebrow",
    "VisualTitle",
    "VisualCaption",
    "RightText"
  ]);

  const BASE_LAYER_IDS = Object.freeze(PARTS.map((part) => `mainIntro${part}`));
  const ANCHOR_PARTS = Object.freeze(["Kicker", "Title", "Body"]);
  const FLOATING_PARTS = Object.freeze(["RightText", "VisualEyebrow", "VisualTitle", "VisualCaption"]);

  const PART_LABELS = Object.freeze({
    Kicker: "라벨",
    Title: "제목",
    Body: "본문",
    VisualEyebrow: "장식 라벨",
    VisualTitle: "장식 제목",
    VisualCaption: "장식 문구",
    RightText: "오른쪽 텍스트"
  });

  const partPattern = PARTS.join("|");

  function isSection(sectionId) {
    return sectionId === "mainIntro" || /^mainIntro\d+$/.test(String(sectionId));
  }

  function getLayerPrefix(sectionId = "mainIntro") {
    return sectionId === "mainIntro" ? "mainIntro" : String(sectionId);
  }

  function getLayerId(sectionId = "mainIntro", part = "Kicker") {
    return `${getLayerPrefix(sectionId)}${part}`;
  }

  function getLayerIds(sectionId = "mainIntro") {
    if (sectionId === "mainIntro") return [...BASE_LAYER_IDS];
    return PARTS.map((part) => getLayerId(sectionId, part));
  }

  function getLayerPart(layerId) {
    const match = String(layerId).match(new RegExp(`^mainIntro(?:\\d+)?(${partPattern})$`));
    return match ? match[1] : "";
  }

  function getBaseLayerId(layerId) {
    const part = getLayerPart(layerId);
    return part ? `mainIntro${part}` : layerId;
  }

  function getRightTextLayerId(sectionId = "mainIntro") {
    return getLayerId(sectionId, "RightText");
  }

  function getPartLabel(part) {
    return PART_LABELS[part] ?? "텍스트";
  }

  function getLayerLabel(sectionLabel, part) {
    return `${sectionLabel} ${getPartLabel(part)}`;
  }

  function getPartLayerMap(sectionId = "mainIntro") {
    return getLayerIds(sectionId).reduce((map, id) => {
      map[getLayerPart(id)] = id;
      return map;
    }, {});
  }

  function getResponsiveItems(flow) {
    if (!flow) return [];
    if (flow.mode === "columns") {
      return flow.columns.flatMap((column) => column.items.map((item) => ({ ...item, column })));
    }
    return flow.items.map((item) => ({ ...item, column: flow }));
  }

  function getFlowItem(flow, part) {
    return getResponsiveItems(flow).find((item) => item.part === part) ?? null;
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

  window.EditorMainIntroManager = Object.freeze({
    ANCHOR_PARTS,
    BASE_LAYER_IDS,
    FLOATING_PARTS,
    PARTS,
    cloneViewportMap,
    getBaseLayerId,
    getFlowItem,
    getLayerId,
    getLayerIds,
    getLayerLabel,
    getLayerPart,
    getPartLabel,
    getPartLayerMap,
    getResponsiveItems,
    getRightTextLayerId,
    isSection
  });
})();
