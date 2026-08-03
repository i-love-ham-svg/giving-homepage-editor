(function () {
  "use strict";

  const DESKTOP_STYLES = Object.freeze([
    { id: "mosaic", label: "모자이크형 · 6장", featuredCount: 6 },
    { id: "panorama", label: "파노라마형 · 4장", featuredCount: 4 },
    { id: "collage", label: "콜라주형 · 3장", featuredCount: 3 },
    { id: "focus", label: "포커스형 · 1장", featuredCount: 1 },
    { id: "tape-pink", label: "테이프 핑크형 · 5장", featuredCount: 5 },
    { id: "tape-nature", label: "테이프 내추럴형 · 5장", featuredCount: 5 },
    { id: "tape-yellow", label: "테이프 옐로형 · 5장", featuredCount: 5 }
  ]);
  const MOBILE_STYLES = Object.freeze([
    { id: "poster", label: "포스터형" },
    { id: "journal", label: "활동 기록형" },
    { id: "tape-pink", label: "테이프 핑크형 · 5장" },
    { id: "tape-nature", label: "테이프 내추럴형 · 5장" },
    { id: "tape-yellow", label: "테이프 옐로형 · 5장" }
  ]);

  const VIEWPORTS = Object.freeze(["desktop", "phoneSmall", "phone", "tablet"]);
  const visualAssets = window.EditorVisualAssetManager;
  const TEXT_DEFAULTS = Object.freeze({
    desktop: {
      eyebrow: { size: 14, color: "#2f6b49", font: "sans" },
      headline: { size: 42, color: "#17231b", font: "serif" },
      description: { size: 15, color: "#716a60", font: "sans" },
      categoryLabel: { size: 13, color: "#2f6b49", font: "sans" },
      monthLabel: { size: 20, color: "#17231b", font: "sans" },
      ctaLabel: { size: 14, color: "#2f6b49", font: "sans" }
    },
    phoneSmall: {
      eyebrow: { size: 12, color: "#2f6b49", font: "sans" },
      headline: { size: 30, color: "#17231b", font: "serif" },
      description: { size: 13, color: "#716a60", font: "sans" },
      categoryLabel: { size: 11, color: "#2f6b49", font: "sans" },
      monthLabel: { size: 16, color: "#17231b", font: "sans" },
      ctaLabel: { size: 13, color: "#2f6b49", font: "sans" }
    },
    phone: {
      eyebrow: { size: 13, color: "#2f6b49", font: "sans" },
      headline: { size: 34, color: "#17231b", font: "serif" },
      description: { size: 14, color: "#716a60", font: "sans" },
      categoryLabel: { size: 12, color: "#2f6b49", font: "sans" },
      monthLabel: { size: 17, color: "#17231b", font: "sans" },
      ctaLabel: { size: 14, color: "#2f6b49", font: "sans" }
    },
    tablet: {
      eyebrow: { size: 14, color: "#2f6b49", font: "sans" },
      headline: { size: 42, color: "#17231b", font: "serif" },
      description: { size: 16, color: "#716a60", font: "sans" },
      categoryLabel: { size: 13, color: "#2f6b49", font: "sans" },
      monthLabel: { size: 19, color: "#17231b", font: "sans" },
      ctaLabel: { size: 15, color: "#2f6b49", font: "sans" }
    }
  });
  const CUSTOM_TEXT_DEFAULTS = Object.freeze({
    desktop: { size: 20, color: "#17231b", font: "sans" },
    phoneSmall: { size: 15, color: "#17231b", font: "sans" },
    phone: { size: 16, color: "#17231b", font: "sans" },
    tablet: { size: 18, color: "#17231b", font: "sans" }
  });
  const CUSTOM_TEXT_LAYOUT_DEFAULTS = Object.freeze({
    desktop: { x: 2, y: 64, w: 30, h: 14 },
    phoneSmall: { x: 4, y: 54, w: 58, h: 14 },
    phone: { x: 4, y: 54, w: 58, h: 14 },
    tablet: { x: 3, y: 56, w: 52, h: 14 }
  });
  const BASE_TEXT_FIELDS = Object.freeze(["eyebrow", "headline", "description"]);
  const BASE_TEXT_LAYOUT_DEFAULTS = Object.freeze({
    desktop: {
      eyebrow: { x: 2, y: 24, w: 30, h: 8 },
      headline: { x: 2, y: 34, w: 36, h: 29 },
      description: { x: 2, y: 69, w: 38, h: 14 }
    },
    phoneSmall: {
      eyebrow: { x: 4, y: 2, w: 42, h: 8 },
      headline: { x: 4, y: 12, w: 90, h: 40 },
      description: { x: 4, y: 56, w: 90, h: 22 }
    },
    phone: {
      eyebrow: { x: 4, y: 2, w: 42, h: 8 },
      headline: { x: 4, y: 12, w: 90, h: 40 },
      description: { x: 4, y: 56, w: 90, h: 22 }
    },
    tablet: {
      eyebrow: { x: 3, y: 2, w: 38, h: 8 },
      headline: { x: 3, y: 12, w: 82, h: 40 },
      description: { x: 3, y: 56, w: 86, h: 22 }
    }
  });
  const ITEM_TEXT_DEFAULTS = Object.freeze({
    desktop: {
      date: { size: 11, color: "#2f6b49", font: "sans" },
      title: { size: 16, color: "#1f2924", font: "sans" },
      description: { size: 12, color: "#68726c", font: "sans" },
      tag: { size: 11, color: "#2f6b49", font: "sans" }
    },
    phoneSmall: {
      date: { size: 10, color: "#2f6b49", font: "sans" },
      title: { size: 13, color: "#1f2924", font: "sans" },
      description: { size: 10, color: "#68726c", font: "sans" },
      tag: { size: 10, color: "#2f6b49", font: "sans" }
    },
    phone: {
      date: { size: 11, color: "#2f6b49", font: "sans" },
      title: { size: 14, color: "#1f2924", font: "sans" },
      description: { size: 11, color: "#68726c", font: "sans" },
      tag: { size: 11, color: "#2f6b49", font: "sans" }
    },
    tablet: {
      date: { size: 12, color: "#2f6b49", font: "sans" },
      title: { size: 17, color: "#1f2924", font: "sans" },
      description: { size: 12, color: "#68726c", font: "sans" },
      tag: { size: 12, color: "#2f6b49", font: "sans" }
    }
  });
  const DEFAULT_GALLERY_DECORATIONS = Object.freeze([
    { id: "gallery-decoration-1", icon: "leaf-branch", style: "plain", x: 34, y: 282, size: 62, rotation: -14 },
    { id: "gallery-decoration-2", icon: "paper-plane", style: "plain", x: 8, y: 302, size: 42, rotation: 8 },
    { id: "gallery-decoration-3", icon: "heart", style: "plain", x: 32, y: 106, size: 32, rotation: 9 },
    { id: "gallery-decoration-4", icon: "flower", style: "plain", x: 58, y: 22, size: 44, rotation: -8 },
    { id: "gallery-decoration-5", icon: "forsythia", style: "plain", x: 96, y: 298, size: 56, rotation: 5 }
  ]);

  function clone(value) {
    return typeof structuredClone === "function"
      ? structuredClone(value)
      : JSON.parse(JSON.stringify(value));
  }

  function clamp(value, min, max) {
    const numeric = Number(value);
    return Math.max(min, Math.min(max, Number.isFinite(numeric) ? numeric : min));
  }

  function normalizeColor(value) {
    return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value).toLowerCase() : null;
  }

  function normalizeStyle(style, fallback) {
    const source = style && typeof style === "object" ? style : {};
    const fonts = ["sans", "serif", "koreanBrush", "koreanKcc", "koreanNanumBrush", "koreanLoveLetter", "englishScript", "englishSignature"];
    return {
      size: clamp(source.size ?? fallback.size, 8, 96),
      color: normalizeColor(source.color) ?? fallback.color,
      font: fonts.includes(source.font) ? source.font : fallback.font
    };
  }

  function normalizeTextStyles(styles = {}) {
    const result = {};
    VIEWPORTS.forEach((viewport) => {
      result[viewport] = {};
      Object.entries(TEXT_DEFAULTS[viewport]).forEach(([field, fallback]) => {
        result[viewport][field] = normalizeStyle(styles?.[viewport]?.[field], fallback);
      });
    });
    return result;
  }

  function normalizeItemTextStyles(styles = {}) {
    const result = {};
    VIEWPORTS.forEach((viewport) => {
      result[viewport] = {};
      Object.entries(ITEM_TEXT_DEFAULTS[viewport]).forEach(([field, fallback]) => {
        result[viewport][field] = normalizeStyle(styles?.[viewport]?.[field], fallback);
      });
    });
    return result;
  }

  function normalizeCustomTextStyles(styles = {}) {
    const result = {};
    VIEWPORTS.forEach((viewport) => {
      result[viewport] = normalizeStyle(styles?.[viewport], CUSTOM_TEXT_DEFAULTS[viewport]);
    });
    return result;
  }

  function normalizeCustomTextLayouts(layouts = {}, index = 0) {
    const result = {};
    VIEWPORTS.forEach((viewport) => {
      const fallback = CUSTOM_TEXT_LAYOUT_DEFAULTS[viewport];
      const source = layouts?.[viewport] ?? {};
      const x = clamp(source.x ?? fallback.x, 0, 94);
      const y = clamp(source.y ?? fallback.y + index * 8, 0, 95);
      result[viewport] = {
        x,
        y,
        w: clamp(source.w ?? fallback.w, 6, 100 - x),
        h: clamp(source.h ?? fallback.h, 5, 100 - y),
        manualSize: source.manualSize === true
      };
    });
    return result;
  }

  function normalizeBaseTextBoxes(boxes = {}) {
    const result = {};
    BASE_TEXT_FIELDS.forEach((field) => {
      const source = boxes?.[field] ?? {};
      result[field] = { visible: source.visible !== false, layouts: {} };
      VIEWPORTS.forEach((viewport) => {
        const fallback = BASE_TEXT_LAYOUT_DEFAULTS[viewport][field];
        const layout = source.layouts?.[viewport] ?? source?.[viewport] ?? {};
        const x = clamp(layout.x ?? fallback.x, 0, 94);
        const y = clamp(layout.y ?? fallback.y, 0, 95);
        result[field].layouts[viewport] = {
          x,
          y,
          w: clamp(layout.w ?? fallback.w, 6, 100 - x),
          h: clamp(layout.h ?? fallback.h, 5, 100 - y),
          manualSize: layout.manualSize === true
        };
      });
    });
    return result;
  }

  function isSection(sectionId) {
    return sectionId === "gallery" || /^gallery\d+$/.test(String(sectionId));
  }

  function createDefaultModel() {
    return normalizeModel({
      desktopStyle: "mosaic",
      mobileStyle: "poster",
      eyebrow: "GALLERY",
      headline: "함께 만든\n소중한 순간들",
      description: "참여의 기록이 변화의 이야기가 됩니다.",
      monthLabel: "2026.06",
      showMonthLabel: true,
      uploadLabel: "활동 사진 등록하기",
      ctaLabel: "더 많은 순간 보기",
      activeCategoryId: "all",
      nextCategoryId: 5,
      nextItemId: 7,
      categories: [
        { id: "all", label: "전체" },
        { id: "environment", label: "환경" },
        { id: "sharing", label: "나눔" },
        { id: "education", label: "교육" },
        { id: "event", label: "행사" }
      ],
      items: [
        { id: "gallery-item-1", date: "06.01", title: "공원 환경정화 활동", description: "깨끗한 공원을 위해 함께 쓰레기를 수거했어요.", categoryId: "environment", tag: "#환경", likes: 28, comments: 4, tone: "forest" },
        { id: "gallery-item-2", date: "06.01", title: "팀워크 활동", description: "서로의 힘을 모아 더 큰 가치를 만들었어요.", categoryId: "event", tag: "#함께라서가능해", likes: 32, comments: 2, tone: "rose" },
        { id: "gallery-item-3", date: "05.28", title: "어린이 환경 교육", description: "아이들과 함께 지구를 지키는 방법을 배웠어요.", categoryId: "education", tag: "#배움", likes: 26, comments: 1, tone: "sky" },
        { id: "gallery-item-4", date: "05.20", title: "기부 물품 전달", description: "필요한 곳에 따뜻한 마음을 전달했습니다.", categoryId: "sharing", tag: "#나눔", likes: 19, comments: 0, tone: "gold" },
        { id: "gallery-item-5", date: "05.15", title: "함께한 챌린지", description: "모두의 참여로 목표를 달성했어요.", categoryId: "event", tag: "#해냈어", likes: 31, comments: 0, tone: "green" },
        { id: "gallery-item-6", date: "05.08", title: "마을 연대의 날", description: "이웃과 인사를 나누고 마음을 연결했습니다.", categoryId: "sharing", tag: "#이웃", likes: 24, comments: 3, tone: "violet" }
      ],
      decorations: DEFAULT_GALLERY_DECORATIONS,
      nextDecorationId: 6,
      customTexts: [],
      nextTextId: 1,
      heights: {}
    });
  }

  function normalizeCategory(category, index) {
    return {
      id: String(category?.id || `gallery-category-${index + 1}`),
      label: String(category?.label || "새 분류")
    };
  }

  function normalizeImage(image) {
    return image?.dataUrl
      ? {
          name: String(image.name || "갤러리 이미지"),
          dataUrl: String(image.dataUrl),
          naturalWidth: Math.max(0, Number(image.naturalWidth) || 0),
          naturalHeight: Math.max(0, Number(image.naturalHeight) || 0),
          fit: image.fit === "contain" ? "contain" : "cover",
          scale: clamp(image.scale ?? 1, .2, 4),
          x: clamp(image.x ?? 0, -100, 100),
          y: clamp(image.y ?? 0, -100, 100),
          opacity: clamp(image.opacity ?? 100, 0, 100)
        }
      : null;
  }

  function normalizeHeroLayouts(layouts = {}) {
    const normalized = {};
    VIEWPORTS.forEach((viewport) => {
      const source = layouts?.[viewport] ?? {};
      normalized[viewport] = {
        x: clamp(source.x ?? 0, -1200, 1200),
        y: clamp(source.y ?? 0, -1200, 1200),
        scale: clamp(source.scale ?? 1, .35, 2.5),
        rotation: clamp(source.rotation ?? 0, -45, 45)
      };
    });
    return normalized;
  }

  function normalizeDecoration(item = {}, index = 0) {
    const base = visualAssets?.normalizeDecoration(item) ?? { icon: "heart", style: "plain" };
    const desktop = {
      x: clamp(item.layouts?.desktop?.x ?? item.x ?? 50, 2, 98),
      y: clamp(item.layouts?.desktop?.y ?? item.y ?? 90, 18, 6000)
    };
    const layouts = {};
    const sizes = {};
    VIEWPORTS.forEach((viewport) => {
      const source = item.layouts?.[viewport] ?? {};
      layouts[viewport] = {
        x: clamp(source.x ?? desktop.x, 2, 98),
        y: clamp(source.y ?? desktop.y, 18, 6000)
      };
      sizes[viewport] = clamp(item.sizes?.[viewport] ?? item.size ?? 48, 20, 220);
    });
    return {
      id: String(item.id || `gallery-decoration-${index + 1}`),
      icon: base.icon || "heart",
      style: base.style,
      color: normalizeColor(item.color),
      rotation: clamp(item.rotation ?? 0, -45, 45),
      layouts,
      sizes
    };
  }

  function normalizeCustomTextBox(item = {}, index = 0) {
    return {
      id: String(item.id || `gallery-text-${index + 1}`),
      text: String(item.text ?? "새 텍스트"),
      styles: normalizeCustomTextStyles(item.styles),
      layouts: normalizeCustomTextLayouts(item.layouts, index)
    };
  }

  function normalizeTagText(value) {
    return String(value || "#기록")
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .slice(0, 3)
      .join(" ");
  }
  function normalizeItem(item, index, categoryIds) {
    const assignable = categoryIds.filter((id) => id !== "all");
    const fallbackCategory = assignable[index % Math.max(1, assignable.length)] || "all";
    const tones = ["forest", "rose", "sky", "gold", "green", "violet"];
    return {
      id: String(item?.id || `gallery-item-${index + 1}`),
      date: item?.date == null ? "06.01" : String(item.date),
      showDate: item?.showDate !== false,
      title: String(item?.title || "새로운 활동 순간"),
      description: String(item?.description || "활동에 대한 짧은 설명을 입력해 주세요."),
      categoryId: assignable.includes(item?.categoryId) ? item.categoryId : fallbackCategory,
      tag: normalizeTagText(item?.tag),
      likes: Math.max(0, Number(item?.likes) || 0),
      comments: Math.max(0, Number(item?.comments) || 0),
      tone: tones.includes(item?.tone) ? item.tone : tones[index % tones.length],
      image: normalizeImage(item?.image),
      heroLayouts: normalizeHeroLayouts(item?.heroLayouts),
      textStyles: normalizeItemTextStyles(item?.textStyles)
    };
  }

  function normalizeModel(model = {}) {
    const desktopIds = DESKTOP_STYLES.map((style) => style.id);
    const mobileIds = MOBILE_STYLES.map((style) => style.id);
    const fallbackCategories = [
      { id: "all", label: "전체" },
      { id: "environment", label: "환경" },
      { id: "sharing", label: "나눔" },
      { id: "education", label: "교육" },
      { id: "event", label: "행사" }
    ];
    const sourceCategories = Array.isArray(model.categories) && model.categories.length
      ? model.categories
      : fallbackCategories;
    const categories = sourceCategories.map(normalizeCategory);
    if (!categories.some((category) => category.id === "all")) {
      categories.unshift({ id: "all", label: "전체" });
    }
    const categoryIds = categories.map((category) => category.id);
    const items = (Array.isArray(model.items) ? model.items : []).map((item, index) => normalizeItem(item, index, categoryIds));
    const itemIds = items.map((item) => item.id);
    const heroOrder = [];
    (Array.isArray(model.heroOrder) ? model.heroOrder : itemIds).forEach((itemId) => {
      const normalizedId = String(itemId);
      if (itemIds.includes(normalizedId) && !heroOrder.includes(normalizedId)) heroOrder.push(normalizedId);
    });
    itemIds.forEach((itemId) => {
      if (!heroOrder.includes(itemId)) heroOrder.push(itemId);
    });
    const rawDecorations = Array.isArray(model.decorations) ? model.decorations : DEFAULT_GALLERY_DECORATIONS;
    const decorations = rawDecorations.map(normalizeDecoration).slice(0, 20);
    const maxDecorationId = decorations.reduce((max, item) => Math.max(max, Number(item.id.replace(/\D/g, "")) || 0), 0);
    const customTexts = (Array.isArray(model.customTexts) ? model.customTexts : [])
      .map(normalizeCustomTextBox)
      .slice(0, 20);
    const maxTextId = customTexts.reduce((max, item) => Math.max(max, Number(item.id.replace(/\D/g, "")) || 0), 0);
    return {
      heroOnly: model.heroOnly === true,
      mainIntroStyleSection: model.mainIntroStyleSection === true,
      mainIntroSourceSectionId: typeof model.mainIntroSourceSectionId === "string"
        ? model.mainIntroSourceSectionId
        : "",
      desktopStyle: desktopIds.includes(model.desktopStyle) ? model.desktopStyle : "mosaic",
      mobileStyle: mobileIds.includes(model.mobileStyle) ? model.mobileStyle : "poster",
      eyebrow: String(model.eyebrow ?? "GALLERY"),
      headline: String(model.headline ?? "함께 만든\n소중한 순간들"),
      description: String(model.description ?? "참여의 기록이 변화의 이야기가 됩니다."),
      monthLabel: String(model.monthLabel ?? "2026.06"),
      showMonthLabel: model.showMonthLabel !== false,
      uploadLabel: String(model.uploadLabel ?? "활동 사진 등록하기"),
      ctaLabel: String(model.ctaLabel ?? "더 많은 순간 보기"),
      categoryCtaBackground: /^#[0-9a-f]{6}$/i.test(String(model.categoryCtaBackground || ""))
        ? String(model.categoryCtaBackground).toLowerCase()
        : null,
      ctaBackground: /^#[0-9a-f]{6}$/i.test(String(model.ctaBackground || ""))
        ? String(model.ctaBackground).toLowerCase()
        : null,
      activeCategoryId: categoryIds.includes(model.activeCategoryId) ? model.activeCategoryId : "all",
      nextCategoryId: Math.max(Number(model.nextCategoryId) || 1, categories.length + 1),
      nextItemId: Math.max(Number(model.nextItemId) || 1, items.length + 1),
      categories,
      items,
      heroOrder,
      decorations,
      nextDecorationId: Math.max(Number(model.nextDecorationId) || 1, maxDecorationId + 1),
      customTexts,
      nextTextId: Math.max(Number(model.nextTextId) || 1, maxTextId + 1),
      baseTextBoxes: normalizeBaseTextBoxes(model.baseTextBoxes),
      textStyles: normalizeTextStyles(model.textStyles),
      heights: model.heights && typeof model.heights === "object" ? clone(model.heights) : {}
    };
  }

  function getVisibleItems(model) {
    const normalized = normalizeModel(model);
    return normalized.activeCategoryId === "all"
      ? normalized.items
      : normalized.items.filter((item) => item.categoryId === normalized.activeCategoryId);
  }

  function getFeaturedCount(model) {
    const styleId = typeof model === "string" ? model : model?.desktopStyle;
    return DESKTOP_STYLES.find((style) => style.id === styleId)?.featuredCount ?? 6;
  }

  function addItem(model, afterItemId = null) {
    const normalized = normalizeModel(model);
    const categoryId = normalized.categories.find((category) => category.id !== "all")?.id ?? "all";
    const afterIndex = afterItemId
      ? normalized.items.findIndex((item) => item.id === afterItemId)
      : -1;
    const insertIndex = afterIndex >= 0 ? afterIndex + 1 : normalized.items.length;
    const item = normalizeItem({
      id: `gallery-item-${normalized.nextItemId++}`,
      title: "새로운 활동 순간",
      description: "활동에 대한 짧은 설명을 입력해 주세요.",
      categoryId,
      tag: "#기록"
    }, insertIndex, normalized.categories.map((category) => category.id));
    normalized.items.splice(insertIndex, 0, item);
    const heroAfterIndex = afterItemId ? normalized.heroOrder.indexOf(afterItemId) : -1;
    const heroInsertIndex = heroAfterIndex >= 0 ? heroAfterIndex + 1 : normalized.heroOrder.length;
    normalized.heroOrder.splice(heroInsertIndex, 0, item.id);
    normalized.activeCategoryId = "all";
    return normalized;
  }

  function addCategory(model, label = "새 분류", afterCategoryId = null) {
    const normalized = normalizeModel(model);
    const id = `gallery-category-${normalized.nextCategoryId++}`;
    const afterIndex = afterCategoryId
      ? normalized.categories.findIndex((category) => category.id === afterCategoryId)
      : -1;
    const insertIndex = afterIndex >= 0 ? afterIndex + 1 : normalized.categories.length;
    normalized.categories.splice(insertIndex, 0, {
      id,
      label: String(label || "새 분류").trim() || "새 분류"
    });
    normalized.activeCategoryId = "all";
    return normalized;
  }

  function renameCategory(model, categoryId, label) {
    const normalized = normalizeModel(model);
    const category = normalized.categories.find((entry) => entry.id === categoryId);
    if (!category) return normalized;
    category.label = String(label || "새 분류").trim() || "새 분류";
    return normalized;
  }

  function removeCategory(model, categoryId) {
    const normalized = normalizeModel(model);
    if (categoryId === "all") return normalized;
    const assignable = normalized.categories.filter((category) => category.id !== "all" && category.id !== categoryId);
    if (!assignable.length) return normalized;
    const fallbackId = assignable[0].id;
    normalized.categories = normalized.categories.filter((category) => category.id !== categoryId);
    normalized.items.forEach((item) => {
      if (item.categoryId === categoryId) item.categoryId = fallbackId;
    });
    if (normalized.activeCategoryId === categoryId) normalized.activeCategoryId = "all";
    return normalized;
  }

  function removeItem(model, itemId) {
    const normalized = normalizeModel(model);
    normalized.items = normalized.items.filter((item) => item.id !== itemId);
    normalized.heroOrder = normalized.heroOrder.filter((id) => id !== itemId);
    return normalized;
  }

  function moveHeroLayer(model, itemId, direction) {
    const normalized = normalizeModel(model);
    const featuredIds = normalized.items.slice(0, 6).map((item) => item.id);
    const featuredOrder = normalized.heroOrder.filter((id) => featuredIds.includes(id));
    featuredIds.forEach((id) => {
      if (!featuredOrder.includes(id)) featuredOrder.push(id);
    });
    const index = featuredOrder.indexOf(itemId);
    if (index < 0 || featuredOrder.length < 2) return normalized;
    featuredOrder.splice(index, 1);
    if (direction === "back") featuredOrder.unshift(itemId);
    else featuredOrder.push(itemId);
    normalized.heroOrder = [
      ...featuredOrder,
      ...normalized.heroOrder.filter((id) => !featuredIds.includes(id))
    ];
    return normalized;
  }

  function addDecoration(model, viewport = "desktop") {
    const normalized = normalizeModel(model);
    if (normalized.decorations.length >= 20) return normalized;
    const id = `gallery-decoration-${normalized.nextDecorationId++}`;
    const index = normalized.decorations.length;
    const icons = ["leaf-branch", "paper-plane", "heart", "flower", "forsythia", "sprout"];
    const decoration = normalizeDecoration({
      id,
      icon: icons[index % icons.length],
      style: "plain",
      x: clamp(26 + (index % 6) * 12, 8, 92),
      y: 54 + (index % 3) * 104,
      size: 42 + (index % 3) * 8
    }, index);
    decoration.layouts[viewport] = { x: decoration.layouts.desktop.x, y: decoration.layouts.desktop.y };
    normalized.decorations.push(decoration);
    return normalized;
  }

  function removeDecoration(model, decorationId) {
    const normalized = normalizeModel(model);
    normalized.decorations = normalized.decorations.filter((item) => item.id !== decorationId);
    return normalized;
  }

  function addTextBox(model, text = "새 텍스트") {
    const normalized = normalizeModel(model);
    if (normalized.customTexts.length >= 20) return normalized;
    normalized.customTexts.push(normalizeCustomTextBox({
      id: `gallery-text-${normalized.nextTextId++}`,
      text: String(text || "새 텍스트")
    }, normalized.customTexts.length));
    return normalized;
  }

  function removeTextBox(model, textId) {
    const normalized = normalizeModel(model);
    normalized.customTexts = normalized.customTexts.filter((item) => item.id !== textId);
    return normalized;
  }

  function estimateHeight(model, viewport) {
    const normalized = normalizeModel(model);
    const count = Math.max(1, getVisibleItems(normalized).length);
    if (viewport === "desktop") {
      const cardRows = Math.ceil(count / (normalized.desktopStyle === "mosaic" ? 5 : 4));
      return 690 + cardRows * 255;
    }
    if (viewport === "tablet") {
      return normalized.mobileStyle === "poster"
        ? 540 + Math.ceil(count / 2) * 250
        : 430 + count * 245;
    }
    return normalized.mobileStyle === "poster"
      ? 500 + Math.ceil(count / 2) * 210
      : 390 + count * 238;
  }

  window.EditorGalleryManager = Object.freeze({
    BASE_TEXT_FIELDS,
    BASE_TEXT_LAYOUT_DEFAULTS,
    CUSTOM_TEXT_DEFAULTS,
    CUSTOM_TEXT_LAYOUT_DEFAULTS,
    DESKTOP_STYLES,
    ITEM_TEXT_DEFAULTS,
    MOBILE_STYLES,
    TEXT_DEFAULTS,
    VIEWPORTS,
    addCategory,
    addDecoration,
    addItem,
    addTextBox,
    createDefaultModel,
    estimateHeight,
    getFeaturedCount,
    getVisibleItems,
    isSection,
    moveHeroLayer,
    normalizeModel,
    removeCategory,
    removeDecoration,
    removeItem,
    removeTextBox,
    renameCategory
  });
})();
