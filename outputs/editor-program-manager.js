(function () {
  "use strict";

  const STATUS_OPTIONS = ["모집 중", "모집 예정", "마감"];
  const SUMMARY_ICON_KEYS = ["calendar", "users", "megaphone", "star", "heart", "check-circle"];
  const TEXT_STYLE_DEFAULTS = {
    desktop: {
      headline: { size: 48, color: "#1d120f", font: "sans" },
      description: { size: 18, color: "#5f514b", font: "sans" },
      monthlyIcon: { size: 21, color: "#ffffff", font: "sans" },
      monthlyLabel: { size: 19, color: "#1d120f", font: "sans" },
      monthlyCount: { size: 32, color: "#8e5735", font: "sans" },
      recruitingIcon: { size: 21, color: "#ffffff", font: "sans" },
      recruitingLabel: { size: 19, color: "#1d120f", font: "sans" },
      recruitingCount: { size: 32, color: "#ef781d", font: "sans" },
      summaryNote: { size: 14, color: "#5f514b", font: "sans" }
    },
    phoneSmall: {
      headline: { size: 30, color: "#1d120f", font: "sans" },
      description: { size: 14, color: "#5f514b", font: "sans" },
      monthlyIcon: { size: 15, color: "#ffffff", font: "sans" },
      monthlyLabel: { size: 11, color: "#1d120f", font: "sans" },
      monthlyCount: { size: 23, color: "#8e5735", font: "sans" },
      recruitingIcon: { size: 15, color: "#ffffff", font: "sans" },
      recruitingLabel: { size: 11, color: "#1d120f", font: "sans" },
      recruitingCount: { size: 23, color: "#ef781d", font: "sans" },
      summaryNote: { size: 10, color: "#5f514b", font: "sans" }
    },
    phone: {
      headline: { size: 32, color: "#1d120f", font: "sans" },
      description: { size: 15, color: "#5f514b", font: "sans" },
      monthlyIcon: { size: 16, color: "#ffffff", font: "sans" },
      monthlyLabel: { size: 12, color: "#1d120f", font: "sans" },
      monthlyCount: { size: 25, color: "#8e5735", font: "sans" },
      recruitingIcon: { size: 16, color: "#ffffff", font: "sans" },
      recruitingLabel: { size: 12, color: "#1d120f", font: "sans" },
      recruitingCount: { size: 25, color: "#ef781d", font: "sans" },
      summaryNote: { size: 11, color: "#5f514b", font: "sans" }
    },
    tablet: {
      headline: { size: 40, color: "#1d120f", font: "sans" },
      description: { size: 17, color: "#5f514b", font: "sans" },
      monthlyIcon: { size: 18, color: "#ffffff", font: "sans" },
      monthlyLabel: { size: 16, color: "#1d120f", font: "sans" },
      monthlyCount: { size: 28, color: "#8e5735", font: "sans" },
      recruitingIcon: { size: 18, color: "#ffffff", font: "sans" },
      recruitingLabel: { size: 16, color: "#1d120f", font: "sans" },
      recruitingCount: { size: 28, color: "#ef781d", font: "sans" },
      summaryNote: { size: 13, color: "#5f514b", font: "sans" }
    }
  };
  const CATEGORY_TEXT_STYLE_DEFAULTS = {
    desktop: { size: 15, color: "#6f5d54", font: "sans" },
    phoneSmall: { size: 12, color: "#6f5d54", font: "sans" },
    phone: { size: 12, color: "#6f5d54", font: "sans" },
    tablet: { size: 14, color: "#6f5d54", font: "sans" }
  };
  const CARD_TEXT_STYLE_DEFAULTS = {
    desktop: {
      headline: { size: 22, color: "#1d120f", font: "sans" },
      description: { size: 14, color: "#6f5d54", font: "sans" },
      targetLabel: { size: 13, color: "#8e5735", font: "sans" },
      target: { size: 13, color: "#6f5d54", font: "sans" },
      scheduleLabel: { size: 13, color: "#8e5735", font: "sans" },
      schedule: { size: 13, color: "#6f5d54", font: "sans" },
      cta: { size: 15, color: "#8e5735", font: "sans" }
    },
    phoneSmall: {
      headline: { size: 17, color: "#1d120f", font: "sans" },
      description: { size: 11, color: "#6f5d54", font: "sans" },
      targetLabel: { size: 10, color: "#8e5735", font: "sans" },
      target: { size: 10, color: "#6f5d54", font: "sans" },
      scheduleLabel: { size: 10, color: "#8e5735", font: "sans" },
      schedule: { size: 10, color: "#6f5d54", font: "sans" },
      cta: { size: 12, color: "#8e5735", font: "sans" }
    },
    phone: {
      headline: { size: 18, color: "#1d120f", font: "sans" },
      description: { size: 12, color: "#6f5d54", font: "sans" },
      targetLabel: { size: 11, color: "#8e5735", font: "sans" },
      target: { size: 11, color: "#6f5d54", font: "sans" },
      scheduleLabel: { size: 11, color: "#8e5735", font: "sans" },
      schedule: { size: 11, color: "#6f5d54", font: "sans" },
      cta: { size: 13, color: "#8e5735", font: "sans" }
    },
    tablet: {
      headline: { size: 20, color: "#1d120f", font: "sans" },
      description: { size: 13, color: "#6f5d54", font: "sans" },
      targetLabel: { size: 12, color: "#8e5735", font: "sans" },
      target: { size: 12, color: "#6f5d54", font: "sans" },
      scheduleLabel: { size: 12, color: "#8e5735", font: "sans" },
      schedule: { size: 12, color: "#6f5d54", font: "sans" },
      cta: { size: 14, color: "#8e5735", font: "sans" }
    }
  };

  function clone(value) {
    return typeof structuredClone === "function"
      ? structuredClone(value)
      : JSON.parse(JSON.stringify(value));
  }

  function isSection(sectionId) {
    return sectionId === "program" || /^program\d+$/.test(String(sectionId));
  }

  function getRelativeLuminance(hexColor) {
    const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hexColor || ""));
    if (!match) return null;
    const channels = match.slice(1).map((value) => {
      const channel = Number.parseInt(value, 16) / 255;
      return channel <= .03928 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
    });
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  }

  function getContrastRatio(firstColor, secondColor) {
    const first = getRelativeLuminance(firstColor);
    const second = getRelativeLuminance(secondColor);
    if (first === null || second === null) return 1;
    return (Math.max(first, second) + .05) / (Math.min(first, second) + .05);
  }

  function getReadableTextColor(background, preferred = "#8e5735") {
    if (getContrastRatio(background, preferred) >= 4.5) return preferred;
    const candidates = ["#ffffff", "#1d120f"];
    return candidates.sort((a, b) => getContrastRatio(background, b) - getContrastRatio(background, a))[0];
  }

  function createDefaultModel() {
    return {
      headline: "프로그램 소개",
      description: "대상과 관심 분야에 맞는 프로그램을 빠르게 찾아보세요.",
      monthlyIcon: "calendar",
      monthlyLabel: "이번 달 운영 프로그램",
      recruitingIcon: "users",
      recruitingLabel: "모집 중 프로그램",
      summaryNote: "관심 있는 프로그램을 선택해 자세한 내용을 확인해 보세요.",
      activeCategoryId: "all",
      nextCategoryId: 6,
      nextCardId: 5,
      categoryEditorOpen: false,
      textStyles: clone(TEXT_STYLE_DEFAULTS),
      categories: [
        { id: "all", label: "전체 프로그램 보기" },
        { id: "children", label: "아동·청소년" },
        { id: "senior", label: "어르신" },
        { id: "family", label: "가족" },
        { id: "community", label: "지역주민" },
        { id: "case", label: "사례관리 연계" }
      ].map(normalizeCategory),
      cards: [
        {
          id: "program-card-1",
          categoryId: "children",
          status: "모집 중",
          headline: "꿈꾸는 아이 교실",
          description: "아동의 학습 및 정서 발달을 지원하는 방과 후 프로그램입니다.",
          target: "초등학생 1~6학년",
          schedule: "매주 화, 목 16:00 ~ 18:00",
          cta: "자세히 보기",
          image: null,
          tone: "green"
        },
        {
          id: "program-card-2",
          categoryId: "senior",
          status: "모집 중",
          headline: "행복한 노년 아카데미",
          description: "어르신의 건강한 노후와 평생학습을 지원하는 프로그램입니다.",
          target: "만 60세 이상 어르신",
          schedule: "매주 월, 수 10:00 ~ 12:00",
          cta: "신청하기",
          image: null,
          tone: "gold"
        },
        {
          id: "program-card-3",
          categoryId: "family",
          status: "모집 중",
          headline: "가족 힐링 나들이",
          description: "가족 간 유대감 향상과 정서적 안정을 위한 체험형 나들이 프로그램입니다.",
          target: "가족 단위 (초등 자녀 포함)",
          schedule: "6. 15.(토) 09:00 ~ 17:00",
          cta: "자세히 보기",
          image: null,
          tone: "orange"
        },
        {
          id: "program-card-4",
          categoryId: "community",
          status: "모집 예정",
          headline: "함께 만드는 마을",
          description: "지역 주민이 함께 참여하는 마을 환경 개선 활동입니다.",
          target: "지역주민 누구나",
          schedule: "매월 셋째 주 토요일 10:00",
          cta: "자세히 보기",
          image: null,
          tone: "blue"
        }
      ],
      heights: {}
    };
  }

  function normalizeCategory(category, index) {
    return {
      id: String(category?.id || `program-category-${index + 1}`),
      label: String(category?.label || "새 분야"),
      textStyles: normalizeCategoryTextStyles(category?.textStyles)
    };
  }

  function normalizeCard(card, index, categoryIds) {
    const assignableCategoryIds = categoryIds.filter((id) => id !== "all");
    const fallbackCategory = assignableCategoryIds[0] || "all";
    const requestedBackground = /^#[0-9a-f]{6}$/i.test(String(card?.ctaBackground || ""))
      ? String(card.ctaBackground)
      : index === 1 ? "#b47c50" : "#fffdf9";
    const ctaBackground = index === 1 && requestedBackground.toLowerCase() === "#b47c50"
      ? "#8e5735"
      : requestedBackground;
    const textStyles = normalizeCardTextStyles(card?.textStyles);
    ["desktop", "phoneSmall", "phone", "tablet"].forEach((viewport) => {
      textStyles[viewport].cta.color = getReadableTextColor(ctaBackground, textStyles[viewport].cta.color);
    });
    textStyles.mobile = textStyles.phone;
    return {
      id: String(card?.id || `program-card-${index + 1}`),
      categoryId: assignableCategoryIds.includes(card?.categoryId) ? card.categoryId : fallbackCategory,
      status: STATUS_OPTIONS.includes(card?.status) ? card.status : "모집 중",
      headline: String(card?.headline || "새 프로그램"),
      description: String(card?.description || "프로그램 소개를 입력해 주세요."),
      targetLabel: String(card?.targetLabel || "대상"),
      target: String(card?.target || "대상을 입력해 주세요."),
      scheduleLabel: String(card?.scheduleLabel || "일정"),
      schedule: String(card?.schedule || "일정을 입력해 주세요."),
      cta: String(card?.cta || "자세히 보기"),
      ctaBackground,
      image: card?.image?.dataUrl ? clone(card.image) : null,
      tone: ["green", "gold", "orange", "blue"].includes(card?.tone) ? card.tone : "green",
      textStyles
    };
  }

  function normalizeTextStyle(style, fallback) {
    return {
      size: Math.max(8, Math.min(96, Number(style?.size) || fallback.size)),
      color: typeof style?.color === "string" && style.color ? style.color : fallback.color,
      font: ["serif", "batang", "sans", "rounded"].includes(style?.font) ? style.font : fallback.font
    };
  }

  function normalizeTextStyles(styles = {}) {
    const normalized = {};
    Object.entries(TEXT_STYLE_DEFAULTS).forEach(([viewport, defaults]) => {
      const source = styles?.[viewport] ?? (viewport === "phone" ? styles?.mobile : null) ?? {};
      normalized[viewport] = Object.fromEntries(
        Object.entries(defaults).map(([field, fallback]) => [field, normalizeTextStyle(source[field], fallback)])
      );
    });
    normalized.mobile = normalized.phone;
    return normalized;
  }

  function normalizeSummaryIcon(value, fallback) {
    const legacyIcons = { "월": "calendar", "운": "calendar", "중": "users" };
    const normalized = legacyIcons[String(value ?? "")] ?? String(value ?? "");
    return SUMMARY_ICON_KEYS.includes(normalized) ? normalized : fallback;
  }

  function normalizeCategoryTextStyles(styles = {}) {
    const normalized = {};
    Object.entries(CATEGORY_TEXT_STYLE_DEFAULTS).forEach(([viewport, fallback]) => {
      const source = styles?.[viewport] ?? (viewport === "phone" ? styles?.mobile : null);
      normalized[viewport] = normalizeTextStyle(source, fallback);
    });
    normalized.mobile = normalized.phone;
    return normalized;
  }

  function normalizeCardTextStyles(styles = {}) {
    const normalized = {};
    Object.entries(CARD_TEXT_STYLE_DEFAULTS).forEach(([viewport, defaults]) => {
      const source = styles?.[viewport] ?? (viewport === "phone" ? styles?.mobile : null) ?? {};
      normalized[viewport] = Object.fromEntries(
        Object.entries(defaults).map(([field, fallback]) => [field, normalizeTextStyle(source[field], fallback)])
      );
    });
    normalized.mobile = normalized.phone;
    return normalized;
  }

  function normalizeModel(model = {}) {
    const fallback = createDefaultModel();
    const sourceCategories = Array.isArray(model.categories) && model.categories.length
      ? model.categories
      : fallback.categories;
    const categories = sourceCategories.map(normalizeCategory);
    if (!categories.some((category) => category.id === "all")) {
      categories.unshift(normalizeCategory({ id: "all", label: "전체 프로그램 보기" }, 0));
    }
    const categoryIds = categories.map((category) => category.id);
    const sourceCards = Array.isArray(model.cards) ? model.cards : fallback.cards;
    const cards = sourceCards.map((card, index) => normalizeCard(card, index, categoryIds));
    const activeCategoryId = categoryIds.includes(model.activeCategoryId) ? model.activeCategoryId : "all";
    return {
      headline: String(model.headline ?? fallback.headline),
      description: String(model.description ?? fallback.description),
      monthlyIcon: normalizeSummaryIcon(model.monthlyIcon, fallback.monthlyIcon),
      monthlyLabel: String(model.monthlyLabel ?? fallback.monthlyLabel),
      recruitingIcon: normalizeSummaryIcon(model.recruitingIcon, fallback.recruitingIcon),
      recruitingLabel: String(model.recruitingLabel ?? fallback.recruitingLabel),
      summaryNote: String(model.summaryNote ?? fallback.summaryNote),
      activeCategoryId,
      nextCategoryId: Math.max(Number(model.nextCategoryId) || 1, categories.length + 1),
      nextCardId: Math.max(Number(model.nextCardId) || 1, cards.length + 1),
      categoryEditorOpen: Boolean(model.categoryEditorOpen),
      categoryCtaBackground: /^#[0-9a-f]{6}$/i.test(String(model.categoryCtaBackground || ""))
        ? String(model.categoryCtaBackground).toLowerCase()
        : null,
      textStyles: normalizeTextStyles(model.textStyles),
      categories,
      cards,
      heights: model.heights && typeof model.heights === "object" ? clone(model.heights) : {}
    };
  }

  function getVisibleCards(model) {
    const normalized = normalizeModel(model);
    return normalized.activeCategoryId === "all"
      ? normalized.cards
      : normalized.cards.filter((card) => card.categoryId === normalized.activeCategoryId);
  }

  function getSummaryCounts(model) {
    const normalized = normalizeModel(model);
    return {
      total: normalized.cards.length,
      recruiting: normalized.cards.filter((card) => card.status === "모집 중").length
    };
  }

  function estimateHeight(model, viewport) {
    const cardCount = Math.max(1, getVisibleCards(model).length);
    if (viewport === "desktop") return 850 + Math.max(0, Math.ceil(cardCount / 4) - 1) * 430;
    if (viewport === "tablet") return 700 + Math.ceil(cardCount / 2) * 390;
    return 430 + cardCount * 236;
  }

  window.EditorProgramManager = Object.freeze({
    STATUS_OPTIONS,
    SUMMARY_ICON_KEYS,
    CATEGORY_TEXT_STYLE_DEFAULTS,
    CARD_TEXT_STYLE_DEFAULTS,
    TEXT_STYLE_DEFAULTS,
    createDefaultModel,
    estimateHeight,
    getSummaryCounts,
    getReadableTextColor,
    getVisibleCards,
    isSection,
    normalizeCategoryTextStyles,
    normalizeCardTextStyles,
    normalizeModel,
    normalizeTextStyles
  });
})();
