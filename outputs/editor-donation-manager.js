(function () {
  "use strict";

  const VIEWPORTS = ["desktop", "phoneSmall", "phone", "tablet"];
  const HEIGHT_VERSION = 1;
  const LEGACY_ICONS = Object.freeze({
    recurring: { label: "정기후원", body: '<path d="M7 3v3M17 3v3M4 9h16M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/><path d="M12 18s-4-2.3-4-5a2.2 2.2 0 0 1 4-1.3A2.2 2.2 0 0 1 16 13c0 2.7-4 5-4 5z"/>' },
    handHeart: { label: "일시후원", body: '<path d="M12 9.5s-4.8-2.7-4.8-5.8A2.7 2.7 0 0 1 12 2a2.7 2.7 0 0 1 4.8 1.7C16.8 6.8 12 9.5 12 9.5z"/><path d="M3 14h4l3 2h4.5a1.5 1.5 0 0 1 0 3H9"/><path d="M3 13v7h4l4 2 9-5a1.6 1.6 0 0 0-1.6-2.8L14 16"/>' },
    boxHeart: { label: "물품후원", body: '<path d="M3 8l9-5 9 5-9 5zM3 8v9l9 5 9-5V8M12 13v9"/><path d="M12 10s-3-1.7-3-3.6A1.7 1.7 0 0 1 12 5.3a1.7 1.7 0 0 1 3 1.1C15 8.3 12 10 12 10z"/>' },
    message: { label: "후원문의", body: '<path d="M21 12a8 8 0 0 1-8 8H7l-4 2 1.4-4.2A8 8 0 1 1 21 12z"/><path d="M8 12h.01M12 12h.01M16 12h.01"/>' },
    heart: { label: "마음", body: '<path d="M20.8 5.8a5.5 5.5 0 0 0-7.8 0L12 6.9l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.4a5.5 5.5 0 0 0 0-7.8z"/>' },
    users: { label: "함께", body: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c.4-4.2 2.4-6.3 6-6.3s5.6 2.1 6 6.3M14 15c3.8-.5 6 1.2 7 5"/>' },
    bank: { label: "계좌", body: '<path d="M3 10h18M5 10v9M9 10v9M15 10v9M19 10v9M2 21h20M12 3l9 5H3z"/>' },
    phone: { label: "전화", body: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2z"/>' }
  });

  const visualAssets = window.EditorVisualAssetManager;
  const ICONS = visualAssets?.ICONS ?? LEGACY_ICONS;

  const TEXT_DEFAULTS = Object.freeze({
    desktop: {
      headline: { size: 46, color: "#211611", font: "sans" },
      description: { size: 18, color: "#716657", font: "sans" },
      note: { size: 16, color: "#716657", font: "sans" },
      cta: { size: 18, color: "#ffffff", font: "sans" }
    },
    phoneSmall: {
      headline: { size: 30, color: "#211611", font: "sans" },
      description: { size: 14, color: "#716657", font: "sans" },
      note: { size: 13, color: "#716657", font: "sans" },
      cta: { size: 16, color: "#ffffff", font: "sans" }
    },
    phone: {
      headline: { size: 32, color: "#211611", font: "sans" },
      description: { size: 15, color: "#716657", font: "sans" },
      note: { size: 14, color: "#716657", font: "sans" },
      cta: { size: 17, color: "#ffffff", font: "sans" }
    },
    tablet: {
      headline: { size: 40, color: "#211611", font: "sans" },
      description: { size: 17, color: "#716657", font: "sans" },
      note: { size: 15, color: "#716657", font: "sans" },
      cta: { size: 18, color: "#ffffff", font: "sans" }
    }
  });

  const CARD_TEXT_DEFAULTS = Object.freeze({
    desktop: { title: { size: 22, color: "#211611", font: "sans" } },
    phoneSmall: { title: { size: 18, color: "#211611", font: "sans" } },
    phone: { title: { size: 19, color: "#211611", font: "sans" } },
    tablet: { title: { size: 21, color: "#211611", font: "sans" } }
  });

  function clone(value) {
    return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
  }

  function normalizeStyle(style, fallback) {
    const source = style && typeof style === "object" ? style : {};
    return {
      size: Math.max(8, Math.min(96, Number(source.size) || fallback.size)),
      color: /^#[0-9a-f]{6}$/i.test(source.color) ? source.color : fallback.color,
      font: ["sans", "serif", "koreanBrush", "koreanKcc", "koreanNanumBrush", "koreanLoveLetter", "englishScript", "englishSignature"].includes(source.font) ? source.font : fallback.font,
      align: ["left", "center", "right"].includes(source.align) ? source.align : (fallback.align || ""),
      boxWidth: Math.max(30, Math.min(100, Number(source.boxWidth ?? fallback.boxWidth ?? 100))),
      boxOffsetX: Math.max(-320, Math.min(320, Number(source.boxOffsetX ?? fallback.boxOffsetX ?? 0))),
      boxOffsetY: Math.max(-320, Math.min(320, Number(source.boxOffsetY ?? fallback.boxOffsetY ?? 0)))
    };
  }

  function normalizeStyleSet(styles, defaults) {
    const result = {};
    VIEWPORTS.forEach((viewport) => {
      result[viewport] = {};
      Object.entries(defaults[viewport]).forEach(([field, fallback]) => {
        result[viewport][field] = normalizeStyle(styles?.[viewport]?.[field], fallback);
      });
    });
    return result;
  }

  function normalizeColor(value) {
    return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value).toLowerCase() : null;
  }

  const DECORATION_LAYOUT_DEFAULTS = Object.freeze({
    desktop: { x: 50, y: 90 },
    phoneSmall: { x: 50, y: 68 },
    phone: { x: 50, y: 72 },
    tablet: { x: 50, y: 82 }
  });

  const DECORATION_SIZE_DEFAULTS = Object.freeze({
    desktop: 58,
    phoneSmall: 46,
    phone: 50,
    tablet: 54
  });

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || min));
  }

  function normalizeDecorationItem(item = {}, index = 0) {
    const base = visualAssets?.normalizeDecoration(item) ?? {
      icon: ICONS[item.icon] ? item.icon : "heart",
      style: String(item.style || "plain")
    };
    const layouts = {};
    const sizes = {};
    VIEWPORTS.forEach((viewport) => {
      const fallbackLayout = DECORATION_LAYOUT_DEFAULTS[viewport];
      const sourceLayout = item.layouts?.[viewport] ?? item.layout?.[viewport] ?? {};
      layouts[viewport] = {
        x: clamp(sourceLayout.x ?? fallbackLayout.x, 2, 98),
        y: clamp(sourceLayout.y ?? fallbackLayout.y, 18, 20000)
      };
      sizes[viewport] = clamp(item.sizes?.[viewport] ?? item.size ?? DECORATION_SIZE_DEFAULTS[viewport], 24, 220);
    });
    return {
      id: String(item.id || `donation-decoration-${index + 1}`),
      icon: base.icon || "heart",
      style: base.style,
      color: normalizeColor(item.color),
      layer: item.layer === "back" ? "back" : "front",
      layouts,
      sizes
    };
  }

  function normalizeCard(card = {}, index = 0) {
    const icon = ICONS[card.icon] ? card.icon : Object.keys(ICONS)[index % Object.keys(ICONS).length];
    return {
      id: String(card.id || `donation-card-${index + 1}`),
      title: String(card.title || ICONS[icon].label || `후원 방법 ${index + 1}`),
      icon,
      backgroundColor: normalizeColor(card.backgroundColor),
      accentColor: normalizeColor(card.accentColor),
      textStyles: normalizeStyleSet(card.textStyles, CARD_TEXT_DEFAULTS)
    };
  }

  function createDefaultModel() {
    return normalizeModel({
      headline: "나눔의 마음이 모여 희망이 됩니다",
      description: "행복한 나눔의 손길이 따뜻한 송악 지역사회를 만듭니다.",
      note: "농협 351-1172-9628-93 · 예금주 송악사회복지관 · 문의 041-353-5077",
      cta: "후원 신청하기",
      cards: [
        { id: "donation-card-1", title: "기금 후원", icon: "recurring" },
        { id: "donation-card-2", title: "결연 후원", icon: "handHeart" },
        { id: "donation-card-3", title: "지정 후원", icon: "heart" },
        { id: "donation-card-4", title: "물품 후원", icon: "boxHeart" },
        { id: "donation-card-5", title: "후원 문의", icon: "message" }
      ],
      nextCardId: 6
    });
  }

  function normalizeModel(model = {}) {
    const cards = Array.isArray(model.cards) ? model.cards.map(normalizeCard).slice(0, 12) : [];
    const legacyBackgroundColor = normalizeColor(model.backgroundColor);
    const legacyAccentColor = normalizeColor(model.accentColor);
    if (legacyBackgroundColor || legacyAccentColor) {
      cards.forEach((card) => {
        if (!card.backgroundColor && legacyBackgroundColor) card.backgroundColor = legacyBackgroundColor;
        if (!card.accentColor && legacyAccentColor) card.accentColor = legacyAccentColor;
      });
    }
    const maxId = cards.reduce((max, card) => Math.max(max, Number(card.id.replace(/\D/g, "")) || 0), 0);
    const hasDecorationArray = Array.isArray(model.decorations);
    const rawDecorations = hasDecorationArray
      ? model.decorations
      : model.decoration
        ? [model.decoration]
        : [{ id: "donation-decoration-1", icon: "heart", style: "plain" }];
    const decorations = rawDecorations.map(normalizeDecorationItem).slice(0, 24);
    const maxDecorationId = decorations.reduce((max, item) => Math.max(max, Number(item.id.replace(/\D/g, "")) || 0), 0);
    return {
      headline: String(model.headline || "나눔의 마음이 모여 희망이 됩니다"),
      description: String(model.description || "행복한 나눔의 손길이 따뜻한 송악 지역사회를 만듭니다."),
      note: String(model.note || "농협 351-1172-9628-93 · 예금주 송악사회복지관 · 문의 041-353-5077"),
      cta: String(model.cta || "후원 신청하기"),
      decorations,
      nextDecorationId: Math.max(Number(model.nextDecorationId) || 1, maxDecorationId + 1),
      backgroundColor: null,
      accentColor: null,
      ctaBackgroundColor: normalizeColor(model.ctaBackgroundColor),
      cards,
      nextCardId: Math.max(Number(model.nextCardId) || 1, maxId + 1),
      textStyles: normalizeStyleSet(model.textStyles, TEXT_DEFAULTS),
      heightVersion: HEIGHT_VERSION,
      heights: Number(model.heightVersion) === HEIGHT_VERSION && model.heights && typeof model.heights === "object" ? clone(model.heights) : {}
    };
  }

  function addCard(model, afterCardId = null) {
    const next = normalizeModel(model);
    if (next.cards.length >= 12) return next;
    const id = `donation-card-${next.nextCardId++}`;
    const targetIndex = afterCardId
      ? next.cards.findIndex((card) => card.id === afterCardId)
      : -1;
    const insertIndex = targetIndex >= 0 ? targetIndex + 1 : next.cards.length;
    next.cards.splice(insertIndex, 0, normalizeCard({ id, title: "새 후원 방법", icon: "heart" }, insertIndex));
    return next;
  }

  function removeCard(model, cardId) {
    const next = normalizeModel(model);
    next.cards = next.cards.filter((card) => card.id !== cardId);
    return next;
  }

  function addDecoration(model, viewport = "desktop") {
    const next = normalizeModel(model);
    if (next.decorations.length >= 24) return next;
    const id = `donation-decoration-${next.nextDecorationId++}`;
    const offset = (next.decorations.length % 6) * 4;
    const decoration = normalizeDecorationItem({ id, icon: "heart", style: "plain" }, next.decorations.length);
    decoration.layouts[viewport] = {
      x: clamp(50 + offset, 8, 92),
      y: clamp(90 + offset * 3, 24, 20000)
    };
    next.decorations.push(decoration);
    return next;
  }

  function removeDecoration(model, decorationId) {
    const next = normalizeModel(model);
    next.decorations = next.decorations.filter((item) => item.id !== decorationId);
    return next;
  }

  function moveItem(items, itemId, direction) {
    const next = [...(items || [])];
    const index = next.findIndex((item) => item.id === itemId);
    const target = direction === "up" || direction === "left" ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= next.length) return next;
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  }

  function estimateHeight(model, viewport = "desktop") {
    const normalized = normalizeModel(model);
    const count = normalized.cards.length;
    if (viewport === "desktop") {
      const columns = count <= 6 ? Math.max(1, count) : Math.ceil(count / 2);
      return 610 + Math.max(0, Math.ceil(count / columns) - 1) * 240;
    }
    if (viewport === "tablet") return 680 + Math.max(0, Math.ceil(count / 2) - 1) * 205;
    return 420 + count * 116;
  }

  function isSection(sectionId) {
    return sectionId === "donation" || /^donation\d+$/.test(String(sectionId));
  }

  window.EditorDonationManager = Object.freeze({
    CARD_TEXT_DEFAULTS,
    ICONS,
    TEXT_DEFAULTS,
    VIEWPORTS,
    addCard,
    addDecoration,
    createDefaultModel,
    estimateHeight,
    isSection,
    moveItem,
    normalizeModel,
    removeCard,
    removeDecoration
  });
})();
