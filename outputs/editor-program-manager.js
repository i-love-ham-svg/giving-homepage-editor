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
      description: "사례관리·서비스제공·지역조직화 사업을 한눈에 확인하세요.",
      monthlyIcon: "calendar",
      monthlyLabel: "운영 프로그램",
      recruitingIcon: "users",
      recruitingLabel: "참여 안내 프로그램",
      summaryNote: "모집 일정과 이용료는 변경될 수 있으니 복지관에 문의해 주세요.",
      imageSetVersion: "official-program-images-20260804",
      activeCategoryId: "all",
      nextCategoryId: 6,
      nextCardId: 17,
      categoryEditorOpen: false,
      textStyles: clone(TEXT_STYLE_DEFAULTS),
      categories: [
        { id: "all", label: "전체 프로그램 보기" },
        { id: "case", label: "사례관리" },
        { id: "children", label: "아동·가족" },
        { id: "senior", label: "어르신" },
        { id: "community", label: "지역주민" },
        { id: "network", label: "지역조직화" }
      ].map(normalizeCategory),
      cards: [
        {
          id: "program-card-1",
          categoryId: "case",
          status: "모집 중",
          headline: "아동 심리·정서 지원",
          description: "1:1 놀이·미술치료를 통해 아동의 건강한 심리정서 발달을 지원합니다.",
          target: "당진시 거주 5~13세 아동",
          schedule: "상담 후 개별 일정 안내",
          cta: "자세히 보기",
          image: { name: "아동 놀이·미술치료", dataUrl: "./assets/generated/child-play-therapy.png", naturalWidth: 1536, naturalHeight: 1024, fit: "cover" },
          tone: "green"
        },
        {
          id: "program-card-2",
          categoryId: "community",
          status: "모집 중",
          headline: "취미·여가 프로그램",
          description: "요가, 장구난타, 라인댄스, 통기타 등 건강한 여가활동을 지원합니다.",
          target: "지역주민",
          schedule: "1~12월 · 분기별 접수",
          cta: "문의하기",
          image: { name: "지역주민 취미·여가 강좌", dataUrl: "./assets/generated/community-hobby-class.png", naturalWidth: 1536, naturalHeight: 1024, fit: "cover" },
          tone: "gold"
        },
        {
          id: "program-card-3",
          categoryId: "senior",
          status: "모집 중",
          headline: "송악실버학당",
          description: "생활체조와 레크리에이션, 건강교육으로 활기찬 노후생활을 지원합니다.",
          target: "지역 어르신",
          schedule: "3~11월 · 매주 목요일 10:00~12:00",
          cta: "자세히 보기",
          image: { name: "공식 송악실버학당 영상", dataUrl: "./assets/official-sacwc/d0208f4cdada8c07.jpg", naturalWidth: 0, naturalHeight: 0, fit: "cover" },
          tone: "orange"
        },
        {
          id: "program-card-4",
          categoryId: "community",
          status: "모집 중",
          headline: "원데이 클래스",
          description: "다양한 만들기 체험을 통해 이웃의 소통과 관계를 잇는 프로그램입니다.",
          target: "지역주민 누구나",
          schedule: "2~11월 · 토요일 13:00~15:00",
          cta: "자세히 보기",
          image: { name: "지역복지관 통합 프로그램", dataUrl: "./assets/generated/community-program-banner.png", naturalWidth: 1800, naturalHeight: 905, fit: "cover" },
          tone: "blue"
        },
        {
          id: "program-card-5",
          categoryId: "children",
          status: "모집 중",
          headline: "육아나눔터",
          description: "장난감과 놀이시설을 갖춘 안전한 실내 놀이터를 운영합니다.",
          target: "지역 아동·가족 및 단체",
          schedule: "월~토요일 · 운영시간 별도 안내",
          cta: "이용 문의",
          image: { name: "공식 송악 워터 PLAY", dataUrl: "./assets/official-sacwc/eeffc60f19126d72.jpg", naturalWidth: 0, naturalHeight: 0, fit: "cover" },
          tone: "green"
        },
        {
          id: "program-card-6",
          categoryId: "community",
          status: "모집 예정",
          headline: "송악상영관",
          description: "문화생활을 위한 정기 영화상영과 찾아가는 이동복지관 상영을 운영합니다.",
          target: "지역주민",
          schedule: "연중 · 월 2회",
          cta: "일정 확인",
          image: { name: "공식 복지관 이야기 영상", dataUrl: "./assets/official-sacwc/682cb28d0eb119ff.jpg", naturalWidth: 0, naturalHeight: 0, fit: "cover" },
          tone: "gold"
        },
        { id: "official-program-7", categoryId: "case", status: "모집 예정", headline: "사례관리사업", description: "복합적인 어려움이 있는 주민의 욕구를 파악하고 지역자원을 연결해 통합 맞춤형 서비스를 제공합니다.", target: "복합적 도움이 필요한 지역주민", schedule: "접수·상담 후 개별 안내", cta: "상담 문의", image: { name: "사례관리 상담", dataUrl: "./assets/generated/case-management-consultation.png", naturalWidth: 1536, naturalHeight: 1024, fit: "cover" }, tone: "green" },
        { id: "official-program-8", categoryId: "children", status: "모집 예정", headline: "MOM편한 아동 심리·정서 지원", description: "아동의 건강한 성장과 가족 기능 향상을 위한 심리·정서 지원 프로그램입니다.", target: "심리·정서 지원이 필요한 아동", schedule: "초기상담 및 서류 확인 후 안내", cta: "이용 안내", image: { name: "아동 그룹 정서지원", dataUrl: "./assets/generated/children-emotional-group.png", naturalWidth: 1536, naturalHeight: 1024, fit: "cover" }, tone: "gold" },
        { id: "official-program-9", categoryId: "children", status: "모집 예정", headline: "가족기능강화사업", description: "부모와 자녀가 긍정적인 관계를 형성하고 가족의 기능을 높일 수 있도록 지원합니다.", target: "지역 아동·가족", schedule: "프로그램별 별도 안내", cta: "참여 문의", image: { name: "부모·자녀 가족활동", dataUrl: "./assets/generated/family-strengthening-activity.png", naturalWidth: 1536, naturalHeight: 1024, fit: "cover" }, tone: "orange" },
        { id: "official-program-10", categoryId: "children", status: "모집 예정", headline: "지구별 환경지킴이", description: "여름방학 동안 아동이 환경의 소중함을 배우고 실천하는 체험형 프로그램입니다.", target: "지역 아동", schedule: "여름방학 중 운영", cta: "일정 확인", image: { name: "공식 당진환경사랑미술대회", dataUrl: "./assets/official-sacwc/a50cd70a78e3ba38.jpg", naturalWidth: 0, naturalHeight: 0, fit: "cover" }, tone: "blue" },
        { id: "official-program-11", categoryId: "community", status: "모집 예정", headline: "사회교육사업", description: "지역주민의 배움과 여가, 건강한 생활을 위한 다양한 교육 프로그램을 운영합니다.", target: "지역주민", schedule: "강좌별 별도 안내", cta: "강좌 문의", image: { name: "공식 프로그램 소개", dataUrl: "./assets/official-sacwc/36ece9004871a87f.jpg", naturalWidth: 0, naturalHeight: 0, fit: "cover" }, tone: "green" },
        { id: "official-program-12", categoryId: "community", status: "모집 예정", headline: "복지관 식당 운영", description: "지역주민의 건강한 식생활을 지원하기 위해 복지관 식당을 운영합니다.", target: "복지관 이용 주민", schedule: "운영일·이용방법 별도 안내", cta: "이용 문의", image: { name: "복지관 식당 배식", dataUrl: "./assets/generated/welfare-center-cafeteria.png", naturalWidth: 1536, naturalHeight: 1024, fit: "cover" }, tone: "gold" },
        { id: "official-program-13", categoryId: "children", status: "모집 예정", headline: "가족愛퐁당", description: "가족이 함께 참여하고 소통하며 추억을 만드는 가족 참여 행사입니다.", target: "지역 아동·가족", schedule: "행사 일정 별도 공지", cta: "행사 확인", image: { name: "공식 어버이날 이야기", dataUrl: "./assets/official-sacwc/a9a7bc4361df793e.jpg", naturalWidth: 0, naturalHeight: 0, fit: "cover" }, tone: "orange" },
        { id: "official-program-14", categoryId: "senior", status: "모집 예정", headline: "치매·우울 예방 프로그램", description: "어르신의 인지·정서 건강을 돕고 활기찬 일상을 지원합니다.", target: "지역 어르신", schedule: "운영 일정 별도 안내", cta: "참여 문의", image: { name: "어르신 인지·정서 활동", dataUrl: "./assets/generated/senior-cognitive-health.png", naturalWidth: 1536, naturalHeight: 1024, fit: "cover" }, tone: "blue" },
        { id: "official-program-15", categoryId: "network", status: "모집 예정", headline: "복지네트워크 구축", description: "지역 기관과 협력체계를 구축해 주민에게 필요한 복지서비스를 효과적으로 연결합니다.", target: "지역주민·유관기관", schedule: "연중", cta: "연계 문의", image: { name: "공식 주민만나기 캠페인", dataUrl: "./assets/official-sacwc/8686126a0b0c2c4c.jpg", naturalWidth: 0, naturalHeight: 0, fit: "cover" }, tone: "green" },
        { id: "official-program-16", categoryId: "network", status: "모집 예정", headline: "주민조직화·자원개발", description: "주민 모임과 동아리, 자원봉사·후원 자원을 발굴하고 지역 공동체 활동을 지원합니다.", target: "지역주민·단체", schedule: "연중", cta: "참여 문의", image: { name: "자원봉사 지원 활동", dataUrl: "./assets/generated/volunteer-support-banner.png", naturalWidth: 1717, naturalHeight: 916, fit: "cover" }, tone: "gold" }
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
      image: card?.image?.dataUrl ? {
        ...clone(card.image),
        fit: card.image.fit === "contain" ? "contain" : "cover",
        scale: Math.max(.2, Math.min(4, Number(card.image.scale) || 1)),
        opacity: Math.max(0, Math.min(100, Number(card.image.opacity ?? 100)))
      } : null,
      tone: ["green", "gold", "orange", "blue"].includes(card?.tone) ? card.tone : "green",
      textStyles
    };
  }

  function normalizeTextStyle(style, fallback) {
    return {
      size: Math.max(8, Math.min(96, Number(style?.size) || fallback.size)),
      color: typeof style?.color === "string" && style.color ? style.color : fallback.color,
      font: ["serif", "batang", "sans", "rounded"].includes(style?.font) ? style.font : fallback.font,
      align: ["left", "center", "right"].includes(style?.align) ? style.align : (fallback.align || ""),
      boxWidth: Math.max(30, Math.min(100, Number(style?.boxWidth ?? fallback.boxWidth ?? 100))),
      boxOffsetX: Math.max(-320, Math.min(320, Number(style?.boxOffsetX ?? fallback.boxOffsetX ?? 0))),
      boxOffsetY: Math.max(-320, Math.min(320, Number(style?.boxOffsetY ?? fallback.boxOffsetY ?? 0)))
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
      imageSetVersion: String(model.imageSetVersion || ""),
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
