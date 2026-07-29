(function () {
  "use strict";

  const VIEWPORTS = ["desktop", "phoneSmall", "phone", "tablet"];
  const HEIGHT_VERSION = 2;
  const LEGACY_ICONS = Object.freeze({
    "clipboard-edit": {
      label: "상담 신청",
      body: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M8 9h6M8 13h4M14.5 17.5l4-4 2 2-4 4-3 .8z"/>'
    },
    "users-chat": {
      label: "초기 상담",
      body: '<circle cx="8" cy="9" r="3"/><circle cx="17" cy="9" r="3"/><path d="M2.5 20c.4-4 2.2-6 5.5-6s5.1 2 5.5 6M12.5 20c.3-3.2 1.8-5 4.5-5s4.2 1.8 4.5 5M10 3h7l3 3-3 3h-2"/>'
    },
    "user-search": {
      label: "욕구 파악",
      body: '<circle cx="10" cy="9" r="4"/><path d="M3 20c.5-4.3 2.8-6.5 7-6.5 2 0 3.6.5 4.8 1.5M16 16l5 5M17.5 17.5a4 4 0 1 0-5.7-5.7"/>'
    },
    "clipboard-check": {
      label: "계획 수립",
      body: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M8 9l1.5 1.5L12 8M8 14l1.5 1.5L12 13M14 9h2M14 14h2"/>'
    },
    handshake: {
      label: "자원 연계",
      body: '<path d="M3 12l4-4 4 2 2-2 4 2 4 4-4 5-3-1-2 2-2-2-2 1-5-5zM7 8l2-3 4 2 2-2 4 3-2 2M9 13l4 4M12 11l4 4"/>'
    },
    "report-check": {
      label: "사후관리",
      body: '<rect x="4" y="3" width="14" height="18" rx="2"/><path d="M8 3V1h6v2M8 16v-3M11 16V9M14 16v-5M16 19l2 2 4-5"/>'
    },
    message: {
      label: "상담",
      body: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>'
    },
    clipboard: {
      label: "계획",
      body: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M8 9h8M8 13h8M8 17h5"/>'
    },
    network: {
      label: "연계",
      body: '<circle cx="12" cy="5" r="3"/><circle cx="5" cy="18" r="3"/><circle cx="19" cy="18" r="3"/><path d="M10 7.5L6.5 15M14 7.5l3.5 7.5M8 18h8"/>'
    },
    home: {
      label: "지원",
      body: '<path d="M3 11l9-8 9 8v10h-6v-6H9v6H3z"/><path d="M9 11h6"/>'
    },
    calendar: {
      label: "일정",
      body: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>'
    },
    clock: {
      label: "시간",
      body: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
    },
    heart: {
      label: "돌봄",
      body: '<path d="M20.8 5.8a5.5 5.5 0 0 0-7.8 0L12 6.9l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.4a5.5 5.5 0 0 0 0-7.8z"/>'
    },
    gift: {
      label: "후원",
      body: '<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18M12 8H7.5a2.5 2.5 0 1 1 0-5C10.5 3 12 8 12 8zm0 0h4.5a2.5 2.5 0 1 0 0-5C13.5 3 12 8 12 8z"/>'
    },
    megaphone: {
      label: "홍보",
      body: '<path d="M3 11v4h4l9 4V7l-9 4H3zM7 15l2 6h3l-2-5M19 9l2-2M19 17l2 2M20 13h3"/>'
    },
    "book-open": {
      label: "교육",
      body: '<path d="M3 5.5A5.5 5.5 0 0 1 8.5 5H12v15H8.5A5.5 5.5 0 0 0 3 20.5zM21 5.5A5.5 5.5 0 0 0 15.5 5H12v15h3.5a5.5 5.5 0 0 1 5.5.5z"/>'
    },
    medical: {
      label: "건강",
      body: '<circle cx="12" cy="12" r="9"/><path d="M9 7h6v3h3v5h-3v3H9v-3H6v-5h3z"/>'
    },
    phone: {
      label: "전화",
      body: '<path d="M5 3h4l2 5-3 2a16 16 0 0 0 6 6l2-3 5 2v4c0 1.1-.9 2-2 2C10.2 21 3 13.8 3 5a2 2 0 0 1 2-2z"/>'
    },
    mail: {
      label: "안내",
      body: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'
    },
    "map-pin": {
      label: "방문",
      body: '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="3"/>'
    },
    "file-text": {
      label: "서류",
      body: '<path d="M6 2h8l4 4v16H6zM14 2v5h5M9 12h6M9 16h6"/>'
    },
    "check-circle": {
      label: "완료",
      body: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 6-7"/>'
    },
    lightbulb: {
      label: "아이디어",
      body: '<path d="M9 18h6M10 22h4M8.5 15.5A7 7 0 1 1 15.5 15.5c-.9.7-1.5 1.4-1.5 2.5h-4c0-1.1-.6-1.8-1.5-2.5z"/>'
    },
    shield: {
      label: "보호",
      body: '<path d="M12 2l8 3v6c0 5.2-3.4 9-8 11-4.6-2-8-5.8-8-11V5z"/><path d="M9 12l2 2 4-5"/>'
    },
    users: {
      label: "모임",
      body: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c.4-4.2 2.4-6.3 6-6.3s5.6 2.1 6 6.3M14 15c3.8-.5 6 1.2 7 5"/>'
    },
    building: {
      label: "기관",
      body: '<path d="M4 22V4h11v18M15 9h5v13M8 8h3M8 12h3M8 16h3M18 13h.01M18 17h.01M2 22h20"/>'
    }
  });

  const ICONS = window.EditorVisualAssetManager?.ICONS ?? LEGACY_ICONS;

  const SECTION_STYLE_DEFAULTS = Object.freeze({
    desktop: {
      kicker: { size: 20, color: "#8e5735", font: "sans" },
      headline: { size: 54, color: "#1d120f", font: "sans" },
      description: { size: 19, color: "#5f514b", font: "sans" }
    },
    phoneSmall: {
      kicker: { size: 14, color: "#8e5735", font: "sans" },
      headline: { size: 34, color: "#1d120f", font: "sans" },
      description: { size: 15, color: "#5f514b", font: "sans" }
    },
    phone: {
      kicker: { size: 15, color: "#8e5735", font: "sans" },
      headline: { size: 38, color: "#1d120f", font: "sans" },
      description: { size: 16, color: "#5f514b", font: "sans" }
    },
    tablet: {
      kicker: { size: 17, color: "#8e5735", font: "sans" },
      headline: { size: 46, color: "#1d120f", font: "sans" },
      description: { size: 18, color: "#5f514b", font: "sans" }
    }
  });

  const STEP_STYLE_DEFAULTS = Object.freeze({
    desktop: {
      title: { size: 21, color: "#8e5735", font: "sans" },
      description: { size: 14, color: "#5f514b", font: "sans" }
    },
    phoneSmall: {
      title: { size: 18, color: "#8e5735", font: "sans" },
      description: { size: 13, color: "#5f514b", font: "sans" }
    },
    phone: {
      title: { size: 20, color: "#8e5735", font: "sans" },
      description: { size: 14, color: "#5f514b", font: "sans" }
    },
    tablet: {
      title: { size: 21, color: "#8e5735", font: "sans" },
      description: { size: 15, color: "#5f514b", font: "sans" }
    }
  });

  const HIGHLIGHT_STYLE_DEFAULTS = Object.freeze({
    desktop: {
      title: { size: 20, color: "#8e5735", font: "sans" },
      description: { size: 14, color: "#5f514b", font: "sans" }
    },
    phoneSmall: {
      title: { size: 14, color: "#8e5735", font: "sans" },
      description: { size: 11, color: "#5f514b", font: "sans" }
    },
    phone: {
      title: { size: 15, color: "#8e5735", font: "sans" },
      description: { size: 12, color: "#5f514b", font: "sans" }
    },
    tablet: {
      title: { size: 18, color: "#8e5735", font: "sans" },
      description: { size: 13, color: "#5f514b", font: "sans" }
    }
  });

  function clone(value) {
    return typeof structuredClone === "function"
      ? structuredClone(value)
      : JSON.parse(JSON.stringify(value));
  }

  function isSection(sectionId) {
    return sectionId === "process" || /^process\d+$/.test(String(sectionId));
  }

  function normalizeTextStyle(style, fallback) {
    return {
      size: Math.max(8, Math.min(96, Number(style?.size) || fallback.size)),
      color: typeof style?.color === "string" && style.color ? style.color : fallback.color,
      font: ["serif", "batang", "sans", "rounded"].includes(style?.font) ? style.font : fallback.font
    };
  }

  function normalizeStyleSet(styles, defaults) {
    const normalized = {};
    VIEWPORTS.forEach((viewport) => {
      const source = styles?.[viewport] ?? (viewport === "phone" ? styles?.mobile : null) ?? {};
      normalized[viewport] = Object.fromEntries(
        Object.entries(defaults[viewport]).map(([field, fallback]) => [field, normalizeTextStyle(source[field], fallback)])
      );
    });
    normalized.mobile = normalized.phone;
    return normalized;
  }

  function normalizeIcon(icon, fallback) {
    return ICONS[icon] ? icon : fallback;
  }

  function normalizeStep(step, index) {
    const fallbackIcons = ["clipboard-edit", "users-chat", "user-search", "clipboard-check", "handshake", "report-check"];
    return {
      id: String(step?.id || `process-step-${index + 1}`),
      icon: normalizeIcon(step?.icon, fallbackIcons[index % fallbackIcons.length]),
      title: String(step?.title || "새 단계"),
      description: String(step?.description || "단계에 대한 설명을 입력해 주세요."),
      textStyles: normalizeStyleSet(step?.textStyles, STEP_STYLE_DEFAULTS)
    };
  }

  function normalizeHighlight(item, index) {
    const fallbackIcons = ["message", "clipboard", "network"];
    return {
      id: String(item?.id || `process-highlight-${index + 1}`),
      icon: normalizeIcon(item?.icon, fallbackIcons[index % fallbackIcons.length]),
      title: String(item?.title || "핵심 지원"),
      description: String(item?.description || "핵심 내용을 입력해 주세요."),
      textStyles: normalizeStyleSet(item?.textStyles, HIGHLIGHT_STYLE_DEFAULTS)
    };
  }

  function createDefaultModel() {
    return normalizeModel({
      kicker: "송악사회복지관 사례관리",
      headline: "사례관리 과정",
      description: "혼자 해결하기 어려운 문제를 함께 살피고, 필요한 지원을 차근차근 연결합니다.",
      nextStepId: 7,
      nextHighlightId: 4,
      steps: [
        { icon: "clipboard-edit", title: "상담 신청", description: "도움이 필요할 때 상담을 신청합니다." },
        { icon: "users-chat", title: "초기 상담", description: "현재 상황을 함께 이야기합니다." },
        { icon: "user-search", title: "욕구 및 상황 파악", description: "생활과 어려움을 종합적으로 살핍니다." },
        { icon: "clipboard-check", title: "서비스 계획 수립", description: "필요한 지원 방향을 함께 정합니다." },
        { icon: "handshake", title: "자원 연계", description: "복지서비스와 지역 자원을 연결합니다." },
        { icon: "report-check", title: "점검 및 사후관리", description: "변화와 추가 필요를 지속적으로 확인합니다." }
      ],
      highlights: [
        { icon: "message", title: "상담", description: "마음에 귀 기울이는 첫걸음" },
        { icon: "clipboard", title: "계획", description: "함께 만드는 맞춤형 지원 계획" },
        { icon: "network", title: "연계", description: "필요한 자원을 연결해 함께 걷는 동행" }
      ]
    });
  }

  function normalizeModel(model = {}) {
    const hasSteps = Array.isArray(model.steps);
    const hasHighlights = Array.isArray(model.highlights);
    const steps = (hasSteps ? model.steps : []).map(normalizeStep);
    const highlights = (hasHighlights ? model.highlights : []).map(normalizeHighlight);
    return {
      kicker: String(model.kicker || "사례관리 프로세스"),
      headline: String(model.headline || "사례관리 과정"),
      description: String(model.description || "필요한 지원을 차근차근 연결합니다."),
      nextStepId: Math.max(Number(model.nextStepId) || 1, steps.length + 1),
      nextHighlightId: Math.max(Number(model.nextHighlightId) || 1, highlights.length + 1),
      textStyles: normalizeStyleSet(model.textStyles, SECTION_STYLE_DEFAULTS),
      steps: hasSteps ? steps : [normalizeStep({}, 0)],
      highlights: hasHighlights ? highlights : [normalizeHighlight({}, 0)],
      heightVersion: HEIGHT_VERSION,
      heights: Number(model.heightVersion) === HEIGHT_VERSION
        && typeof model.heights === "object"
        && model.heights
        ? clone(model.heights)
        : {}
    };
  }

  function addStep(model, afterStepId = null) {
    const next = normalizeModel(model);
    const index = next.steps.length;
    const step = normalizeStep({ id: `process-step-${next.nextStepId++}`, title: "새 단계" }, index);
    const afterIndex = afterStepId ? next.steps.findIndex((item) => item.id === afterStepId) : -1;
    next.steps.splice(afterIndex >= 0 ? afterIndex + 1 : next.steps.length, 0, step);
    return next;
  }

  function removeStep(model, stepId) {
    const next = normalizeModel(model);
    next.steps = next.steps.filter((item) => item.id !== stepId);
    return next;
  }

  function addHighlight(model, afterHighlightId = null) {
    const next = normalizeModel(model);
    const index = next.highlights.length;
    const highlight = normalizeHighlight({ id: `process-highlight-${next.nextHighlightId++}` }, index);
    const afterIndex = afterHighlightId ? next.highlights.findIndex((item) => item.id === afterHighlightId) : -1;
    next.highlights.splice(afterIndex >= 0 ? afterIndex + 1 : next.highlights.length, 0, highlight);
    return next;
  }

  function removeHighlight(model, itemId) {
    const next = normalizeModel(model);
    next.highlights = next.highlights.filter((item) => item.id !== itemId);
    return next;
  }

  function moveItem(list, itemId, direction) {
    const next = [...list];
    const index = next.findIndex((item) => item.id === itemId);
    const target = index + (direction === "up" ? -1 : 1);
    if (index < 0 || target < 0 || target >= next.length) return next;
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  }

  function estimateHeight(model, viewport = "desktop") {
    const normalized = normalizeModel(model);
    if (viewport === "desktop") {
      const stepHeight = normalized.steps.length ? 390 + Math.max(0, normalized.steps.length - 6) * 28 : 0;
      const highlightRows = normalized.highlights.length ? Math.ceil(normalized.highlights.length / 4) : 0;
      return 300 + stepHeight + highlightRows * 140;
    }
    const stepHeight = viewport === "phoneSmall" ? 154 : viewport === "phone" ? 164 : 176;
    const summaryRows = Math.ceil(normalized.highlights.length / (viewport === "tablet" ? 3 : 1));
    return 300 + normalized.steps.length * stepHeight + summaryRows * 118;
  }

  window.EditorProcessManager = Object.freeze({
    ICONS,
    VIEWPORTS,
    addHighlight,
    addStep,
    createDefaultModel,
    estimateHeight,
    isSection,
    moveItem,
    normalizeModel,
    removeHighlight,
    removeStep
  });
})();
