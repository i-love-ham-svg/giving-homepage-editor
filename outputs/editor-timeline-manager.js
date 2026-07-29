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
      font: ["serif", "batang", "sans", "rounded"].includes(style?.font) ? style.font : fallback.font
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
      naturalHeight: Math.max(0, Number(image.naturalHeight) || 0)
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
      eyebrow: "모두의기부 이야기",
      headline: "세부 연혁",
      archiveLabel: "Monthly Archive",
      description: "단체가 걸어온 발자취를 월별로 확인하실 수 있습니다.",
      nextGroupId: 5,
      nextEventId: 9,
      groups: [
        {
          year: "2026", month: "07", icon: "calendar", tone: "green",
          events: [
            { date: "07.15", title: "지역사회 통합돌봄 사업 선정", description: "지역사회 통합돌봄 선도사업 기관으로 선정되어 서비스를 시작합니다." },
            { date: "07.02", title: "여름방학 돌봄교실 시작", description: "아이들의 즐거운 방학을 위한 돌봄교실이 시작되었습니다." }
          ]
        },
        {
          year: "2026", month: "06", icon: "users", tone: "green",
          events: [
            { date: "06.20", title: "후원자 간담회 진행", description: "후원자님들과 뜻깊은 시간을 가지며 소통하는 자리를 마련했습니다." },
            { date: "06.01", title: "신규 프로그램 오픈", description: "새로운 교육 프로그램 운영을 시작합니다." }
          ]
        },
        {
          year: "2025", month: "11", icon: "building", tone: "orange",
          events: [
            { date: "11.20", title: "기관 리뉴얼 완료", description: "더 나은 환경과 서비스 제공을 위해 공간 리뉴얼을 완료했습니다." },
            { date: "11.05", title: "자원봉사자 감사의 날", description: "함께해 주신 자원봉사자분들께 감사의 마음을 전했습니다." }
          ]
        },
        {
          year: "2025", month: "09", icon: "handshake", tone: "orange",
          events: [
            { date: "09.10", title: "지역 협력 협약 체결", description: "지역사회 발전을 위한 협약을 체결하고 상호 협력을 약속했습니다." },
            { date: "09.01", title: "추석맞이 지원사업 진행", description: "지역 내 취약계층을 위한 나눔 활동을 진행했습니다." }
          ]
        }
      ],
      ctaTitle: "더 긴 여정이 궁금하신가요?",
      ctaDescription: "단체의 시작부터 오늘까지, 더 많은 이야기를 연도별 연혁에서 만나보세요.",
      ctaButton: "연도별 연혁 보기"
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
