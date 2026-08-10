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
      font: fonts.includes(source.font) ? source.font : fallback.font,
      align: ["left", "center", "right"].includes(source.align) ? source.align : (fallback.align || ""),
      boxWidth: clamp(source.boxWidth ?? fallback.boxWidth ?? 100, 30, 100),
      boxOffsetX: clamp(source.boxOffsetX ?? fallback.boxOffsetX ?? 0, -320, 320),
      boxOffsetY: clamp(source.boxOffsetY ?? fallback.boxOffsetY ?? 0, -320, 320)
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
      imageFitVersion: 1,
      desktopStyle: "mosaic",
      mobileStyle: "poster",
      eyebrow: "SONGAK STORY",
      headline: "복지관에서는\n어떤 일이?",
      description: "지역주민과 함께 만든 따뜻한 활동 소식을 전합니다.",
      monthLabel: "2026.07",
      showMonthLabel: true,
      uploadLabel: "복지관 활동 사진 등록하기",
      ctaLabel: "공식 갤러리 더보기",
      activeCategoryId: "all",
      nextCategoryId: 5,
      nextItemId: 7,
      categories: [
        { id: "all", label: "전체" },
        { id: "activity", label: "복지관 활동" },
        { id: "program", label: "프로그램" },
        { id: "network", label: "지역연계" },
        { id: "event", label: "행사" }
      ],
      items: [
        { id: "gallery-item-1", date: "07.27", title: "주민만나기, 가보자GO! 2편", description: "주민을 직접 만나 복지관을 알리고 지역의 이야기에 귀 기울였습니다.", categoryId: "activity", tag: "#주민만나기 #소통", likes: 28, comments: 4, tone: "forest", image: { name: "공식 갤러리 1550", dataUrl: "./assets/official-sacwc/8686126a0b0c2c4c.jpg", fit: "cover" } },
        { id: "gallery-item-2", date: "07.20", title: "송악 워터 PLAY!", description: "무더운 여름, 지역주민과 함께 시원한 여름놀이터를 열었습니다.", categoryId: "event", tag: "#여름놀이터 #가족", likes: 32, comments: 2, tone: "sky", image: { name: "공식 갤러리 1545", dataUrl: "./assets/official-sacwc/eeffc60f19126d72.jpg", fit: "cover" } },
        { id: "gallery-item-3", date: "07.16", title: "제16회 당진환경사랑미술대회", description: "GS EPS와 함께 어린이들의 환경사랑과 창의력을 응원했습니다.", categoryId: "network", tag: "#환경사랑 #GSEPS", likes: 26, comments: 1, tone: "green", image: { name: "공식 갤러리 1543", dataUrl: "./assets/official-sacwc/a50cd70a78e3ba38.jpg", fit: "cover" } },
        { id: "gallery-item-4", date: "07.08", title: "지역돌봄 아동 발전소 견학", description: "지역돌봄 아동들과 함께 미래를 켜는 하루를 만들었습니다.", categoryId: "program", tag: "#지역돌봄 #현장체험", likes: 19, comments: 0, tone: "gold", image: { name: "공식 영상 1411", dataUrl: "./assets/official-sacwc/d0208f4cdada8c07.jpg", fit: "cover" } },
        { id: "gallery-item-5", date: "06.24", title: "어르신 행복충전-Day", description: "어르신들과 함께 즐거운 상반기 문화나들이를 다녀왔습니다.", categoryId: "program", tag: "#어르신 #문화나들이", likes: 31, comments: 0, tone: "rose", image: { name: "공식 영상 1398", dataUrl: "./assets/official-sacwc/682cb28d0eb119ff.jpg", fit: "cover" } },
        { id: "gallery-item-6", date: "05.08", title: "가족愛 퐁당", description: "전 세대가 함께 참여하는 가족문화 행사를 진행했습니다.", categoryId: "event", tag: "#가족문화 #함께", likes: 24, comments: 3, tone: "violet", image: { name: "공식 영상 1311", dataUrl: "./assets/official-sacwc/1a778421279dc57f.jpg", fit: "cover" } }
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
          // New and restored gallery images default to full-image visibility.
          fit: image.fit === "cover" ? "cover" : "contain",
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
    const imageFitVersion = Math.max(0, Number(model.imageFitVersion) || 0);
    if (imageFitVersion < 2) {
      const officialAssetPattern = /\/assets\/official-sacwc\/[a-f0-9]+\.jpg(?:[?#].*)?$/i;
      items.forEach((item) => {
        if (item.image?.fit === "cover" && officialAssetPattern.test(item.image.dataUrl)) {
          item.image.fit = "contain";
          item.image.scale = 1;
          item.image.x = 0;
          item.image.y = 0;
        }
      });
    }
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
      imageFitVersion: 2,
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
    if (normalized.heroOnly) {
      if (viewport === "desktop") return 438;
      if (viewport === "tablet") return 420;
      return 460;
    }
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
