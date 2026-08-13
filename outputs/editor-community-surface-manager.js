(function () {
  "use strict";

  const SCHEMA_VERSION = 1;
  const SURFACE_KEY = "community";
  const SURFACE_ID = "publishing.page.community-board";
  const SECTION_ID = "community";
  const CHANNEL = "songak.external-surface-editor";
  const VIEWPORTS = ["desktop", "tablet", "phone", "phoneSmall"];
  const TARGET_IDS = Object.freeze({
    section: "community.intro",
    eyebrow: "community.intro.eyebrow",
    title: "community.intro.title",
    description: "community.intro.description",
    primaryCta: "community.intro.primary-cta",
    secondaryCta: "community.intro.secondary-cta",
    publicLabel: "community.info.public.label",
    publicValue: "community.info.public.value",
    privacyLabel: "community.info.privacy.label",
    privacyValue: "community.info.privacy.value",
    processLabel: "community.info.process.label",
    processValue: "community.info.process.value",
    listEyebrow: "community.list.eyebrow",
    listTitle: "community.list.title",
    emptyTitle: "community.list.empty-title",
    emptyDescription: "community.list.empty-description"
  });
  const TARGET_ID_SET = new Set(Object.values(TARGET_IDS));
  const TEXT_TARGET_IDS = Object.values(TARGET_IDS).filter((id) => id !== TARGET_IDS.section);
  const FIELD_BY_TARGET = Object.freeze(Object.fromEntries(Object.entries(TARGET_IDS)
    .filter(([key]) => key !== "section")
    .map(([key, id]) => [id, key])));
  const LABELS = Object.freeze({
    [TARGET_IDS.eyebrow]: "소통게시판 라벨",
    [TARGET_IDS.title]: "소통게시판 제목",
    [TARGET_IDS.description]: "소통게시판 설명",
    [TARGET_IDS.primaryCta]: "주민 글쓰기 버튼",
    [TARGET_IDS.secondaryCta]: "게시글 보기 버튼",
    [TARGET_IDS.publicLabel]: "공개 범위 라벨",
    [TARGET_IDS.publicValue]: "공개 범위 내용",
    [TARGET_IDS.privacyLabel]: "개인정보 라벨",
    [TARGET_IDS.privacyValue]: "개인정보 내용",
    [TARGET_IDS.processLabel]: "게시 절차 라벨",
    [TARGET_IDS.processValue]: "게시 절차 내용",
    [TARGET_IDS.listEyebrow]: "게시글 목록 라벨",
    [TARGET_IDS.listTitle]: "게시글 목록 제목",
    [TARGET_IDS.emptyTitle]: "빈 목록 제목",
    [TARGET_IDS.emptyDescription]: "빈 목록 설명"
  });
  const FIELD_DEFAULTS = Object.freeze({
    eyebrow: "VISITOR BOARD",
    title: "주민의 의견을 듣고 함께 답합니다",
    description: "복지관과 주민이 안전하게 의견을 나누고, 필요한 답변과 새로운 소식을 함께 확인하는 공간입니다.",
    primaryCta: "주민 글쓰기",
    secondaryCta: "게시글 보기",
    publicLabel: "공개 범위",
    publicValue: "제목 · 등록일 · 답변 구분",
    privacyLabel: "개인정보",
    privacyValue: "작성자 연락처 비공개",
    processLabel: "게시 절차",
    processValue: "주민 글은 담당자 확인 후 공개",
    listEyebrow: "COMMUNITY NEWS",
    listTitle: "함께 나누는 소식",
    emptyTitle: "등록된 게시글이 없습니다",
    emptyDescription: "새로운 소식이 등록되면 이곳에서 확인할 수 있습니다."
  });
  const BASE_TEXT_STYLE = Object.freeze({
    desktop: { size: 18, color: "#1f3329", font: "sans", align: "left", boxWidth: 100, boxOffsetX: 0, boxOffsetY: 0 },
    tablet: { size: 17, color: "#1f3329", font: "sans", align: "left", boxWidth: 100, boxOffsetX: 0, boxOffsetY: 0 },
    phone: { size: 16, color: "#1f3329", font: "sans", align: "left", boxWidth: 100, boxOffsetX: 0, boxOffsetY: 0 },
    phoneSmall: { size: 15, color: "#1f3329", font: "sans", align: "left", boxWidth: 100, boxOffsetX: 0, boxOffsetY: 0 }
  });
  const TITLE_SIZES = Object.freeze({ desktop: 60, tablet: 48, phone: 36, phoneSmall: 31 });
  const EYEBROW_SIZES = Object.freeze({ desktop: 14, tablet: 13, phone: 12, phoneSmall: 11 });
  const CTA_SIZES = Object.freeze({ desktop: 17, tablet: 17, phone: 16, phoneSmall: 15 });
  const LAYOUT_DEFAULTS = Object.freeze({
    desktop: { contentWidth: 92, paddingTop: 72, paddingBottom: 64, infoColumns: 3, gap: 24 },
    tablet: { contentWidth: 92, paddingTop: 60, paddingBottom: 56, infoColumns: 3, gap: 18 },
    phone: { contentWidth: 92, paddingTop: 44, paddingBottom: 48, infoColumns: 1, gap: 12 },
    phoneSmall: { contentWidth: 92, paddingTop: 36, paddingBottom: 40, infoColumns: 1, gap: 10 }
  });
  const SAFE_IMAGE_SOURCE = /^(?:data:image\/(?:png|jpe?g|webp|gif|avif);base64,[a-z0-9+/=]+|\/api\/site-assets\/[a-z0-9][a-z0-9._-]{0,159}|\.\/assets\/[a-z0-9][a-z0-9/._-]{0,300})$/i;

  function clone(value) {
    return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
  }

  function isRecord(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function clamp(value, min, max, fallback) {
    const number = Number(value);
    return Math.max(min, Math.min(max, Number.isFinite(number) ? number : fallback));
  }

  function normalizeColor(value, fallback) {
    return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value).toLowerCase() : fallback;
  }

  function normalizeNullableColor(value) {
    return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value).toLowerCase() : null;
  }

  function normalizeText(value, fallback, maximum) {
    return (typeof value === "string" ? value : fallback).slice(0, maximum);
  }

  function normalizeInteger(value, min, max, fallback) {
    return Math.round(clamp(value, min, max, fallback));
  }

  function createTextStyles() {
    return Object.fromEntries(VIEWPORTS.map((viewport) => [viewport, Object.fromEntries(TEXT_TARGET_IDS.map((targetId) => {
      const style = clone(BASE_TEXT_STYLE[viewport]);
      if (targetId === TARGET_IDS.title) {
        style.size = TITLE_SIZES[viewport];
        style.font = "serif";
      } else if (targetId === TARGET_IDS.eyebrow) {
        style.size = EYEBROW_SIZES[viewport];
      } else if (targetId === TARGET_IDS.primaryCta || targetId === TARGET_IDS.secondaryCta) {
        style.size = CTA_SIZES[viewport];
        style.align = "center";
        style.background = targetId === TARGET_IDS.primaryCta ? "#2f6b49" : "#ffffff";
      } else if (targetId.endsWith(".label")) {
        style.size = Math.max(12, style.size - 3);
      } else if (targetId.endsWith(".value")) {
        style.size = Math.max(13, style.size - 2);
      }
      if (!("background" in style)) style.background = null;
      return [targetId, style];
    }))]));
  }

  function createDefaultSurface() {
    return {
      schemaVersion: SCHEMA_VERSION,
      surfaceId: SURFACE_ID,
      sectionId: SECTION_ID,
      fields: clone(FIELD_DEFAULTS),
      textStyles: createTextStyles(),
      layouts: clone(LAYOUT_DEFAULTS),
      appearance: { background: "#f7fbf8", accent: "#2c7158", text: "#173226", preset: "green", decoration: "dots" },
      background: {
        mode: "default", color: "#fbfefb", colorEnabled: false, imageName: null, imageDataUrl: null,
        naturalWidth: 0, naturalHeight: 0, opacity: 100,
        layouts: { desktop: null, tablet: null, phone: null, phoneSmall: null }
      },
      pageDecorations: { cards: [], decorations: [], nextDecorationId: 1 }
    };
  }

  function normalizeStyle(value, fallback) {
    const source = isRecord(value) ? value : {};
    return {
      size: clamp(source.size, 8, 96, fallback.size),
      color: normalizeColor(source.color, fallback.color),
      font: ["sans", "serif", "koreanBrush", "koreanKcc", "koreanNanumBrush", "koreanLoveLetter", "englishScript", "englishSignature"].includes(source.font) ? source.font : fallback.font,
      align: ["left", "center", "right"].includes(source.align) ? source.align : fallback.align,
      boxWidth: clamp(source.boxWidth, 30, 100, fallback.boxWidth),
      boxOffsetX: clamp(source.boxOffsetX, -320, 320, fallback.boxOffsetX),
      boxOffsetY: clamp(source.boxOffsetY, -320, 320, fallback.boxOffsetY),
      background: source.background === null
        ? null
        : normalizeColor(source.background, fallback.background)
    };
  }

  function normalizeLayout(value, fallback) {
    const source = isRecord(value) ? value : {};
    return {
      contentWidth: clamp(source.contentWidth, 60, 100, fallback.contentWidth),
      paddingTop: clamp(source.paddingTop, 0, 240, fallback.paddingTop),
      paddingBottom: clamp(source.paddingBottom, 0, 240, fallback.paddingBottom),
      infoColumns: normalizeInteger(source.infoColumns, 1, 3, fallback.infoColumns),
      gap: clamp(source.gap, 0, 80, fallback.gap)
    };
  }

  function normalizeBackgroundLayout(value) {
    if (!isRecord(value)) return null;
    return {
      imageX: clamp(value.imageX, -400, 400, 0),
      imageY: clamp(value.imageY, -400, 400, 0),
      imageW: clamp(value.imageW, 1, 800, 100),
      imageH: clamp(value.imageH, 1, 800, 100),
      imageScale: clamp(value.imageScale, .1, 8, 1),
      cropX: clamp(value.cropX, 0, 100, 0),
      cropY: clamp(value.cropY, 0, 100, 0),
      cropW: clamp(value.cropW, 1, 100, 100),
      cropH: clamp(value.cropH, 1, 100, 100)
    };
  }

  function normalizeDecoration(value, index) {
    const source = isRecord(value) ? value : {};
    const layoutsSource = isRecord(source.layouts) ? source.layouts : {};
    const sizesSource = isRecord(source.sizes) ? source.sizes : {};
    const layouts = Object.fromEntries(VIEWPORTS.map((viewport) => {
      const raw = isRecord(layoutsSource[viewport]) ? layoutsSource[viewport] : {};
      return [viewport, { x: clamp(raw.x, 2, 98, 50), y: clamp(raw.y, 2, 4000, 50) }];
    }));
    const sizes = Object.fromEntries(VIEWPORTS.map((viewport) => [viewport, clamp(sizesSource[viewport], 24, 220, 58)]));
    const rawId = normalizeText(source.id, `community-decoration-${index + 1}`, 100);
    return {
      id: /^community-decoration-[a-z0-9-]+$/i.test(rawId) ? rawId : `community-decoration-${index + 1}`,
      icon: normalizeText(source.icon, "heart", 80),
      style: normalizeText(source.style, "plain", 80),
      color: normalizeNullableColor(source.color),
      layer: source.layer === "back" ? "back" : "front",
      layouts,
      sizes
    };
  }

  function normalizeSurface(value) {
    const defaults = createDefaultSurface();
    const source = isRecord(value) ? value : {};
    const fieldSource = isRecord(source.fields) ? source.fields : {};
    const fields = Object.fromEntries(Object.entries(FIELD_DEFAULTS).map(([key, fallback]) => [key,
      (typeof fieldSource[key] === "string" ? fieldSource[key] : fallback).slice(0, key === "title" || key === "description" ? 500 : 160)
    ]));
    const textSource = isRecord(source.textStyles) ? source.textStyles : {};
    const textStyles = Object.fromEntries(VIEWPORTS.map((viewport) => {
      const viewportSource = isRecord(textSource[viewport]) ? textSource[viewport] : {};
      return [viewport, Object.fromEntries(TEXT_TARGET_IDS.map((targetId) => [
        targetId,
        normalizeStyle(viewportSource[targetId], defaults.textStyles[viewport][targetId])
      ]))];
    }));
    const appearanceSource = isRecord(source.appearance) ? source.appearance : {};
    const backgroundSource = isRecord(source.background) ? source.background : {};
    const rawImage = typeof backgroundSource.imageDataUrl === "string" ? backgroundSource.imageDataUrl : null;
    const safeImage = rawImage && SAFE_IMAGE_SOURCE.test(rawImage) ? rawImage : null;
    const decorationsSource = isRecord(source.pageDecorations) ? source.pageDecorations : {};
    const layoutSource = isRecord(source.layouts) ? source.layouts : {};
    const backgroundLayoutsSource = isRecord(backgroundSource.layouts) ? backgroundSource.layouts : {};
    const decorations = Array.isArray(decorationsSource.decorations)
      ? decorationsSource.decorations.slice(0, 24).map(normalizeDecoration)
      : [];
    const maximumDecorationId = decorations.reduce((maximum, item) => {
      const numericId = Number(item.id.match(/(\d+)$/)?.[1] || 0);
      return Math.max(maximum, numericId);
    }, 0);
    return {
      ...defaults,
      fields,
      textStyles,
      layouts: Object.fromEntries(VIEWPORTS.map((viewport) => [
        viewport,
        normalizeLayout(layoutSource[viewport], defaults.layouts[viewport])
      ])),
      appearance: {
        background: normalizeColor(appearanceSource.background, defaults.appearance.background),
        accent: normalizeColor(appearanceSource.accent, defaults.appearance.accent),
        text: normalizeColor(appearanceSource.text, defaults.appearance.text),
        preset: typeof appearanceSource.preset === "string" ? appearanceSource.preset.slice(0, 40) : defaults.appearance.preset,
        decoration: typeof appearanceSource.decoration === "string" ? appearanceSource.decoration.slice(0, 80) : null
      },
      background: {
        mode: backgroundSource.mode === "image" && safeImage ? "image" : backgroundSource.mode === "color" ? "color" : "default",
        color: normalizeColor(backgroundSource.color, defaults.background.color),
        colorEnabled: Boolean(backgroundSource.colorEnabled),
        imageName: safeImage ? normalizeText(backgroundSource.imageName, "community-background", 180) : null,
        imageDataUrl: safeImage,
        naturalWidth: normalizeInteger(backgroundSource.naturalWidth, 0, 20000, 0),
        naturalHeight: normalizeInteger(backgroundSource.naturalHeight, 0, 20000, 0),
        opacity: clamp(backgroundSource.opacity, 0, 100, 100),
        layouts: Object.fromEntries(VIEWPORTS.map((viewport) => [
          viewport,
          normalizeBackgroundLayout(backgroundLayoutsSource[viewport])
        ]))
      },
      pageDecorations: {
        cards: [],
        decorations,
        nextDecorationId: Math.max(
          1,
          normalizeInteger(decorationsSource.nextDecorationId, 1, 100000, 1),
          maximumDecorationId + 1
        )
      }
    };
  }

  function isBaseMessage(value, nonce) {
    return isRecord(value)
      && value.channel === CHANNEL
      && value.schemaVersion === SCHEMA_VERSION
      && value.surfaceId === SURFACE_ID
      && value.nonce === nonce;
  }

  function createMessage(type, nonce, extra = {}) {
    return { channel: CHANNEL, schemaVersion: SCHEMA_VERSION, surfaceId: SURFACE_ID, nonce, type, ...extra };
  }

  window.EditorCommunitySurfaceManager = Object.freeze({
    SCHEMA_VERSION, SURFACE_KEY, SURFACE_ID, SECTION_ID, CHANNEL, VIEWPORTS, TARGET_IDS,
    FIELD_BY_TARGET, LABELS, createDefaultSurface, normalizeSurface, isTargetId: (value) => TARGET_ID_SET.has(value),
    isBaseMessage, createMessage
  });
})();
