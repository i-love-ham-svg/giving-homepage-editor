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
  // Quick actions keep fixed operational behavior while their labels and
  // viewport typography move through the shared text/CTA toolbar contract.
  const CTA_REGISTRY = Object.freeze({
    program: Object.freeze({ part: "ProgramCta", label: "프로그램 찾기", toolbarLabel: "프로그램 찾기 CTA" }),
    consult: Object.freeze({ part: "ConsultCta", label: "상담·이용 문의", toolbarLabel: "상담·이용 문의 CTA" })
  });
  const CTA_KEYS = Object.freeze(Object.keys(CTA_REGISTRY));
  const BASE_CTA_IDS = Object.freeze(CTA_KEYS.map((key) => `mainIntro${CTA_REGISTRY[key].part}`));

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

  function getCtaId(sectionId = "mainIntro", key = "program") {
    const target = CTA_REGISTRY[key];
    return target ? `${getLayerPrefix(sectionId)}${target.part}` : "";
  }

  function getCtaIds(sectionId = "mainIntro") {
    return CTA_KEYS.map((key) => getCtaId(sectionId, key));
  }

  function getCtaKey(targetId) {
    const id = String(targetId);
    return CTA_KEYS.find((key) => new RegExp(`^mainIntro(?:\\d+)?${CTA_REGISTRY[key].part}$`).test(id)) ?? "";
  }

  function getBaseCtaId(targetId) {
    const key = getCtaKey(targetId);
    return key ? `mainIntro${CTA_REGISTRY[key].part}` : targetId;
  }

  function getCtaLabel(key) {
    return CTA_REGISTRY[key]?.label ?? "CTA";
  }

  function getCtaToolbarLabel(key) {
    return CTA_REGISTRY[key]?.toolbarLabel ?? "CTA";
  }

  function normalizeCtaContent(value = {}) {
    const source = value && typeof value === "object" ? value : {};
    return Object.fromEntries(CTA_KEYS.map((key) => {
      const entry = source[key];
      const rawLabel = entry && typeof entry === "object" ? entry.label : entry;
      return [key, { label: rawLabel == null ? CTA_REGISTRY[key].label : String(rawLabel) }];
    }));
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

  function cloneCtaViewportMap(source, fromSectionId, toSectionId, viewportKeys = []) {
    const sourceIds = getCtaIds(fromSectionId);
    const targetIds = getCtaIds(toSectionId);
    const result = {};
    viewportKeys.forEach((viewport) => {
      result[viewport] = {};
      targetIds.forEach((targetId, index) => {
        const value = source?.[viewport]?.[sourceIds[index]]
          ?? source?.[viewport]?.[BASE_CTA_IDS[index]];
        if (value) result[viewport][targetId] = structuredClone(value);
      });
    });
    if (result.phone) result.mobile = result.phone;
    return result;
  }

  window.EditorMainIntroManager = Object.freeze({
    ANCHOR_PARTS,
    BASE_CTA_IDS,
    BASE_LAYER_IDS,
    CTA_KEYS,
    CTA_REGISTRY,
    FLOATING_PARTS,
    PARTS,
    cloneCtaViewportMap,
    cloneViewportMap,
    getBaseLayerId,
    getBaseCtaId,
    getCtaId,
    getCtaIds,
    getCtaKey,
    getCtaLabel,
    getCtaToolbarLabel,
    getFlowItem,
    getLayerId,
    getLayerIds,
    getLayerLabel,
    getLayerPart,
    getPartLabel,
    getPartLayerMap,
    getResponsiveItems,
    getRightTextLayerId,
    isSection,
    normalizeCtaContent
  });
})();
