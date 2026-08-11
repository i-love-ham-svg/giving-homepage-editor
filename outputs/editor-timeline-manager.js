(function () {
  "use strict";

  const VIEWPORTS = ["desktop", "phoneSmall", "phone", "tablet"];
  const HEIGHT_VERSION = 1;
  const LEGACY_ICONS = Object.freeze({
    calendar: { label: "달력", body: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18M7 14h3M14 14h3M7 18h3M14 18h3"/>' },
    users: { label: "사람들", body: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c.4-4.2 2.4-6.3 6-6.3s5.6 2.1 6 6.3M14 15c3.8-.5 6 1.2 7 5"/>' },
    building: { label: "기관", body: '<path d="M4 22V4h11v18M15 9h5v13M8 8h3M8 12h3M8 16h3M18 13h.01M18 17h.01M2 22h20"/>' },
    handshake: { label: "협력", body: '<path d="M3 12l4-4 4 2 2-2 4 2 4 4-4 5-3-1-2 2-2-2-2 1-5-5zM7 8l2-3 4 2 2-2 4 3-2 2M9 13l4 4M12 11l4 4"/>' },
    heart: { label: "나눔", body: '<path d="M20.8 5.8a5.5 5.5 0 0 0-7.8 0L12 6.9l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.4a5.5 5.5 0 0 0 0-7.8z"/>' },
    award: { label: "수상", body: '<circle cx="12" cy="8" r="5"/><path d="M8.5 12L7 22l5-3 5 3-1.5-10M10 8l1.3 1.3L14 6.5"/>' },
    sprout: { label: "성장", body: '<path d="M12 21V10M12 13c-5 0-8-3-8-8 5 0 8 3 8 8zm0-3c0-4 3-7 8-7 0 5-3 8-8 8"/>' },
    book: { label: "기록", body: '<path d="M3 5.5A5.5 5.5 0 0 1 8.5 5H12v15H8.5A5.5 5.5 0 0 0 3 20.5zM21 5.5A5.5 5.5 0 0 0 15.5 5H12v15h3.5a5.5 5.5 0 0 1 5.5.5z"/>' }
  });

  const ICONS = window.EditorVisualAssetManager?.ICONS ?? LEGACY_ICONS;

  const TEXT_DEFAULTS = Object.freeze({
    desktop: {
      eyebrow: { size: 20, color: "#9a5b37", font: "sans" },
      headline: { size: 54, color: "#211611", font: "serif" },
      archiveLabel: { size: 24, color: "#b77b50", font: "sans" },
      description: { size: 17, color: "#62534b", font: "sans" },
      ctaTitle: { size: 22, color: "#7d4a2f", font: "sans" },
      ctaDescription: { size: 14, color: "#66564e", font: "sans" },
      ctaButton: { size: 16, color: "#ffffff", font: "sans" }
    },
    phoneSmall: {
      eyebrow: { size: 13, color: "#9a5b37", font: "sans" },
      headline: { size: 36, color: "#211611", font: "serif" },
      archiveLabel: { size: 18, color: "#b77b50", font: "sans" },
      description: { size: 14, color: "#62534b", font: "sans" },
      ctaTitle: { size: 18, color: "#7d4a2f", font: "sans" },
      ctaDescription: { size: 12, color: "#66564e", font: "sans" },
      ctaButton: { size: 14, color: "#ffffff", font: "sans" }
    },
    phone: {
      eyebrow: { size: 14, color: "#9a5b37", font: "sans" },
      headline: { size: 40, color: "#211611", font: "serif" },
      archiveLabel: { size: 19, color: "#b77b50", font: "sans" },
      description: { size: 15, color: "#62534b", font: "sans" },
      ctaTitle: { size: 19, color: "#7d4a2f", font: "sans" },
      ctaDescription: { size: 13, color: "#66564e", font: "sans" },
      ctaButton: { size: 14, color: "#ffffff", font: "sans" }
    },
    tablet: {
      eyebrow: { size: 17, color: "#9a5b37", font: "sans" },
      headline: { size: 48, color: "#211611", font: "serif" },
      archiveLabel: { size: 22, color: "#b77b50", font: "sans" },
      description: { size: 16, color: "#62534b", font: "sans" },
      ctaTitle: { size: 21, color: "#7d4a2f", font: "sans" },
      ctaDescription: { size: 14, color: "#66564e", font: "sans" },
      ctaButton: { size: 15, color: "#ffffff", font: "sans" }
    }
  });

  const GROUP_TEXT_DEFAULTS = Object.freeze({
    desktop: { year: { size: 18, color: "#7a603f", font: "sans" }, month: { size: 38, color: "#436f31", font: "serif" } },
    phoneSmall: { year: { size: 14, color: "#7a603f", font: "sans" }, month: { size: 30, color: "#436f31", font: "serif" } },
    phone: { year: { size: 15, color: "#7a603f", font: "sans" }, month: { size: 32, color: "#436f31", font: "serif" } },
    tablet: { year: { size: 17, color: "#7a603f", font: "sans" }, month: { size: 36, color: "#436f31", font: "serif" } }
  });

  const EVENT_TEXT_DEFAULTS = Object.freeze({
    desktop: {
      date: { size: 18, color: "#6d9148", font: "sans" },
      title: { size: 16, color: "#211611", font: "sans" },
      description: { size: 12, color: "#66564e", font: "sans" }
    },
    phoneSmall: {
      date: { size: 13, color: "#6d9148", font: "sans" },
      title: { size: 13, color: "#211611", font: "sans" },
      description: { size: 10, color: "#66564e", font: "sans" }
    },
    phone: {
      date: { size: 15, color: "#6d9148", font: "sans" },
      title: { size: 14, color: "#211611", font: "sans" },
      description: { size: 11, color: "#66564e", font: "sans" }
    },
    tablet: {
      date: { size: 17, color: "#6d9148", font: "sans" },
      title: { size: 15, color: "#211611", font: "sans" },
      description: { size: 12, color: "#66564e", font: "sans" }
    }
  });

  function clone(value) {
    return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
  }

  function isSection(sectionId) {
    return sectionId === "history" || /^history\d+$/.test(String(sectionId));
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

  function normalizeStyleSet(styles, defaults) {
    const next = {};
    VIEWPORTS.forEach((viewport) => {
      const source = styles?.[viewport] ?? (viewport === "phone" ? styles?.mobile : null) ?? {};
      next[viewport] = Object.fromEntries(
        Object.entries(defaults[viewport]).map(([field, fallback]) => [field, normalizeTextStyle(source[field], fallback)])
      );
    });
    next.mobile = next.phone;
    return next;
  }

  function normalizeImage(image) {
    if (!image || typeof image !== "object") return null;
    const dataUrl = typeof image.dataUrl === "string" ? image.dataUrl : null;
    if (!dataUrl) return null;
    return {
      name: String(image.name || "연혁 이미지"),
      dataUrl,
      naturalWidth: Math.max(0, Number(image.naturalWidth) || 0),
      naturalHeight: Math.max(0, Number(image.naturalHeight) || 0),
      alt: String(image.alt || "콘셉트 이미지"),
      caption: String(image.caption || "콘셉트 이미지"),
      fit: image.fit === "contain" ? "contain" : "cover",
      scale: Math.max(.2, Math.min(4, Number(image.scale) || 1)),
      opacity: Math.max(0, Math.min(100, Number(image.opacity ?? 100)))
    };
  }

  function normalizeEvent(event, index, groupIndex) {
    return {
      id: String(event?.id || `history-event-${groupIndex + 1}-${index + 1}`),
      date: String(event?.date || "01.01"),
      title: String(event?.title || "새로운 이야기를 입력해 주세요"),
      description: String(event?.description || "연혁에 남길 내용을 간단히 입력해 주세요."),
      image: normalizeImage(event?.image),
      textStyles: normalizeStyleSet(event?.textStyles, EVENT_TEXT_DEFAULTS)
    };
  }

  function normalizeGroup(group, index) {
    const events = Array.isArray(group?.events) ? group.events : [];
    return {
      id: String(group?.id || `history-group-${index + 1}`),
      year: String(group?.year || new Date().getFullYear()),
      month: String(group?.month || String(index + 1).padStart(2, "0")),
      icon: ICONS[group?.icon] ? group.icon : ["calendar", "users", "building", "handshake"][index % 4],
      tone: group?.tone === "orange" ? "orange" : "green",
      periodColor: /^#[0-9a-f]{6}$/i.test(String(group?.periodColor || "")) ? String(group.periodColor) : "",
      textStyles: normalizeStyleSet(group?.textStyles, GROUP_TEXT_DEFAULTS),
      events: events.length ? events.map((item, eventIndex) => normalizeEvent(item, eventIndex, index)) : [normalizeEvent({}, 0, index)]
    };
  }

  function createDefaultModel() {
    return normalizeModel({
      eyebrow: "송악사회복지관 이야기",
      headline: "함께 걸어온 길",
      archiveLabel: "SONGAK HISTORY",
      description: "2020년 수탁 협약부터 지역주민과 함께 만들어 온 변화의 기록입니다.",
      nextGroupId: 5,
      nextEventId: 9,
      groups: [
        {
          year: "2026", month: "03", icon: "calendar", tone: "green",
          events: [
            { date: "03.26", title: "송악실버학당 5기 개강", description: "(재)송악읍개발위원회 공모사업으로 어르신 맞춤형 프로그램을 시작했습니다.", image: { name: "어르신 프로그램 활동 콘셉트 이미지", dataUrl: "./assets/concept/history-senior-class-concept.png", alt: "어르신 프로그램 활동 콘셉트 이미지", caption: "콘셉트 이미지" } },
            { date: "03.25", title: "노인복지증진 업무협약", description: "대한노인회 당진시지회와 송악읍·당진3동 노인복지증진을 위한 협약을 체결했습니다.", image: { name: "기관 간 협약 콘셉트 이미지", dataUrl: "./assets/concept/history-partnership-concept.png", alt: "기관 간 협약을 재현한 콘셉트 이미지", caption: "콘셉트 이미지" } },
            { date: "03.24", title: "AI+디지털 업무협약", description: "신성대학교와 지역주민의 디지털 역량 강화를 위한 업무협약을 체결했습니다.", image: { name: "기관 간 협약 콘셉트 이미지", dataUrl: "./assets/concept/history-partnership-concept.png", alt: "기관 간 협약을 재현한 콘셉트 이미지", caption: "콘셉트 이미지" } }
          ]
        },
        {
          year: "2026", month: "01", icon: "building", tone: "green",
          events: [
            { date: "01.22", title: "다비치안경 업무협약", description: "지역주민의 건강한 일상을 지원하기 위한 협력체계를 마련했습니다.", image: { name: "기관 간 협약 콘셉트 이미지", dataUrl: "./assets/concept/history-partnership-concept.png", alt: "기관 간 협약을 재현한 콘셉트 이미지", caption: "콘셉트 이미지" } },
            { date: "01.16", title: "송악사회복지관 수탁기념식", description: "(재)송악읍개발위원회 수탁을 기념하고 새로운 출발을 알렸습니다.", image: { name: "수탁·취임 행사 콘셉트 이미지", dataUrl: "./assets/concept/history-inauguration-concept.png", alt: "수탁·취임 행사를 재현한 콘셉트 이미지", caption: "콘셉트 이미지" } },
            { date: "01.01", title: "제2대 김형철 관장 취임", description: "(재)송악읍개발위원회가 복지관 운영을 시작했습니다.", image: { name: "수탁·취임 행사 콘셉트 이미지", dataUrl: "./assets/concept/history-inauguration-concept.png", alt: "수탁·취임 행사를 재현한 콘셉트 이미지", caption: "콘셉트 이미지" } }
          ]
        },
        {
          year: "2025", month: "11", icon: "building", tone: "orange",
          events: [
            { date: "11.28", title: "제3회 후원자·자원봉사자 감사의 날", description: "지역의 든든한 동반자에게 감사의 마음을 전했습니다.", image: { name: "지역축제·감사 행사 콘셉트 이미지", dataUrl: "./assets/concept/history-community-event-concept.png", alt: "지역축제와 감사 행사를 재현한 콘셉트 이미지", caption: "콘셉트 이미지" } },
            { date: "11.01", title: "제2회 행복나눔 페스티벌", description: "온 가족이 함께 즐기는 마을축제를 개최했습니다.", image: { name: "지역축제·감사 행사 콘셉트 이미지", dataUrl: "./assets/concept/history-community-event-concept.png", alt: "지역축제와 감사 행사를 재현한 콘셉트 이미지", caption: "콘셉트 이미지" } }
          ]
        },
        {
          year: "2021", month: "11", icon: "handshake", tone: "orange",
          events: [
            { date: "11.18", title: "송악사회복지관 개관식", description: "지역주민과 함께하는 행복나눔터의 문을 열었습니다.", image: { name: "복지관 개관 콘셉트 이미지", dataUrl: "./assets/concept/history-opening-concept.png", alt: "복지관 개관을 재현한 콘셉트 이미지", caption: "콘셉트 이미지" } },
            { date: "11.02", title: "지역개발·복지증진 업무협약", description: "(재)송악읍개발위원회와 지역의 복지증진을 위한 협력체계를 마련했습니다.", image: { name: "기관 간 협약 콘셉트 이미지", dataUrl: "./assets/concept/history-partnership-concept.png", alt: "기관 간 협약을 재현한 콘셉트 이미지", caption: "콘셉트 이미지" } }
          ]
        }
      ],
      ctaTitle: "송악의 더 많은 이야기가 궁금하신가요?",
      ctaDescription: "복지관의 주요 변화와 활동을 연도별로 확인해 보세요.",
      ctaButton: "전체 연혁 보기"
    });
  }

  function normalizeModel(model = {}) {
    const groups = Array.isArray(model.groups) ? model.groups.map(normalizeGroup) : [];
    const eventCount = groups.reduce((sum, group) => sum + group.events.length, 0);
    return {
      eyebrow: String(model.eyebrow || "우리의 발자취"),
      headline: String(model.headline || "세부 연혁"),
      archiveLabel: String(model.archiveLabel || "Monthly Archive"),
      description: String(model.description || "단체가 걸어온 발자취를 월별로 확인하실 수 있습니다."),
      nextGroupId: Math.max(Number(model.nextGroupId) || 1, groups.length + 1),
      nextEventId: Math.max(Number(model.nextEventId) || 1, eventCount + 1),
      groups,
      ctaTitle: String(model.ctaTitle || "더 긴 여정이 궁금하신가요?"),
      ctaDescription: String(model.ctaDescription || "단체의 시작부터 오늘까지, 더 많은 이야기를 확인해 보세요."),
      ctaButton: String(model.ctaButton || "연도별 연혁 보기"),
      textStyles: normalizeStyleSet(model.textStyles, TEXT_DEFAULTS),
      heightVersion: HEIGHT_VERSION,
      heights: Number(model.heightVersion) === HEIGHT_VERSION && model.heights && typeof model.heights === "object" ? clone(model.heights) : {}
    };
  }

  function addGroup(model, afterGroupId = null) {
    const next = normalizeModel(model);
    const targetIndex = afterGroupId
      ? next.groups.findIndex((group) => group.id === afterGroupId)
      : -1;
    const insertIndex = targetIndex >= 0 ? targetIndex + 1 : next.groups.length;
    const group = normalizeGroup({ id: `history-group-${next.nextGroupId++}` }, insertIndex);
    next.groups.splice(insertIndex, 0, group);
    return next;
  }

  function removeGroup(model, groupId) {
    const next = normalizeModel(model);
    next.groups = next.groups.filter((group) => group.id !== groupId);
    return next;
  }

  function addEvent(model, groupId, afterEventId = null) {
    const next = normalizeModel(model);
    const groupIndex = next.groups.findIndex((group) => group.id === groupId);
    if (groupIndex < 0) return next;
    const group = next.groups[groupIndex];
    const targetIndex = afterEventId
      ? group.events.findIndex((event) => event.id === afterEventId)
      : -1;
    const insertIndex = targetIndex >= 0 ? targetIndex + 1 : group.events.length;
    const event = normalizeEvent({ id: `history-event-${next.nextEventId++}` }, insertIndex, groupIndex);
    group.events.splice(insertIndex, 0, event);
    return next;
  }

  function removeEvent(model, groupId, eventId) {
    const next = normalizeModel(model);
    const group = next.groups.find((item) => item.id === groupId);
    if (group) group.events = group.events.filter((event) => event.id !== eventId);
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

  function distributeGroups(groups = []) {
    const columns = [[], []];
    const heights = [0, 0];
    groups.forEach((group, index) => {
      const column = heights[0] <= heights[1] ? 0 : 1;
      const eventCount = Math.max(1, Array.isArray(group?.events) ? group.events.length : 0);
      columns[column].push(index);
      heights[column] += (heights[column] > 0 ? 20 : 0) + 108 + eventCount * 120;
    });
    return { columns, heights };
  }

  function paginateGroups(groups = [], requestedLimit = 8) {
    const source = Array.isArray(groups) ? groups : [];
    const total = source.reduce((sum, group) => sum + (Array.isArray(group?.events) ? group.events.length : 0), 0);
    const numericLimit = Number(requestedLimit);
    const limit = Number.isFinite(numericLimit)
      ? Math.max(8, Math.ceil(numericLimit / 8) * 8)
      : 8;
    let remaining = Math.min(limit, total);
    const visibleGroups = [];
    source.forEach((group) => {
      if (remaining <= 0) return;
      const events = Array.isArray(group?.events) ? group.events : [];
      const visibleEvents = events.slice(0, remaining);
      if (!visibleEvents.length) return;
      visibleGroups.push({ ...group, events: visibleEvents });
      remaining -= visibleEvents.length;
    });
    const visibleCount = Math.min(limit, total);
    return {
      groups: visibleGroups,
      total,
      visibleCount,
      hasMore: visibleCount < total,
      nextLimit: Math.min(total, visibleCount + 8)
    };
  }

  function estimateHeight(model, viewport = "desktop") {
    const normalized = normalizeModel(model);
    const eventRows = normalized.groups.map((group) => Math.max(1, group.events.length));
    if (viewport === "desktop") {
      const { heights } = distributeGroups(normalized.groups);
      return 360 + Math.max(...heights, 0) + 150;
    }
    const groupHeight = eventRows.reduce((sum, count) => sum + 118 + count * (viewport === "phoneSmall" ? 118 : 126), 0);
    return 330 + groupHeight + 190;
  }

  window.EditorTimelineManager = Object.freeze({
    ICONS,
    VIEWPORTS,
    addEvent,
    addGroup,
    createDefaultModel,
    distributeGroups,
    estimateHeight,
    isSection,
    moveItem,
    normalizeModel,
    paginateGroups,
    removeEvent,
    removeGroup
  });
})();
