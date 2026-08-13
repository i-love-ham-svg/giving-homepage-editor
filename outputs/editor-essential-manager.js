(function () {
  "use strict";

  const VIEWPORTS = ["desktop", "phoneSmall", "phone", "tablet"];
  const BASE_SECTION_IDS = Object.freeze([
    "facility",
    "organization",
    "location",
    "volunteer",
    "notice",
    "schedule",
    "footer"
  ]);
  const TEMPLATE_LABELS = Object.freeze({
    facility: "시설현황",
    organization: "조직도",
    location: "찾아오시는 길",
    volunteer: "자원봉사 안내",
    notice: "공지·소식",
    schedule: "프로그램 일정표",
    footer: "하단 정보"
  });
  const FOOTER_LAYOUTS = Object.freeze(["info", "simple", "compact", "split"]);
  // 사진분할형은 새 섹션의 기본값이지만 담당자가 선택한 승인 레이아웃은
  // 저장·복원 과정에서도 그대로 유지한다.
  const SOCIAL_LOGIN_LAYOUTS = Object.freeze([
    "fresh-split",
    "drive-split",
    "immersive",
    "mobile-curve"
  ]);
  const SOCIAL_LOGIN_BUTTON_DEFAULTS = Object.freeze({
    kakao: Object.freeze({ background: "#fee500", color: "#191919", size: 16, font: "sans", align: "center", boxWidth: 100, boxOffsetX: 0, boxOffsetY: 0 }),
    naver: Object.freeze({ background: "#00783e", color: "#ffffff", size: 16, font: "sans", align: "center", boxWidth: 100, boxOffsetX: 0, boxOffsetY: 0 }),
    google: Object.freeze({ background: "#ffffff", color: "#202124", size: 16, font: "sans", align: "center", boxWidth: 100, boxOffsetX: 0, boxOffsetY: 0 })
  });
  // 프로젝트에 새 이미지 글꼴을 도입할 때 이 공통 목록에도 등록한다.
  const FONT_KEYS = ["sans", "serif", "batang", "rounded", "pretendard", "hahmlet", "koreanBrush", "koreanKcc", "koreanNanumBrush", "koreanLoveLetter", "englishScript", "englishSignature"];

  function createStyle(size, color, font = "sans") {
    return { size, color, font };
  }

  function createStyleDefaults(template, scope) {
    const footer = template === "footer";
    const ink = footer ? "#ffffff" : "#16251d";
    const muted = footer ? "#d2ddd6" : "#63766a";
    const strong = footer ? "#c9e2d3" : "#3d7554";
    const sizes = {
      desktop: scope === "section"
        ? { eyebrow: 13, headline: 50, description: 17, ctaLabel: 15, note: 13 }
        : scope === "item"
          ? { badge: 12, title: 21, meta: 14, description: 14, detailContent: 15 }
          : { label: 13, value: 15 },
      tablet: scope === "section"
        ? { eyebrow: 12, headline: 42, description: 16, ctaLabel: 15, note: 13 }
        : scope === "item"
          ? { badge: 12, title: 20, meta: 14, description: 14, detailContent: 15 }
          : { label: 13, value: 15 },
      phone: scope === "section"
        ? { eyebrow: 11, headline: 30, description: 15, ctaLabel: 14, note: 12 }
        : scope === "item"
          ? { badge: 11, title: 19, meta: 13, description: 13, detailContent: 14 }
          : { label: 12, value: 14 },
      phoneSmall: scope === "section"
        ? { eyebrow: 10, headline: 28, description: 14, ctaLabel: 14, note: 12 }
        : scope === "item"
          ? { badge: 10, title: 18, meta: 12, description: 13, detailContent: 14 }
          : { label: 11, value: 13 }
    };
    const result = {};
    VIEWPORTS.forEach((viewport) => {
      result[viewport] = {};
      Object.entries(sizes[viewport]).forEach(([field, size]) => {
        const color = ["eyebrow", "badge", "meta", "label"].includes(field)
          ? strong
          : ["description", "detailContent", "note"].includes(field)
            ? muted
            : field === "ctaLabel"
              ? "#ffffff"
              : ink;
        result[viewport][field] = createStyle(size, color, field === "headline" ? "serif" : "sans");
      });
    });
    return result;
  }

  function clone(value) {
    return typeof structuredClone === "function"
      ? structuredClone(value)
      : JSON.parse(JSON.stringify(value));
  }

  // Normalize responsive footer controls at the model boundary so rendering, saving and
  // undo/redo can all rely on the same column and scale limits.
  function normalizeFooterLayoutControls(controls = {}) {
    const defaults = {
      desktop: { columns: 2, scale: 100 },
      tablet: { columns: 2, scale: 100 },
      phone: { columns: 1, scale: 100 },
      phoneSmall: { columns: 1, scale: 100 }
    };
    const result = {};
    VIEWPORTS.forEach((viewport) => {
      const source = controls?.[viewport] ?? (viewport === "phone" ? controls?.mobile : null) ?? defaults[viewport];
      result[viewport] = {
        // A phone footer always uses one readable row per contact entry. This also
        // migrates older saved two-column mobile footers without touching PC/tablet.
        columns: viewport === "phone" || viewport === "phoneSmall"
          ? 1
          : Math.max(1, Math.min(4, Math.floor(Number(source?.columns) || defaults[viewport].columns))),
        scale: Math.max(80, Math.min(130, Math.round(Number(source?.scale) || defaults[viewport].scale)))
      };
    });
    result.mobile = result.phone;
    return result;
  }

  function normalizeStyle(style, fallback) {
    const source = style && typeof style === "object" ? style : {};
    return {
      size: Math.max(8, Math.min(96, Number(source.size) || fallback.size)),
      color: /^#[0-9a-f]{6}$/i.test(String(source.color || "")) ? String(source.color).toLowerCase() : fallback.color,
      font: FONT_KEYS.includes(source.font) ? source.font : fallback.font,
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

  function normalizeSocialLoginButtonStyles(styles = {}) {
    const result = {};
    Object.entries(SOCIAL_LOGIN_BUTTON_DEFAULTS).forEach(([provider, fallback]) => {
      const source = styles?.[provider] && typeof styles[provider] === "object" ? styles[provider] : {};
      result[provider] = {
        background: /^#[0-9a-f]{6}$/i.test(String(source.background || ""))
          ? String(source.background).toLowerCase()
          : fallback.background,
        color: /^#[0-9a-f]{6}$/i.test(String(source.color || ""))
          ? String(source.color).toLowerCase()
          : fallback.color,
        size: Math.max(10, Math.min(30, Number(source.size) || fallback.size)),
        font: FONT_KEYS.includes(source.font) ? source.font : fallback.font,
        align: ["left", "center", "right"].includes(source.align) ? source.align : fallback.align,
        boxWidth: Math.max(30, Math.min(100, Number(source.boxWidth ?? fallback.boxWidth))),
        boxOffsetX: Math.max(-120, Math.min(120, Number(source.boxOffsetX ?? fallback.boxOffsetX))),
        boxOffsetY: Math.max(-120, Math.min(120, Number(source.boxOffsetY ?? fallback.boxOffsetY)))
      };
    });
    return result;
  }

  function isTemplate(value) {
    return Object.prototype.hasOwnProperty.call(TEMPLATE_LABELS, String(value));
  }

  function isSection(sectionId) {
    const value = String(sectionId ?? "");
    return BASE_SECTION_IDS.includes(value) || /^essential\d+$/.test(value);
  }

  function isBaseSection(sectionId) {
    return BASE_SECTION_IDS.includes(String(sectionId ?? ""));
  }

  const NOTICE_TEXT_BLOCK_TYPES = new Set(["heading", "paragraph", "highlight"]);
  const NOTICE_MEDIA_BLOCK_TYPES = new Set(["image", "video", "attachment"]);
  const NOTICE_STRUCTURE_BLOCK_TYPES = new Set(["table", "decoration"]);
  const NOTICE_BLOCK_DEFAULT_SIZES = { heading: 27, paragraph: 16, highlight: 18 };

  function normalizeNoticeLink(value) {
    const url = String(value ?? "").trim().slice(0, 2_000);
    return /^(?:https:\/\/|mailto:|tel:)/i.test(url) ? url : "";
  }

  function normalizeNoticeMedia(media = {}, fallbackKind = "image") {
    const type = String(media.type ?? "").trim().toLowerCase();
    const kind = fallbackKind === "video" || type.startsWith("video/")
      ? "video"
      : fallbackKind === "image" || type.startsWith("image/")
        ? "image"
        : "attachment";
    const rawUrl = String(media.url ?? "").trim();
    const url = /^(?:https:\/\/|\/(?:board-media|api\/media)\/|(?:\.\/)?assets\/)/i.test(rawUrl) ? rawUrl : "";
    return {
      id: String(media.id ?? "").slice(0, 120),
      kind,
      type,
      name: String(media.name ?? `${kind} attachment`).slice(0, 180),
      url,
      thumbnailUrl: String(media.thumbnailUrl ?? "").slice(0, 2_000),
      alt: String(media.alt ?? "").slice(0, 240),
      size: Math.max(0, Number(media.size) || 0)
    };
  }

  function normalizeNoticeBlock(block = {}, index = 0) {
    const requestedType = String(block.type ?? "paragraph");
    const type = NOTICE_TEXT_BLOCK_TYPES.has(requestedType) || NOTICE_MEDIA_BLOCK_TYPES.has(requestedType) || NOTICE_STRUCTURE_BLOCK_TYPES.has(requestedType)
      ? requestedType
      : "paragraph";
    const text = String(block.text ?? "").slice(0, 20_000);
    const detectedLink = text.match(/https:\/\/[^\s<>]+/i)?.[0] ?? "";
    const normalized = {
      id: String(block.id || `notice-block-${index + 1}`),
      type,
      text,
      fontSize: Math.max(12, Math.min(56, Number(block.fontSize) || NOTICE_BLOCK_DEFAULT_SIZES[type] || 16)),
      color: /^#[0-9a-f]{6}$/i.test(String(block.color ?? "")) ? String(block.color).toLowerCase() : "#1f3329",
      font: FONT_KEYS.includes(String(block.font ?? "")) ? String(block.font) : "serif",
      textAlign: ["left", "center", "right"].includes(String(block.textAlign ?? "")) ? String(block.textAlign) : "left",
      linkUrl: NOTICE_TEXT_BLOCK_TYPES.has(type) ? normalizeNoticeLink(block.linkUrl || detectedLink) : "",
      caption: String(block.caption ?? "").slice(0, 500),
      media: null,
      rows: [],
      tableWidth: Math.max(40, Math.min(100, Number(block.tableWidth) || 100)),
      tableAlign: ["left", "center", "right"].includes(String(block.tableAlign || "")) ? String(block.tableAlign) : "left",
      columnWidths: [],
      rowHeights: [],
      cellStyles: []
    };
    if (type === "decoration") {
      normalized.decorationIcon = String(block.decorationIcon || "heart").slice(0, 80);
      normalized.decorationStyle = String(block.decorationStyle || "soft-circle").slice(0, 80);
      normalized.decorationColor = /^#[0-9a-f]{6}$/i.test(String(block.decorationColor || "")) ? String(block.decorationColor).toLowerCase() : "#356b55";
      normalized.decorationSize = Math.max(24, Math.min(180, Number(block.decorationSize) || 64));
      normalized.decorationAlign = ["left", "center", "right"].includes(String(block.decorationAlign || "")) ? String(block.decorationAlign) : "center";
    }
    if (NOTICE_MEDIA_BLOCK_TYPES.has(type)) normalized.media = normalizeNoticeMedia(block.media, type);
    if (type === "table") {
      const sourceRows = Array.isArray(block.rows) ? block.rows.slice(0, 12) : [];
      const columnCount = Math.max(1, Math.min(8, sourceRows.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0) || 3));
      normalized.rows = (sourceRows.length ? sourceRows : [
        ["항목", "내용", "비고"],
        ["내용 1", "내용을 입력하세요", ""],
        ["내용 2", "내용을 입력하세요", ""]
      ]).map((row) => Array.from({ length: columnCount }, (_, columnIndex) => String(Array.isArray(row) ? row[columnIndex] ?? "" : "").slice(0, 500)));
      const sourceWidths = Array.isArray(block.columnWidths) ? block.columnWidths : [];
      const equalWidth = 100 / columnCount;
      const rawWidths = Array.from({ length: columnCount }, (_, columnIndex) => Math.max(8, Number(sourceWidths[columnIndex]) || equalWidth));
      const widthTotal = rawWidths.reduce((sum, width) => sum + width, 0) || 100;
      normalized.columnWidths = rawWidths.map((width) => Number((width / widthTotal * 100).toFixed(3)));
      const sourceHeights = Array.isArray(block.rowHeights) ? block.rowHeights : [];
      normalized.rowHeights = normalized.rows.map((_, rowIndex) => Math.max(36, Math.min(240, Number(sourceHeights[rowIndex]) || (rowIndex === 0 ? 52 : 56))));
      const sourceStyles = Array.isArray(block.cellStyles) ? block.cellStyles : [];
      normalized.cellStyles = normalized.rows.map((row, rowIndex) => row.map((_, columnIndex) => {
        const style = sourceStyles[rowIndex]?.[columnIndex] || {};
        return {
          fontSize: Math.max(10, Math.min(56, Number(style.fontSize) || 16)),
          color: /^#[0-9a-f]{6}$/i.test(String(style.color || "")) ? String(style.color).toLowerCase() : "#1f3329",
          font: FONT_KEYS.includes(String(style.font || "")) ? String(style.font) : "serif",
          textAlign: ["left", "center", "right"].includes(String(style.textAlign || "")) ? String(style.textAlign) : "left"
        };
      }));
    }
    return normalized;
  }

  function normalizeItem(item = {}, index = 0, template = "facility") {
    const detailContent = String(item.detailContent ?? (template === "notice" ? item.description ?? "" : ""));
    const rawBlocks = Array.isArray(item.detailBlocks)
      ? item.detailBlocks
      : (template === "notice" && detailContent.trim()
        ? [{ id: `notice-block-${index + 1}-1`, type: "paragraph", text: detailContent }]
        : []);
    const detailBlocks = template === "notice"
      ? rawBlocks.slice(0, 30).map((block, blockIndex) => normalizeNoticeBlock(block, blockIndex))
      : [];
    const maxBlockId = detailBlocks.reduce((max, block) => Math.max(max, Number(block.id.replace(/\D/g, "")) || 0), 0);
    const noticeDecorationSource = template === "notice" ? (Array.isArray(item.decorations) ? item.decorations : []) : [];
    const footerDocumentKeys = ["privacy", "email", "directions"];
    const footerDocumentKey = template === "footer"
      ? (footerDocumentKeys.includes(String(item.documentKey)) ? String(item.documentKey) : footerDocumentKeys[index] || "")
      : "";
    const decorations = noticeDecorationSource.slice(0, 40).map((entry, decorationIndex) => {
      const layouts = {};
      const sizes = {};
      VIEWPORTS.forEach((viewport) => {
        const source = entry.layouts?.[viewport] ?? entry.layouts?.desktop ?? { x: 50, y: 180 };
        layouts[viewport] = {
          x: Math.max(2, Math.min(98, Number(source.x) || 50)),
          y: Math.max(18, Math.min(4000, Number(source.y) || 180))
        };
        sizes[viewport] = Math.max(24, Math.min(220, Number(entry.sizes?.[viewport] ?? entry.sizes?.desktop) || 58));
      });
      return {
        id: String(entry.id || `notice-decoration-${decorationIndex + 1}`),
        icon: String(entry.icon || "heart").slice(0, 80),
        style: String(entry.style || "plain").slice(0, 80),
        color: /^#[0-9a-f]{6}$/i.test(String(entry.color || "")) ? String(entry.color).toLowerCase() : "#356b55",
        layer: entry.layer === "back" ? "back" : "front",
        layouts,
        sizes
      };
    });
    return {
      id: String(item.id || `${template}-item-${index + 1}`),
      badge: String(item.badge ?? ""),
      title: String(item.title ?? `새 ${TEMPLATE_LABELS[template]} 항목`),
      meta: String(item.meta ?? ""),
      description: String(item.description ?? ""),
      linkUrl: String(item.linkUrl ?? ""),
      imageUrl: String(item.imageUrl ?? ""),
      imageFit: item.imageFit === "contain" ? "contain" : "cover",
      imageScale: Math.max(.2, Math.min(4, Number(item.imageScale) || 1)),
      imageOpacity: Math.max(0, Math.min(100, Number(item.imageOpacity ?? 100))),
      fieldType: String(item.fieldType ?? ""),
      fieldOptions: String(item.fieldOptions ?? ""),
      documentKey: footerDocumentKey,
      required: Boolean(item.required),
      detailContent,
      detailBlocks,
      decorations,
      nextDecorationId: Math.max(1, Number(item.nextDecorationId) || decorations.length + 1),
      nextBlockId: Math.max(1, Number(item.nextBlockId) || 1, maxBlockId + 1),
      textStyleOverrides: VIEWPORTS.reduce((result, viewport) => {
        const source = item.textStyleOverrides?.[viewport];
        result[viewport] = source && typeof source === "object"
          ? Object.fromEntries(Object.entries(source).map(([field, value]) => [field, Boolean(value)]))
          : {};
        return result;
      }, {}),
      textStyles: normalizeStyleSet(item.textStyles, createStyleDefaults(template, "item"))
    };
  }

  function normalizeDetail(detail = {}, index = 0, template = "location") {
    return {
      id: String(detail.id || `${template}-detail-${index + 1}`),
      label: String(detail.label ?? "항목"),
      value: String(detail.value ?? ""),
      textStyles: normalizeStyleSet(detail.textStyles, createStyleDefaults(template, "detail"))
    };
  }

  function createFooterDocuments() {
    return {
      privacy: {
        title: "개인정보처리방침",
        sourceUrl: "https://www.sacwc.kr/core/public/privacy_2025.html",
        sourceLabel: "송악사회복지관 공식 개인정보처리방침",
        effectiveDate: "2021-06-22",
        department: "송악사회복지관 개인정보 보호 담당부서",
        officer: "개인정보 보호 담당자",
        phone: "041-353-5077",
        email: "sacwc2021@hanmail.net",
        content: [
          "송악사회복지관은 개인정보 보호법에 따라 정보주체의 개인정보를 보호하고 관련 고충을 처리하기 위하여 다음과 같이 개인정보처리방침을 공개합니다. 개인정보 처리 항목과 보유기간은 서비스별 안내를 우선하며, 궁금한 사항은 대표전화 041-353-5077로 확인해 주세요.",
          "1. 개인정보의 처리 목적\n홈페이지 회원관리, 복지 서비스와 콘텐츠 제공, 이용 통계 등 승인된 목적 범위에서 개인정보를 처리합니다.",
          "2. 처리 항목과 보유 기간\n서비스 신청과 회원관리 과정에서 고지하고 동의받은 항목을 법령 또는 동의받은 기간 동안 보유하며, 기간이 끝나면 지체 없이 파기합니다.",
          "3. 제3자 제공과 처리 위탁\n법령 또는 정보주체의 동의가 있는 경우를 제외하고 개인정보를 제3자에게 제공하지 않습니다. 처리 위탁이 있는 경우 수탁자, 위탁 업무와 기간을 공개하고 안전한 처리를 감독합니다.",
          "4. 개인정보의 파기\n보유 기간 경과 또는 목적 달성 시 복구할 수 없는 방법으로 전자 파일을 삭제하고 종이 문서는 분쇄 또는 소각합니다.",
          "5. 정보주체의 권리\n정보주체는 개인정보 열람, 정정·삭제, 처리정지 등을 요구할 수 있으며 본인 또는 정당한 대리인 확인 후 지체 없이 처리합니다.",
          "6. 안전성 확보 조치\n내부관리계획, 접근권한 관리, 암호화, 접속기록 보관 등 필요한 관리적·기술적·물리적 보호조치를 적용합니다.",
          "7. 자동 수집 장치\n서비스 개선과 이용 통계를 위해 쿠키를 사용할 수 있으며 브라우저 설정에서 쿠키 저장을 거부할 수 있습니다.",
          "8. 개인정보 보호책임자와 열람청구\n아래 담당부서와 연락처로 개인정보 관련 문의, 불만처리, 피해구제와 열람청구를 접수할 수 있습니다.",
          "9. 권익침해 구제\n개인정보침해신고센터 118, 개인정보분쟁조정위원회 1833-6972 등 관계기관을 통해 상담과 구제를 요청할 수 있습니다.",
          "10. 방침 변경\n방침을 변경하는 경우 시행일과 주요 변경 내용을 홈페이지에서 확인할 수 있도록 공개합니다."
        ].join("\n\n")
      },
      email: {
        title: "이메일무단수집거부",
        sourceUrl: "https://www.sacwc.kr/core/public/emailRefusal_2025.html",
        sourceLabel: "송악사회복지관 공식 이메일무단수집거부",
        effectiveDate: "2021-06-22",
        department: "송악사회복지관",
        officer: "홈페이지 운영 담당자",
        phone: "041-353-5077",
        email: "sacwc2021@hanmail.net",
        content: "송악사회복지관 웹사이트에 게시된 이메일 주소가 전자우편 수집 프로그램이나 그 밖의 기술적 장치를 이용해 무단으로 수집되는 것을 거부합니다. 수집 거부 의사가 명시된 홈페이지에서 자동화된 수단으로 이메일 주소를 수집하거나, 그렇게 수집한 주소를 판매·유통하거나 정보 전송에 이용해서는 안 됩니다."
      },
      directions: {
        title: "찾아오시는 길",
        sourceUrl: "https://www.sacwc.kr/main/sub.html?pageCode=8",
        sourceLabel: "송악사회복지관 공식 찾아오시는 길",
        effectiveDate: "2026-08-06",
        department: "송악사회복지관",
        officer: "방문 안내 담당자",
        phone: "041-353-5077",
        email: "sacwc2021@hanmail.net",
        content: "주소: (31728) 충남 당진시 송악읍 송악로 656 (중흥리 367)\n\n대중교통\n- 송악초등학교: 당진 시외버스터미널에서 201·210·270번 승차, 하차 후 도보 약 4분\n- 중흥사거리: 202·220·274번 승차, 하차 후 도보 약 8분\n- 석포리 정류장: 215·223·231번 승차, 하차 후 도보 약 12분\n\n자가용\n내비게이션에서 ‘송악사회복지관’ 또는 ‘충남 당진시 송악읍 송악로 656’을 검색해 주세요."
      }
    };
  }

  function normalizeFooterDocuments(documents = {}) {
    const defaults = createFooterDocuments();
    return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => {
      const source = documents?.[key] && typeof documents[key] === "object" ? documents[key] : {};
      return [key, {
        title: String(source.title ?? fallback.title).slice(0, 120),
        sourceUrl: /^https:\/\//i.test(String(source.sourceUrl || "")) ? String(source.sourceUrl) : fallback.sourceUrl,
        sourceLabel: String(source.sourceLabel ?? fallback.sourceLabel).slice(0, 180),
        effectiveDate: String(source.effectiveDate ?? fallback.effectiveDate).slice(0, 20),
        department: String(source.department ?? fallback.department).slice(0, 120),
        officer: String(source.officer ?? fallback.officer).slice(0, 120),
        phone: String(source.phone ?? fallback.phone).slice(0, 80),
        email: String(source.email ?? fallback.email).slice(0, 160),
        content: String(source.content ?? fallback.content).slice(0, 30000)
      }];
    }));
  }

  function getBalancedRowSizes(itemCount = 0, firstRowCount = 3) {
    const total = Math.max(0, Math.floor(Number(itemCount) || 0));
    if (!total) return [];
    const firstSize = Math.min(total, Math.max(1, Math.min(4, Math.floor(Number(firstRowCount) || 3))));
    const sizes = [firstSize];
    const remaining = total - firstSize;
    if (!remaining) return sizes;
    const rowCount = Math.ceil(remaining / 3);
    const baseSize = Math.floor(remaining / rowCount);
    const widerRows = remaining % rowCount;
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      sizes.push(baseSize + (rowIndex < widerRows ? 1 : 0));
    }
    return sizes;
  }

  function getBalancedItemLayout(itemCount = 0, firstRowCount = 3) {
    return getBalancedRowSizes(itemCount, firstRowCount).flatMap((rowSize, rowIndex) => (
      Array.from({ length: rowSize }, (_, columnIndex) => ({
        rowSize,
        rowIndex,
        rowStart: columnIndex === 0
      }))
    ));
  }

  function createTemplateModel(template) {
    if (template === "organization") {
      return {
        template,
        label: "조직도",
        eyebrow: "ORGANIZATION",
        headline: "주민의 곁에서 함께하는 송악사회복지관 조직",
        description: "관장과 부장, 4개 실무팀이 협력해 지역주민의 일상을 지원합니다.",
        details: [
          { label: "운영 체계", value: "관장 → 부장 → 사례관리팀 · 서비스제공팀 · 지역조직팀 · 운영지원팀" },
          { label: "공개 실명", value: "김형철 관장" }
        ],
        items: [
          { id: "organization-official-director", badge: "관장", title: "김형철 관장", meta: "복지관 운영 총괄", description: "복지관 운영 전반을 총괄합니다." },
          { id: "organization-official-deputy", badge: "부장", title: "부장", meta: "복지관 업무 총괄", description: "복지관의 사업과 조직 업무를 총괄합니다." },
          { id: "organization-official-case-lead", badge: "사례관리팀", title: "팀장", meta: "팀 총괄", description: "사례관리팀의 업무와 지역 자원 연계를 총괄합니다." },
          { id: "organization-official-case-worker-1", badge: "사례관리팀", title: "사회복지사", meta: "사례관리 · 지역사회보호", description: "사례관리사업과 지역사회보호사업을 담당합니다." },
          { id: "organization-official-case-worker-2", badge: "사례관리팀", title: "사회복지사", meta: "사례관리사업", description: "지역주민 사례관리 업무를 담당합니다." },
          { id: "organization-official-counselor", badge: "사례관리팀", title: "상담사", meta: "맘편한 심리정서치료", description: "맘편한 심리정서치료사업을 담당합니다." },
          { id: "organization-official-service-lead", badge: "서비스제공팀", title: "팀장", meta: "팀 총괄 · 생활도움서비스 애니맘", description: "서비스제공팀과 생활도움서비스 애니맘을 담당합니다." },
          { id: "organization-official-service-worker-1", badge: "서비스제공팀", title: "사회복지사", meta: "실버학당 · 부모자녀 · 자율이용", description: "송악실버학당, 부모·자녀 관계증진, 자율이용, 송악상영관, 원데이클래스를 담당합니다." },
          { id: "organization-official-service-worker-2", badge: "서비스제공팀", title: "사회복지사", meta: "취미·여가 · 건강증진", description: "취미·여가, 어르신 신체·정신건강증진과 기타 공모사업을 담당합니다." },
          { id: "organization-official-service-worker-3", badge: "서비스제공팀", title: "사회복지사", meta: "지역사회보호", description: "지역사회보호사업을 담당합니다." },
          { id: "organization-official-cook", badge: "서비스제공팀", title: "조리원", meta: "식당 조리", description: "복지관 식당의 조리 업무를 담당합니다." },
          { id: "organization-official-community-lead", badge: "지역조직팀", title: "팀장", meta: "팀 총괄 · 주민조직화 · 복지네트워크", description: "직원교육과 사회복지현장실습을 포함한 지역조직팀 업무를 총괄합니다." },
          { id: "organization-official-community-worker", badge: "지역조직팀", title: "사회복지사", meta: "홍보 · 후원 · 자원봉사 · 대관", description: "주민조직화, 홍보, 후원·자원봉사와 기관대관을 담당합니다." },
          { id: "organization-official-senior-work", badge: "지역조직팀", title: "노인일자리 전담인력", meta: "노인일자리지원사업", description: "노인일자리지원사업을 전담합니다." },
          { id: "organization-official-admin", badge: "운영지원팀", title: "사무원", meta: "회계 · 공문서 · 서무", description: "회계, 공문서와 서무 업무를 담당합니다." }
        ],
        ctaLabel: "조직도·직원 상세보기",
        note: "직원 개인정보 보호를 위해 필요한 실명만 표시합니다. 담당 팀은 대표전화 041-353-5077로 확인할 수 있습니다."
      };
    }

    if (template === "location") {
      return {
        template,
        label: "찾아오시는 길",
        eyebrow: "LOCATION",
        headline: "송악사회복지관 오시는 길",
        description: "지역주민 누구나 편안하게 방문하실 수 있도록 교통편과 연락처를 안내합니다.",
        details: [
          { label: "주소", value: "(31728) 충남 당진시 송악읍 송악로 656 (중흥리 367)" },
          { label: "전화", value: "041-353-5077" },
          { label: "팩스", value: "041-353-6077" },
          { label: "이메일", value: "sacwc2021@hanmail.net" }
        ],
        items: [
          { badge: "버스", title: "송악초등학교 하차", meta: "201 · 210 · 270번 / 도보 약 4분", description: "당진 시외버스터미널에서 승차해 송악초등학교 정류장에서 하차하세요." },
          { badge: "버스", title: "중흥 사거리 하차", meta: "202 · 220 · 274번 / 도보 약 8분", description: "중흥 사거리 정류장에서 하차해 송악로 방향으로 이동하세요." },
          { badge: "버스", title: "석포리 정류장 하차", meta: "215 · 223 · 231번 / 도보 약 12분", description: "석포리 정류장에서 하차해 송악사회복지관 방향으로 이동하세요." },
          { badge: "자가용", title: "내비게이션 검색", meta: "송악사회복지관 또는 송악로 656", description: "내비게이션에서 기관명이나 주소를 검색해 방문해 주세요." }
        ],
        ctaLabel: "주소 복사",
        note: "방문 전 대표전화로 프로그램 운영 여부를 확인하시면 더 편리합니다."
      };
    }

    if (template === "volunteer") {
      return {
        template,
        label: "자원봉사 안내",
        eyebrow: "VOLUNTEER",
        headline: "당신의 시간이 이웃의 일상에 힘이 됩니다",
        description: "개인과 단체의 재능과 경험을 지역사회를 위한 따뜻한 활동으로 연결합니다.",
        details: [
          { label: "신청 대상", value: "지역주민 · 대학생 · 직장인 · 단체" },
          { label: "문의", value: "041-353-5077" }
        ],
        items: [
          { badge: "01", title: "문의·상담", meta: "전화 또는 방문", description: "참여 가능한 활동과 희망 일정에 대해 상담합니다." },
          { badge: "02", title: "자원봉사 신청", meta: "개인·단체 신청", description: "희망 분야와 가능한 일정을 확인해 신청합니다." },
          { badge: "03", title: "자원봉사자 교육", meta: "활동 전 교육", description: "안전수칙과 개인정보 보호, 활동 내용을 안내합니다." },
          { badge: "04", title: "활동 및 일지 작성", meta: "봉사 참여·실적 관리", description: "활동 후 일지를 작성하고 봉사시간을 인증합니다." }
        ],
        ctaLabel: "자원봉사 신청하기",
        note: "신청은 방문 또는 유선으로 가능하며 지역조직화팀(041-353-5077)으로 문의해 주세요."
      };
    }

    if (template === "notice") {
      const attachment = (id, name) => ({
        id: `official-file-${id}`,
        type: "attachment",
        text: name,
        caption: "첨부파일 다운로드",
        media: {
          id: String(id),
          kind: "attachment",
          name,
          type: /\.pdf$/i.test(name) ? "application/pdf" : "application/octet-stream",
          url: `https://www.sacwc.kr/core/anyboard/download.php?boardID=www14&fileNum=${id}`
        }
      });
      const poster = (id, name, alt) => ({
        id: `official-poster-${id}`,
        type: "image",
        caption: alt,
        media: {
          id: String(id),
          kind: "image",
          name,
          type: /\.jpe?g$/i.test(name) ? "image/jpeg" : "image/png",
          alt,
          url: `https://www.sacwc.kr/core/anyboard/download.php?boardID=www14&fileNum=${id}`
        }
      });
      const decoration = (id, icon, x, y, layer = "back", color = "#3d7554") => ({
        id: `official-decoration-${id}`,
        icon,
        style: "soft-circle",
        color,
        layer,
        layouts: {
          desktop: { x, y }, tablet: { x, y }, phone: { x, y }, phoneSmall: { x, y }
        },
        sizes: { desktop: 58, tablet: 52, phone: 42, phoneSmall: 38 }
      });
      return {
        template,
        label: "공지·소식",
        eyebrow: "NOTICE",
        headline: "송악사회복지관의 새로운 소식",
        description: "모집, 행사, 기관 운영과 관련된 주요 안내를 빠르게 확인하세요.",
        details: [],
        items: [
          {
            id: "notice-official-1549",
            badge: "채용",
            title: "송악사회복지관 직원 채용 공고",
            meta: "2026.07.27",
            description: "송악사회복지관에서는 지역복지 발전을 위해 함께 근무할 사회복지사를 모집합니다.",
            detailContent: "재단법인 송악읍개발위원회에서 당진시로부터 수탁 운영하는 송악사회복지관에서는 당진시민 삶의 질 향상 및 지역복지 발전을 위하여 함께 근무할 전문 인력을 다음과 같이 모집합니다.",
            detailBlocks: [
              { id: "notice-1549-intro", type: "paragraph", text: "재단법인 송악읍개발위원회에서 당진시로부터 수탁 운영하는 송악사회복지관에서는 당진시민 삶의 질 향상 및 지역복지 발전을 위하여 함께 근무할 전문 인력을 다음과 같이 모집합니다." },
              { id: "notice-1549-heading-1", type: "heading", text: "1. 채용인원 및 분야" },
              { id: "notice-1549-table-1", type: "table", tableWidth: 100, rows: [["모집분야", "담당 업무", "인원", "자격사항", "계약형태"], ["사회복지사", "서비스 제공사업", "1명", "1. 사회복지사 자격증 소지자(필수)\n2. 사회복지관 근무 경력(우대)\n3. 사회복지시설 근무 경력(우대)\n4. 실제 운전 가능자(우대)", "정규직(신입)"]], columnWidths: [14, 15, 9, 45, 17] },
              { id: "notice-1549-heading-2", type: "heading", text: "2. 채용 일정" },
              { id: "notice-1549-schedule", type: "paragraph", text: "- 접수 기간: 2026. 07. 27.(월) ~ 2026. 8. 11.(화) / 15일간\n- 접수 방법: 이메일(sacwc2021@nate.com) 접수\n- 면접 일자: 추후 공지(서류전형 합격자에 한해 개별 통보)\n- 채용 일자: 2026. 09. 01.(최종합격자에 한해 개별 통보 및 홈페이지 공고)" },
              { id: "notice-1549-deadline", type: "highlight", text: "※ 마감일 15:00 도착분에 한함", color: "#b4232c" },
              { id: "notice-1549-heading-3", type: "heading", text: "3. 근로 및 급여기준" },
              { id: "notice-1549-table-2", type: "table", tableWidth: 100, rows: [["구분", "기준"], ["응시연령", "만 18세 이상, 정년(만 60세)이 1년 이상 남은 자"], ["성별·거주", "제한 없음(단, 남자는 병역을 필하였거나 면제된 자)"], ["급여기준", "보건복지부 당해 연도 인건비 가이드라인 준용"], ["근무시간 및 근로조건", "주 40시간 근무(월~금 09:00~18:00)를 원칙으로 하되 사업 운영에 따라 토요일 근무가 발생할 수 있으며 관련 규정에 따라 대체 휴무 또는 시간외 근무수당을 적용함."]], columnWidths: [25, 75] },
              { id: "notice-1549-career", type: "highlight", text: "* 경력인정: 보건복지부 ‘사회복지시설 관리 안내’에 따른 사회복지시설 근무 경력" },
              { id: "notice-1549-heading-4", type: "heading", text: "4. 제출서류" },
              { id: "notice-1549-docs", type: "paragraph", text: "[서류접수 시 제출서류]\n1. 입사지원서 및 자기소개서 각 1부(붙임 양식)\n   - 자기소개서 작성 시 경력자는 업무실적 중심으로 작성\n2. 개인정보 제공 이용 동의서 1부(붙임 양식)\n3. 자격증 사본 1부\n\n[최종합격자 추후 제출서류]\n1. 가족관계증명서 또는 주민등록등본 1부(병역필자는 병역사항 포함 초본 1부 별도)\n2. 경력증명서 각 1부(경력자에 한함)\n3. 채용 신체검사서 1부(B형간염 포함)" },
              { id: "notice-1549-return", type: "highlight", text: "※ ‘채용 절차의 공정화에 관한 법률 제11조’에 의하여 제출된 서류는 반환하지 않음" },
              { id: "notice-1549-heading-5", type: "heading", text: "5. 채용방법" },
              { id: "notice-1549-method", type: "paragraph", text: "1. 1차 서류 심사\n   - 지원자격 여부, 기재사항의 정확성, 블라인드 채용 여부, 불성실 기재 여부 등 확인\n   - 기관명 오기재, 필수항목 미입력 등은 불성실 기재에 해당\n   - 학교명, 출생지, 부모 직업 등 개인 신상을 직·간접적으로 파악할 수 있는 내용 기재 시 제외될 수 있음\n2. 2차 면접 심사\n   - 대상자는 서류심사 후 시간 및 장소를 개별 통보\n   - 기본 태도 및 소통 능력 20점, 성실성 및 대인관계 20점, 사회복지 가치 및 직무 이해 30점, 직업관 및 기관 적합성 20점, 발전 가능성 및 적응력 10점\n3. 가산점\n   - 사회복지사 1급 2점\n   - 사회복지관 근무 경력, 사회복지시설 근무 경력, 컴퓨터 활용 능력 2급 이상, ACP·GTQ 자격증, 등록장애인, 보훈 대상, 당진시 거주자 각 1점" },
              { id: "notice-1549-selection", type: "highlight", text: "최종합격자 및 예비 합격자는 면접점수 총점과 가산점을 합산한 고득점자순으로 선정합니다. 동점자는 사회복지사 1급 소지자, 사회복지관 근무 경력자 순으로 결정합니다." },
              { id: "notice-1549-heading-6", type: "heading", text: "6. 기타" },
              { id: "notice-1549-other", type: "paragraph", text: "- 근무지: 송악사회복지관(당진시 송악읍 송악로 656)\n- 입사지원서에 지원분야를 명시하며 미기입 시 서류심사 대상에서 제외\n- 제출서류는 한 개의 파일로 제출하고 파일명에 이름과 지원 분야 명시(예: ○○○-사회복지사 지원)\n- 입사지원서는 붙임 양식으로 작성하며 다른 양식 사용 시 제외\n- 개인정보 제공 이용 동의서는 필수 제출 사항이며 미제출 시 제외\n- 제출 내용이 사실이 아닐 경우 합격을 취소할 수 있음\n- 채용적격자가 없을 경우 채용하지 않을 수 있음\n- 문의: 송악사회복지관(041-353-5077)" },
              attachment(3462, "송악사회복지관 채용 공고 26.07.27 서비스제공 사회복지사.hwp")
            ],
            decorations: [decoration(1549, "document", 92, 170)]
          },
          {
            id: "notice-official-1548", badge: "모집", title: "⭐모집) 8월 원데이클래스", meta: "2026.07.25",
            description: "초등학생을 위한 무료 원데이클래스 참여자를 모집합니다.",
            detailContent: "8월 원데이클래스 참여자를 모집합니다.",
            detailBlocks: [
              { id: "notice-1548-intro", type: "paragraph", text: "8월 원데이클래스 참여자를 모집합니다." },
              { id: "notice-1548-info", type: "paragraph", text: "- 접수: ~8월 6일(목) 18시까지\n- 일시: 8월 7일(금) 10시~12시\n- 대상: 초등학생(1~6학년) 15명\n- 비용: 무료\n- 장소: 송악사회복지관 2층 강당(당진시 송악읍 송악로 656)\n- 문의: 041-353-5077 서비스제공팀\n- 신청: 온라인 신청(QR코드 접속 후 네이버폼 정보 입력)" },
              { id: "notice-1548-link", type: "highlight", text: "온라인 신청: https://naver.me/xm0utz9E", linkUrl: "https://naver.me/xm0utz9E" },
              { id: "notice-1548-caution", type: "highlight", text: "※ 선착순 모집으로 조기 마감될 수 있습니다." },
              { id: "notice-1548-end", type: "paragraph", text: "지역 주민분들의 많은 관심과 참여 바랍니다. 감사합니다." },
              poster(3461, "원데이.png", "8월 원데이클래스 안내 포스터"), attachment(3461, "원데이.png")
            ], decorations: [decoration(1548, "calendar", 90, 175)]
          },
          {
            id: "notice-official-1547", badge: "안내", title: "⭐안내) 8월 송악상영관", meta: "2026.07.25",
            description: "8월 14일과 28일, 지역주민을 위한 무료 영화 상영을 진행합니다.", detailContent: "8월 송악상영관 운영을 안내드립니다.",
            detailBlocks: [
              { id: "notice-1547-intro", type: "paragraph", text: "8월 송악상영관 운영을 안내드립니다." },
              { id: "notice-1547-info", type: "paragraph", text: "- 일시: 8월 14일(금) / 8월 28일(금) 14시~16시\n- 대상: 당진시 지역주민\n- 참가비: 무료(팝콘도 무료 제공)\n- 장소: 송악사회복지관 2층 강당(당진시 송악읍 송악로 656)\n- 문의: 041-353-5077 서비스제공팀" },
              { id: "notice-1547-caution", type: "highlight", text: "※ 해당 프로그램은 사전 접수 없이 참여 가능합니다." },
              { id: "notice-1547-end", type: "paragraph", text: "많은 관심과 참여 부탁드립니다♡" },
              poster(3460, "송악상영관.png", "8월 송악상영관 안내 포스터"), attachment(3460, "송악상영관.png")
            ], decorations: [decoration(1547, "film", 91, 175)]
          },
          {
            id: "notice-official-1546", badge: "지원", title: "⭐여성1인 소상공인 점포 범죄예방 물품 지원사업 신청 안내(※송악읍 중흥리 소재 점포 대상)", meta: "2026.07.22",
            description: "송악읍 중흥리 소재 여성 1인 소상공인을 위한 범죄예방 물품 지원사업입니다.",
            detailContent: "송악사회복지관에서는 지역 내 여성 1인 소상공인의 안전한 영업환경 조성을 위해 범죄예방 물품 지원 대상자를 모집합니다.",
            detailBlocks: [
              { id: "notice-1546-intro", type: "paragraph", text: "송악사회복지관에서는 지역 내 여성 1인 소상공인의 안전한 영업환경 조성을 위해 당진시복지재단에서 추진하는 [당진시 여성1인 소상공인 범죄예방 물품 지원사업]의 지원 대상자를 모집합니다. 지원이 필요하신 분들의 많은 관심과 신청 바랍니다." },
              { id: "notice-1546-heading-1", type: "heading", text: "1. 지원 대상" },
              { id: "notice-1546-target", type: "paragraph", text: "당진시 송악읍 중흥리 소재 여성 1인 운영 소상공인 중 기준 중위소득 120% 이하에 해당하는 자" },
              { id: "notice-1546-exception", type: "highlight", text: "※ 일반 유흥주점, 성인용품 판매점 등 일부 업종은 지원 대상에서 제외됩니다." },
              { id: "notice-1546-heading-2", type: "heading", text: "2. 지원 내용" },
              { id: "notice-1546-support", type: "paragraph", text: "호신용 범죄예방 물품 2종 1세트\n- 휴대용 SOS 비상벨\n- 호신용 스프레이" },
              { id: "notice-1546-heading-3", type: "heading", text: "3. 신청 기한" },
              { id: "notice-1546-deadline", type: "highlight", text: "7월 28일(화)까지", color: "#b4232c" },
              { id: "notice-1546-heading-4", type: "heading", text: "4. 신청 시 필요한 정보 및 서류" },
              { id: "notice-1546-docs", type: "paragraph", text: "[기본정보]\n- 이름, 세대유형, 가정유형, 성별, 연령, 연락처\n- 세대유형: 수급자, 차상위, 저소득(중위소득 120% 이하)\n- 가정유형: 한부모, 미혼모, 이혼, 1인 등\n\n[신청사유]\n- 점포 운영 형태와 지원이 필요한 사유\n\n[제출서류]\n1. 개인정보공개동의서(첨부파일 다운로드 후 작성)\n2. 사업자등록증 사본\n3. 소득 확인이 가능한 증빙서류(소득금액증명원, 수급자증명서 등)" },
              { id: "notice-1546-example", type: "highlight", text: "신청사유 예시: 심야 시간 홀로 매장을 운영하고 있어 범죄 노출 우려가 큰 경우 또는 여성 1인 사업장으로 주변 범죄 소식에 불안감이 큰 경우" },
              { id: "notice-1546-heading-5", type: "heading", text: "5. 신청 방법" },
              { id: "notice-1546-method", type: "paragraph", text: "- 방문 접수: 송악사회복지관(사전 전화 상담 후 방문)\n- 비대면 접수: 송악사회복지관 카카오톡 메시지로 신청 내용 및 서류 전송" },
              { id: "notice-1546-heading-6", type: "heading", text: "6. 문의" },
              { id: "notice-1546-contact", type: "paragraph", text: "041-353-5077(송악사회복지관 지역조직팀)" },
              attachment(3459, "개인정보공개동의서.hwp")
            ], decorations: [decoration(1546, "shield", 91, 170)]
          },
          {
            id: "notice-official-1542", badge: "공개", title: "2026년 6월 업무추진비 사용내역", meta: "2026.07.03",
            description: "송악사회복지관 2026년 6월 업무추진비 사용내역을 공개합니다.", detailContent: "송악사회복지관 2026년 6월 업무추진비 사용내역을 공개합니다.",
            detailBlocks: [
              { id: "notice-1542-intro", type: "paragraph", text: "송악사회복지관 2026년 6월 업무추진비 사용내역을 공개합니다." },
              { id: "notice-1542-highlight", type: "highlight", text: "세부 사용내역은 아래 PDF 첨부파일에서 확인할 수 있습니다." },
              attachment(3456, "업무추진비 사용내역.pdf")
            ], decorations: [decoration(1542, "chart", 91, 170)]
          },
          {
            id: "notice-official-1536", badge: "공지", title: "2026년 사회복지현장실습생 선정결과 발표", meta: "2026.06.26",
            description: "2026년 하계 사회복지현장실습생 선정결과를 발표합니다.", detailContent: "2026년 하계 사회복지현장실습생 선정결과를 아래와 같이 발표합니다.",
            detailBlocks: [
              { id: "notice-1536-intro", type: "paragraph", text: "2026년 하계 사회복지현장실습생 선정결과를 아래와 같이 발표합니다." },
              { id: "notice-1536-list", type: "paragraph", text: "1. 최00: 전화번호 뒷자리 2209\n2. 김00: 전화번호 뒷자리 7166\n3. 이00: 전화번호 뒷자리 2545\n4. 신00: 전화번호 뒷자리 3090\n5. 정00: 전화번호 뒷자리 7860\n6. 김00: 전화번호 뒷자리 7783" },
              { id: "notice-1536-note", type: "highlight", text: "기관 여건상 신청해주신 모든 분과 실습을 진행하지 못한 점 양해의 말씀드립니다." },
              { id: "notice-1536-end", type: "paragraph", text: "선정된 실습생분들에게는 개별 연락 드리겠습니다. 감사합니다." }
            ], decorations: [decoration(1536, "checklist", 91, 170)]
          },
          {
            id: "notice-official-1535", badge: "모집", title: "⭐모집) 7월 원데이클래스", meta: "2026.06.26",
            description: "당진시 성인 지역주민을 위한 무료 원데이클래스입니다.", detailContent: "안녕하세요! 송악사회복지관입니다. 7월 원데이클래스 안내드립니다.",
            detailBlocks: [
              { id: "notice-1535-intro", type: "paragraph", text: "안녕하세요! 송악사회복지관입니다.\n7월 원데이클래스 안내드립니다." },
              { id: "notice-1535-info", type: "paragraph", text: "- 접수: ~7월 10일(금) 18시까지\n- 일시: 7월 11일(토) 13시~15시\n- 대상: 당진시 지역주민(성인) 15명\n- 비용: 무료\n- 장소: 송악사회복지관 2층 강당(당진시 송악읍 송악로 656)\n- 문의: 041-353-5077 서비스제공팀\n- 신청: 온라인 신청(QR코드 접속 후 네이버폼 정보 입력)" },
              { id: "notice-1535-link", type: "highlight", text: "온라인 신청: https://naver.me/FwG6OHdp", linkUrl: "https://naver.me/FwG6OHdp" },
              { id: "notice-1535-caution", type: "highlight", text: "※ 선착순 모집으로 조기 마감될 수 있습니다." },
              { id: "notice-1535-end", type: "paragraph", text: "지역 주민분들의 많은 관심과 참여 바랍니다. 감사합니다." },
              poster(3450, "8. 원데이댄스(7-11).png", "7월 원데이클래스 안내 포스터"), attachment(3450, "8. 원데이댄스(7-11).png")
            ], decorations: [decoration(1535, "calendar", 91, 170)]
          },
          {
            id: "notice-official-1534", badge: "안내", title: "⭐안내) 7월 송악상영관", meta: "2026.06.26",
            description: "7월 10일과 24일, 지역주민을 위한 무료 영화 상영을 진행합니다.", detailContent: "안녕하세요! 송악사회복지관입니다.",
            detailBlocks: [
              { id: "notice-1534-intro", type: "paragraph", text: "안녕하세요! 송악사회복지관입니다." },
              { id: "notice-1534-info", type: "paragraph", text: "- 일시: 7월 10일(금) / 7월 24일(금) 14시~16시\n- 대상: 당진시 지역주민\n- 참가비: 무료(팝콘도 무료 제공)\n- 장소: 송악사회복지관 2층 강당(당진시 송악읍 송악로 656)\n- 문의: 041-353-5077 서비스제공팀" },
              { id: "notice-1534-caution", type: "highlight", text: "※ 해당 프로그램은 사전 접수 없이 참여 가능합니다." },
              { id: "notice-1534-end", type: "paragraph", text: "많은 관심과 참여 부탁드립니다♡" },
              poster(3449, "9. 송악상영관(7-24).png", "7월 송악상영관 안내 포스터"), attachment(3449, "9. 송악상영관(7-24).png")
            ], decorations: [decoration(1534, "film", 91, 170)]
          },
          {
            id: "notice-official-1533", badge: "모집", title: "⭐모집) 디지털 역량강화 프로그램(키오스크)", meta: "2026.06.16",
            description: "키오스크 활용을 배우는 무료 디지털 역량강화 프로그램입니다.", detailContent: "디지털 역량강화 프로그램(키오스크) 참여자를 모집합니다.",
            detailBlocks: [
              { id: "notice-1533-intro", type: "paragraph", text: "디지털 역량강화 프로그램(키오스크) 참여자를 모집합니다." },
              { id: "notice-1533-info", type: "paragraph", text: "1. 접수기간: 26. 6. 16.(화) ~ 26. 6. 30.(화)\n2. 이용기간: 26. 7. 6.(월) ~ 26. 7. 27.(월), 총 4회기\n3. 접수방법: 송악사회복지관 방문 접수\n4. 접수장소: 송악사회복지관 1층 로비(송악읍 송악로 656)\n5. 수강료: 무료\n6. 문의: 041-353-5077(서비스제공팀)" },
              { id: "notice-1533-free", type: "highlight", text: "수강료는 무료입니다." },
              poster(3448, "10. (6-30)키오스크.jpg", "디지털 역량강화 프로그램 안내 포스터"), attachment(3448, "10. (6-30)키오스크.jpg")
            ], decorations: [decoration(1533, "device", 91, 170)]
          },
          {
            id: "notice-official-1532", badge: "모집", title: "2026년 하계 사회복지현장실습 추가 모집", meta: "2026.06.15",
            description: "2026년 하계 사회복지현장실습 실습생 1명을 추가 모집합니다.", detailContent: "송악사회복지관에서는 2026년 하계 사회복지현장실습 실습생을 아래와 같이 추가 모집합니다.",
            detailBlocks: [
              { id: "notice-1532-intro", type: "paragraph", text: "송악사회복지관에서는 2026년 하계 사회복지현장실습 실습생을 아래와 같이 추가 모집하오니, 사회복지학전공자들의 많은 참여를 기대합니다." },
              { id: "notice-1532-heading-1", type: "heading", text: "1. 실습대상" },
              { id: "notice-1532-target", type: "paragraph", text: "- 사회복지사가 되고자 하는 자\n- 사회복지사 자격증 필수이수과목 중 4과목 이상 이수\n  (사회복지개론, 인간행동과 사회환경, 사회복지조사론, 사회복지실천론, 사회복지실천기술론, 지역사회복지론, 사회복지정책론, 사회복지행정론, 사회복지법제론)" },
              { id: "notice-1532-info", type: "paragraph", text: "2. 모집인원: 1명\n3. 실습기간: 2026. 07. 06.(월) ~ 08. 03.(월) 09:00~18:00, 총 160시간\n4. 모집기간: 2026. 06. 15.(월) ~ 06. 24.(수)\n5. 선발방법: 2차 서류전형 심사 후 최종합격 여부 발표\n6. 신청방법: 이메일(sacwc2021@nate.com) 접수\n7. 제출서류: 실습생 프로파일, 개인정보 수집·이용 동의서\n8. 실습비용: 100,000원(중식비 별도)\n9. 유의사항: 제출서류의 기재내용이 허위일 경우 선발 취소될 수 있음\n10. 문의: 송악사회복지관(041-353-5077)" },
              { id: "notice-1532-deadline", type: "highlight", text: "※ 마감일 18:00 도착분에 한함\n※ 최종 결과는 2026. 06. 26.(금) 홈페이지 공고 및 개별 통보" },
              { id: "notice-1532-file", type: "highlight", text: "이메일 제출 파일명: 송악사회복지관 사회복지현장실습_000(이름)" },
              { id: "notice-1532-fee", type: "highlight", text: "※ 최종합격 후 실습비 납부 관련 별도 안내 예정. 실습비 납부 후 개인 사정으로 실습을 취소할 경우 환불 불가" },
              attachment(3447, "2.2026년 실습생+프로파일+및+개인정보동의및활용동의서+양식.hwp")
            ], decorations: [decoration(1532, "people", 91, 170)]
          }
        ],
        ctaLabel: "공지사항 전체보기",
        note: "모집 일정과 운영 내용은 변경될 수 있으므로 게시물의 문의처로 최신 내용을 확인해 주세요."
      };
    }

    if (template === "schedule") {
      return {
        template,
        label: "프로그램 일정표",
        eyebrow: "PROGRAM SCHEDULE",
        headline: "프로그램 시간표",
        description: "요일과 시간대별 프로그램을 읽기 쉬운 카드로 안내합니다.",
        details: [
          { label: "오전 자율이용", value: "월요일 09:00~10:00 · 목요일 10:00~12:00" },
          { label: "시설 정비", value: "화~토요일 12:00~13:00 각 프로그램실 정비" },
          { label: "문의", value: "041-353-5077 서비스제공팀" }
        ],
        items: [
          { id: "schedule-official-yoga", badge: "월", title: "요가", meta: "10:00~12:00 · 청소년문화공간", description: "월요일 오전 정기 프로그램" },
          { id: "schedule-official-janggu", badge: "월", title: "장구난타", meta: "10:00~12:00 · 강당", description: "월요일 오전 정기 프로그램" },
          { id: "schedule-official-song", badge: "월", title: "노래교실", meta: "13:00~14:00 · 강당", description: "월요일 오후 정기 프로그램" },
          { id: "schedule-official-art", badge: "월", title: "예술 동아리", meta: "10:00~12:00 · 1실", description: "월요일 오전 동아리 활동" },
          { id: "schedule-official-book", badge: "월", title: "북난타 동아리", meta: "12:00~15:00 · 청소년문화공간 5~6월", description: "기간 운영 동아리 활동" },
          { id: "schedule-official-diet", badge: "화", title: "다이어트 댄스", meta: "10:00~12:00 · 강당", description: "화요일 오전 정기 프로그램" },
          { id: "schedule-official-smartphone", badge: "화", title: "스마트폰 활용교육", meta: "13:00~15:00 · 5실 · 3월 개강", description: "화요일 오후 디지털 교육" },
          { id: "schedule-official-guitar", badge: "수", title: "통기타", meta: "10:00~12:00 · 강당", description: "수요일 오전 정기 프로그램" },
          { id: "schedule-official-line", badge: "수", title: "라인댄스", meta: "13:00~15:00 · 강당", description: "수요일 오후 정기 프로그램" },
          { id: "schedule-official-hangeul", badge: "목", title: "한글", meta: "13:00~15:00 · 3실", description: "목요일 오후 정기 프로그램" },
          { id: "schedule-official-service-club", badge: "목", title: "봉사 동아리", meta: "13:00~15:00 · 5실/강당", description: "목요일 오후 동아리 활동" },
          { id: "schedule-official-chess", badge: "목", title: "장기 동아리", meta: "13:00~16:00 · 1실", description: "목요일 오후 동아리 활동" },
          { id: "schedule-official-gym", badge: "금", title: "기체조", meta: "13:00~14:00 · 강당", description: "금요일 오후 정기 프로그램" },
          { id: "schedule-official-movie", badge: "금", title: "송악상영관", meta: "14:00~16:00 · 강당 · 둘째·넷째 주", description: "금요일 무료 영화 상영" },
          { id: "schedule-official-oneday", badge: "토", title: "원데이클래스", meta: "13:00~15:00 · 실시간 · 매월 셋째 주", description: "토요일 월별 체험 프로그램" }
        ],
        ctaLabel: "프로그램 시간표 상세보기",
        note: "3월 게시 시간표를 기준으로 안내합니다. 일정 변경과 모집 여부는 최신 공지사항을 우선 확인해 주세요."
      };
    }

    if (template === "footer") {
      return {
        template,
        layoutStyle: "split",
        footerLayoutControls: normalizeFooterLayoutControls(),
        footerDocuments: createFooterDocuments(),
        label: "하단 정보",
        eyebrow: "SONGAK COMMUNITY WELFARE CENTER",
        headline: "송악사회복지관",
        description: "주민과 함께 행복한 지역공동체를 만들어갑니다.",
        details: [
          { label: "주소", value: "(31728) 충남 당진시 송악읍 송악로 656" },
          { label: "전화", value: "041-353-5077" },
          { label: "팩스", value: "041-353-6077" },
          { label: "이메일", value: "sacwc2021@hanmail.net" }
        ],
        items: [
          { documentKey: "privacy", badge: "바로가기", title: "개인정보처리방침", meta: "필수 정책", description: "개인정보 보호 기준과 처리 절차를 안내합니다." },
          { documentKey: "email", badge: "안내", title: "이메일무단수집거부", meta: "이용 안내", description: "웹사이트에 게시된 이메일 주소의 무단 수집을 거부합니다." },
          { documentKey: "directions", badge: "연결", title: "찾아오시는 길", meta: "방문 안내", description: "주소와 교통편을 확인할 수 있습니다." }
        ],
        ctaLabel: "대표전화 연결",
        note: "Copyright © 송악사회복지관. All rights reserved."
      };
    }

    return {
      template: "facility",
      label: "시설현황",
      eyebrow: "FACILITIES",
      headline: "층마다 이어지는 주민의 열린 복지공간",
      description: "송악사회복지관 공식 시설현황의 층별 공간과 운영시간을 반영했습니다.",
      details: [
        { label: "건립년도", value: "2020년" },
        { label: "부지", value: "7,771㎡" },
        { label: "연면적", value: "2,406㎡" },
        { label: "운영시간", value: "평일 09:00~20:00 · 토 09:00~18:00 · 일·공휴일 휴무" }
      ],
      items: [
        { id: "facility-official-external", badge: "외부", title: "야외 시설", meta: "주차장(장애인 포함) · 농구장", description: "주민 방문과 야외 활동을 지원하는 외부 공간입니다." },
        { id: "facility-official-roof", badge: "3F", title: "옥상", meta: "게이트볼장 · 야외 테라스", description: "체육과 휴식을 함께 즐길 수 있는 옥상 공간입니다." },
        { id: "facility-official-second", badge: "2F", title: "문화·교육 공간", meta: "프로그램실 4·5·6 · 강당 · 청소년문화공간", description: "심리치료실, 노인회 사무실, 부모상담실과 노래방 1·2·3도 운영됩니다." },
        { id: "facility-official-first", badge: "1F", title: "상담·생활 공간", meta: "프로그램실 1·3 · 사무실 · 관장실 · 식당", description: "당구장, 체력단련실, 탁구장, 통신실과 육아나눔터가 있습니다." },
        { id: "facility-official-basement", badge: "B1", title: "시설 관리 공간", meta: "보일러실 · 전기실 · 창고 1·2", description: "비상발전기실을 포함한 안전·시설 관리 공간입니다." }
      ],
      ctaLabel: "시설현황 상세보기",
      note: "시설별 이용 가능 시간은 운영 프로그램과 대관 일정에 따라 달라질 수 있습니다."
    };
  }

  function normalizeModel(model = {}, fallbackTemplate = "facility") {
    const template = isTemplate(model.template) ? String(model.template) : (isTemplate(fallbackTemplate) ? fallbackTemplate : "facility");
    const defaults = createTemplateModel(template);
    const rawItems = Array.isArray(model.items) ? model.items : defaults.items;
    const rawDetails = Array.isArray(model.details) ? model.details : defaults.details;
    const items = rawItems.slice(0, 18).map((item, index) => normalizeItem(item, index, template));
    const details = rawDetails.slice(0, 12).map((detail, index) => normalizeDetail(detail, index, template));
    const maxItemId = items.reduce((max, item) => Math.max(max, Number(item.id.replace(/\D/g, "")) || 0), 0);
    const maxDetailId = details.reduce((max, item) => Math.max(max, Number(item.id.replace(/\D/g, "")) || 0), 0);
    const facilityDetailKind = ["hero", "guide", "selector", "callout"].includes(model.facilityDetailKind)
      ? String(model.facilityDetailKind)
      : "";
    // Keep every integrated detail page kind stable through save/restore.
    const detailPageKind = ["schedule", "case", "organization", "video", "application", "account"].includes(model.detailPageKind)
      ? String(model.detailPageKind)
      : "";
    const detailSectionKind = String(model.detailSectionKind ?? "").slice(0, 80);
    const requestedSelectedItemId = String(model.facilityDetailSelectedItemId ?? "");
    const facilityDetailSelectedItemId = items.some((item) => item.id === requestedSelectedItemId)
      ? requestedSelectedItemId
      : String(items[0]?.id ?? "");
    const textStyles = normalizeStyleSet(model.textStyles, createStyleDefaults(template, "section"));
    Object.keys(textStyles).forEach((viewport) => {
      textStyles[viewport].facilityDetailSecondaryCta = normalizeStyle(
        model.textStyles?.[viewport]?.facilityDetailSecondaryCta,
        textStyles[viewport].ctaLabel
      );
    });
    return {
      template,
      facilityDetailKind,
      detailPageKind,
      detailSectionKind,
      detailDesignVersion: Math.max(0, Math.floor(Number(model.detailDesignVersion) || 0)),
      detailSelectedFilter: String(model.detailSelectedFilter ?? "all").slice(0, 80),
      detailAssetUrl: String(model.detailAssetUrl ?? ""),
      detailAssetAlt: String(model.detailAssetAlt ?? ""),
      detailMobileAssetUrl: String(model.detailMobileAssetUrl ?? ""),
      detailMobileAssetAlt: String(model.detailMobileAssetAlt ?? ""),
      detailAssetFit: model.detailAssetFit === "contain" ? "contain" : "cover",
      detailAssetScale: Math.max(.2, Math.min(4, Number(model.detailAssetScale) || 1)),
      detailAssetOpacity: Math.max(0, Math.min(100, Number(model.detailAssetOpacity ?? 100))),
      detailSecondaryCta: String(model.detailSecondaryCta ?? ""),
      socialLayout: SOCIAL_LOGIN_LAYOUTS.includes(String(model.socialLayout))
        ? String(model.socialLayout)
        : "drive-split",
      socialButtonStyles: normalizeSocialLoginButtonStyles(model.socialButtonStyles),
      facilityDetailSelectedItemId,
      facilityDetailSecondaryCta: String(model.facilityDetailSecondaryCta ?? ""),
      facilityDetailDesignVersion: Math.max(0, Math.floor(Number(model.facilityDetailDesignVersion) || 0)),
      facilityDetailSizingVersion: Math.max(0, Math.floor(Number(model.facilityDetailSizingVersion) || 0)),
      layoutStyle: template === "footer"
        ? (FOOTER_LAYOUTS.includes(String(model.layoutStyle ?? defaults.layoutStyle))
          ? String(model.layoutStyle ?? defaults.layoutStyle)
          : "split")
        : "info",
      footerLayoutControls: template === "footer"
        ? normalizeFooterLayoutControls(model.footerLayoutControls ?? defaults.footerLayoutControls)
        : {},
      desktopFirstRowCount: Math.max(
        1,
        Math.min(4, Math.floor(Number(model.desktopFirstRowCount) || (template === "location" ? 2 : 3)))
      ),
      label: String(model.label ?? defaults.label ?? TEMPLATE_LABELS[template]),
      eyebrow: String(model.eyebrow ?? defaults.eyebrow),
      headline: String(model.headline ?? defaults.headline),
      description: String(model.description ?? defaults.description),
      details,
      items,
      footerDocuments: template === "footer" ? normalizeFooterDocuments(model.footerDocuments ?? defaults.footerDocuments) : {},
      ctaLabel: String(model.ctaLabel ?? defaults.ctaLabel),
      note: String(model.note ?? defaults.note),
      nextItemId: Math.max(Number(model.nextItemId) || 1, maxItemId + 1),
      nextDetailId: Math.max(Number(model.nextDetailId) || 1, maxDetailId + 1),
      textStyles,
      heights: model.heights && typeof model.heights === "object" ? clone(model.heights) : {}
    };
  }

  function createDefaultModel(template = "facility") {
    return normalizeModel(createTemplateModel(isTemplate(template) ? template : "facility"), template);
  }

  function addItem(model, afterItemId = null) {
    const next = normalizeModel(model, model?.template);
    if (next.items.length >= 18) return next;
    const id = `${next.template}-item-${next.nextItemId++}`;
    const index = afterItemId ? next.items.findIndex((item) => item.id === afterItemId) : -1;
    next.items.splice(index >= 0 ? index + 1 : next.items.length, 0, normalizeItem({ id }, next.items.length, next.template));
    return next;
  }

  function removeItem(model, itemId) {
    const next = normalizeModel(model, model?.template);
    next.items = next.items.filter((item) => item.id !== itemId);
    if (next.facilityDetailKind === "selector" && !next.items.some((item) => item.id === next.facilityDetailSelectedItemId)) {
      next.facilityDetailSelectedItemId = String(next.items[0]?.id ?? "");
    }
    return next;
  }

  function addDetail(model, afterDetailId = null) {
    const next = normalizeModel(model, model?.template);
    if (next.details.length >= 12) return next;
    const id = `${next.template}-detail-${next.nextDetailId++}`;
    const index = afterDetailId ? next.details.findIndex((item) => item.id === afterDetailId) : -1;
    next.details.splice(index >= 0 ? index + 1 : next.details.length, 0, normalizeDetail({ id }, next.details.length, next.template));
    return next;
  }

  function removeDetail(model, detailId) {
    const next = normalizeModel(model, model?.template);
    next.details = next.details.filter((item) => item.id !== detailId);
    return next;
  }

  function moveItem(items, itemId, direction) {
    const next = clone(Array.isArray(items) ? items : []);
    const index = next.findIndex((item) => item.id === itemId);
    const target = direction === "up" || direction === "previous" ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= next.length) return next;
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  }

  function estimateHeight(model, viewport = "desktop") {
    const next = normalizeModel(model, model?.template);
    const itemCount = next.items.length;
    const detailCount = next.details.length;
    const responsive = viewport !== "desktop";
    const desktopRowCount = getBalancedRowSizes(itemCount, next.desktopFirstRowCount).length;
    if (next.template === "footer" && next.layoutStyle === "compact") return responsive ? 410 : 300;
    if (next.template === "footer" && next.layoutStyle === "split") return responsive ? 500 : 380;
    if (next.template === "footer" && next.layoutStyle === "simple") return responsive ? 500 : 430;
    if (next.template === "footer") return responsive ? 650 + itemCount * 78 : 520 + Math.ceil(itemCount / 3) * 120;
    if (next.template === "notice" || next.template === "schedule") return responsive ? 520 + itemCount * 154 + detailCount * 62 : 520 + itemCount * 116 + Math.ceil(detailCount / 2) * 68;
    if (next.template === "location") return responsive ? 650 + itemCount * 174 + detailCount * 72 : 620 + desktopRowCount * 190 + Math.ceil(detailCount / 2) * 76;
    return responsive ? 560 + itemCount * 176 + detailCount * 70 : 560 + desktopRowCount * 210 + Math.ceil(detailCount / 2) * 70;
  }

  window.EditorEssentialManager = Object.freeze({
    BASE_SECTION_IDS,
    FOOTER_LAYOUTS,
    SOCIAL_LOGIN_LAYOUTS,
    TEMPLATE_LABELS,
    VIEWPORTS,
    addDetail,
    addItem,
    createDefaultModel,
    estimateHeight,
    getBalancedItemLayout,
    getBalancedRowSizes,
    isBaseSection,
    isSection,
    isTemplate,
    moveItem,
    normalizeNoticeBlock,
    normalizeNoticeMedia,
    normalizeNoticeLink,
    normalizeModel,
    removeDetail,
    removeItem
  });
})();
