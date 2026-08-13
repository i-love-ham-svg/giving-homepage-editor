/**
 * Visual-only contract for the community page.
 *
 * The community page keeps resident posts in the board API. Only presentation
 * state is allowed in document.globals.externalSurfaces.community so the
 * shared page editor can reuse its toolbar, background, decoration, history,
 * and site-content revision pipeline without copying board or personal data.
 */

export const COMMUNITY_EDITOR_SCHEMA_VERSION = 1 as const;
export const COMMUNITY_EDITOR_SURFACE_KEY = "community" as const;
export const COMMUNITY_EDITOR_SURFACE_ID = "publishing.page.community-board" as const;
export const COMMUNITY_EDITOR_SECTION_ID = "community" as const;
export const COMMUNITY_EDITOR_MESSAGE_CHANNEL = "songak.external-surface-editor" as const;

export const COMMUNITY_EDITOR_TARGET_IDS = Object.freeze({
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
  emptyDescription: "community.list.empty-description",
} as const);

export type CommunityEditorTargetId = typeof COMMUNITY_EDITOR_TARGET_IDS[keyof typeof COMMUNITY_EDITOR_TARGET_IDS];
export type CommunityEditorViewport = "desktop" | "tablet" | "phone" | "phoneSmall";
export type CommunityTextTargetId = Exclude<CommunityEditorTargetId, typeof COMMUNITY_EDITOR_TARGET_IDS.section>;

export type CommunityEditorFields = {
  eyebrow: string;
  title: string;
  description: string;
  primaryCta: string;
  secondaryCta: string;
  publicLabel: string;
  publicValue: string;
  privacyLabel: string;
  privacyValue: string;
  processLabel: string;
  processValue: string;
  listEyebrow: string;
  listTitle: string;
  emptyTitle: string;
  emptyDescription: string;
};

export type CommunityTextStyle = {
  size: number;
  color: string;
  background: string | null;
  font: string;
  align: "left" | "center" | "right";
  boxWidth: number;
  boxOffsetX: number;
  boxOffsetY: number;
};

export type CommunityLayout = {
  contentWidth: number;
  paddingTop: number;
  paddingBottom: number;
  infoColumns: number;
  gap: number;
};

export type CommunitySectionAppearance = {
  background: string;
  accent: string;
  text: string;
  preset: string;
  decoration: string | null;
};

export type CommunityBackgroundLayout = {
  imageX: number;
  imageY: number;
  imageW: number;
  imageH: number;
  imageScale: number;
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
};

export type CommunityBackground = {
  mode: "default" | "color" | "image";
  color: string;
  colorEnabled: boolean;
  imageName: string | null;
  imageDataUrl: string | null;
  naturalWidth: number;
  naturalHeight: number;
  opacity: number;
  layouts: Record<CommunityEditorViewport, CommunityBackgroundLayout | null>;
};

export type CommunityDecoration = {
  id: string;
  icon: string;
  style: string;
  color: string | null;
  layer: "front" | "back";
  layouts: Record<CommunityEditorViewport, { x: number; y: number }>;
  sizes: Record<CommunityEditorViewport, number>;
};

export type CommunityPageDecorations = {
  cards: [];
  decorations: CommunityDecoration[];
  nextDecorationId: number;
};

export type CommunityEditorSurface = {
  schemaVersion: typeof COMMUNITY_EDITOR_SCHEMA_VERSION;
  surfaceId: typeof COMMUNITY_EDITOR_SURFACE_ID;
  sectionId: typeof COMMUNITY_EDITOR_SECTION_ID;
  fields: CommunityEditorFields;
  textStyles: Record<CommunityEditorViewport, Record<CommunityTextTargetId, CommunityTextStyle>>;
  layouts: Record<CommunityEditorViewport, CommunityLayout>;
  appearance: CommunitySectionAppearance;
  background: CommunityBackground;
  pageDecorations: CommunityPageDecorations;
};

const VIEWPORTS: CommunityEditorViewport[] = ["desktop", "tablet", "phone", "phoneSmall"];
const TEXT_TARGET_IDS = Object.freeze(
  Object.values(COMMUNITY_EDITOR_TARGET_IDS).filter(
    (targetId): targetId is CommunityTextTargetId => targetId !== COMMUNITY_EDITOR_TARGET_IDS.section,
  ),
);
const TARGET_ID_SET = new Set<CommunityEditorTargetId>(Object.values(COMMUNITY_EDITOR_TARGET_IDS));
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const SAFE_IMAGE_SOURCE = /^(?:data:image\/(?:png|jpe?g|webp|gif|avif);base64,[a-z0-9+/=]+|\/api\/site-assets\/[a-z0-9][a-z0-9._-]{0,159}|\.\/assets\/[a-z0-9][a-z0-9/._-]{0,300})$/i;
const FONT_KEYS = new Set([
  "sans",
  "serif",
  "koreanBrush",
  "koreanKcc",
  "koreanNanumBrush",
  "koreanLoveLetter",
  "englishScript",
  "englishSignature",
]);

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clone<T>(value: T): T {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value)) as T;
}

function clamp(value: unknown, minimum: number, maximum: number, fallback: number): number {
  const parsed = Number(value);
  return Math.max(minimum, Math.min(maximum, Number.isFinite(parsed) ? parsed : fallback));
}

function text(value: unknown, fallback: string, maximum: number): string {
  return (typeof value === "string" ? value : fallback).slice(0, maximum);
}

function color(value: unknown, fallback: string): string {
  return HEX_COLOR.test(String(value || "")) ? String(value).toLowerCase() : fallback;
}

function nullableColor(value: unknown): string | null {
  return HEX_COLOR.test(String(value || "")) ? String(value).toLowerCase() : null;
}

function integer(value: unknown, minimum: number, maximum: number, fallback: number): number {
  return Math.round(clamp(value, minimum, maximum, fallback));
}

const FIELD_DEFAULTS: CommunityEditorFields = Object.freeze({
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
  emptyDescription: "새로운 소식이 등록되면 이곳에서 확인할 수 있습니다.",
});

const TEXT_DEFAULTS: Record<CommunityEditorViewport, CommunityTextStyle> = Object.freeze({
  desktop: { size: 18, color: "#1f3329", background: null, font: "sans", align: "left", boxWidth: 100, boxOffsetX: 0, boxOffsetY: 0 },
  tablet: { size: 17, color: "#1f3329", background: null, font: "sans", align: "left", boxWidth: 100, boxOffsetX: 0, boxOffsetY: 0 },
  phone: { size: 16, color: "#1f3329", background: null, font: "sans", align: "left", boxWidth: 100, boxOffsetX: 0, boxOffsetY: 0 },
  phoneSmall: { size: 15, color: "#1f3329", background: null, font: "sans", align: "left", boxWidth: 100, boxOffsetX: 0, boxOffsetY: 0 },
});

const TITLE_SIZES: Record<CommunityEditorViewport, number> = Object.freeze({ desktop: 60, tablet: 48, phone: 36, phoneSmall: 31 });
const EYEBROW_SIZES: Record<CommunityEditorViewport, number> = Object.freeze({ desktop: 14, tablet: 13, phone: 12, phoneSmall: 11 });
const CTA_SIZES: Record<CommunityEditorViewport, number> = Object.freeze({ desktop: 17, tablet: 17, phone: 16, phoneSmall: 15 });

const LAYOUT_DEFAULTS: Record<CommunityEditorViewport, CommunityLayout> = Object.freeze({
  desktop: { contentWidth: 92, paddingTop: 72, paddingBottom: 64, infoColumns: 3, gap: 24 },
  tablet: { contentWidth: 92, paddingTop: 60, paddingBottom: 56, infoColumns: 3, gap: 18 },
  phone: { contentWidth: 92, paddingTop: 44, paddingBottom: 48, infoColumns: 1, gap: 12 },
  phoneSmall: { contentWidth: 92, paddingTop: 36, paddingBottom: 40, infoColumns: 1, gap: 10 },
});

function defaultTextStyles(): CommunityEditorSurface["textStyles"] {
  return Object.fromEntries(VIEWPORTS.map((viewport) => {
    const styles = Object.fromEntries(TEXT_TARGET_IDS.map((targetId) => {
      const base = clone(TEXT_DEFAULTS[viewport]);
      if (targetId === COMMUNITY_EDITOR_TARGET_IDS.title) {
        base.size = TITLE_SIZES[viewport];
        base.font = "serif";
      } else if (targetId === COMMUNITY_EDITOR_TARGET_IDS.eyebrow) {
        base.size = EYEBROW_SIZES[viewport];
      } else if (targetId === COMMUNITY_EDITOR_TARGET_IDS.primaryCta || targetId === COMMUNITY_EDITOR_TARGET_IDS.secondaryCta) {
        base.size = CTA_SIZES[viewport];
        base.align = "center";
        base.background = targetId === COMMUNITY_EDITOR_TARGET_IDS.primaryCta ? "#2f6b49" : "#ffffff";
        base.color = targetId === COMMUNITY_EDITOR_TARGET_IDS.primaryCta ? "#ffffff" : "#1f3329";
      } else if (targetId.endsWith(".label")) {
        base.size = Math.max(12, base.size - 3);
      } else if (targetId.endsWith(".value")) {
        base.size = Math.max(13, base.size - 2);
      }
      return [targetId, base];
    })) as Record<CommunityTextTargetId, CommunityTextStyle>;
    return [viewport, styles];
  })) as CommunityEditorSurface["textStyles"];
}

export function createDefaultCommunityEditorSurface(): CommunityEditorSurface {
  return {
    schemaVersion: COMMUNITY_EDITOR_SCHEMA_VERSION,
    surfaceId: COMMUNITY_EDITOR_SURFACE_ID,
    sectionId: COMMUNITY_EDITOR_SECTION_ID,
    fields: clone(FIELD_DEFAULTS),
    textStyles: defaultTextStyles(),
    layouts: clone(LAYOUT_DEFAULTS),
    appearance: { background: "#f7fbf8", accent: "#2c7158", text: "#173226", preset: "green", decoration: "dots" },
    background: {
      mode: "default",
      color: "#fbfefb",
      colorEnabled: false,
      imageName: null,
      imageDataUrl: null,
      naturalWidth: 0,
      naturalHeight: 0,
      opacity: 100,
      layouts: { desktop: null, tablet: null, phone: null, phoneSmall: null },
    },
    pageDecorations: { cards: [], decorations: [], nextDecorationId: 1 },
  };
}

function normalizeTextStyle(value: unknown, fallback: CommunityTextStyle): CommunityTextStyle {
  const source = isRecord(value) ? value : {};
  return {
    size: clamp(source.size, 8, 96, fallback.size),
    color: color(source.color, fallback.color),
    background: source.background === null ? null : nullableColor(source.background) ?? fallback.background,
    font: FONT_KEYS.has(String(source.font || "")) ? String(source.font) : fallback.font,
    align: ["left", "center", "right"].includes(String(source.align || ""))
      ? String(source.align) as CommunityTextStyle["align"]
      : fallback.align,
    boxWidth: clamp(source.boxWidth, 30, 100, fallback.boxWidth),
    boxOffsetX: clamp(source.boxOffsetX, -320, 320, fallback.boxOffsetX),
    boxOffsetY: clamp(source.boxOffsetY, -320, 320, fallback.boxOffsetY),
  };
}

function normalizeBackgroundLayout(value: unknown): CommunityBackgroundLayout | null {
  if (!isRecord(value)) return null;
  return {
    imageX: clamp(value.imageX, -400, 400, 0),
    imageY: clamp(value.imageY, -400, 400, 0),
    imageW: clamp(value.imageW, 1, 800, 100),
    imageH: clamp(value.imageH, 1, 800, 100),
    imageScale: clamp(value.imageScale, 0.1, 8, 1),
    cropX: clamp(value.cropX, 0, 100, 0),
    cropY: clamp(value.cropY, 0, 100, 0),
    cropW: clamp(value.cropW, 1, 100, 100),
    cropH: clamp(value.cropH, 1, 100, 100),
  };
}

function normalizeDecoration(value: unknown, index: number): CommunityDecoration {
  const source = isRecord(value) ? value : {};
  const layoutsSource = isRecord(source.layouts) ? source.layouts : {};
  const sizesSource = isRecord(source.sizes) ? source.sizes : {};
  const layouts = Object.fromEntries(VIEWPORTS.map((viewport) => {
    const raw = isRecord(layoutsSource[viewport]) ? layoutsSource[viewport] : {};
    return [viewport, { x: clamp(raw.x, 2, 98, 50), y: clamp(raw.y, 2, 4000, 50) }];
  })) as CommunityDecoration["layouts"];
  const sizes = Object.fromEntries(VIEWPORTS.map((viewport) => [
    viewport,
    clamp(sizesSource[viewport], 24, 220, 58),
  ])) as CommunityDecoration["sizes"];
  const rawId = text(source.id, `community-decoration-${index + 1}`, 100);
  const id = /^community-decoration-[a-z0-9-]+$/i.test(rawId) ? rawId : `community-decoration-${index + 1}`;
  return {
    id,
    icon: text(source.icon, "heart", 80),
    style: text(source.style, "plain", 80),
    color: nullableColor(source.color),
    layer: source.layer === "back" ? "back" : "front",
    layouts,
    sizes,
  };
}

/** Normalize only the visual allowlist; unknown keys and all board data are discarded. */
export function normalizeCommunityEditorSurface(value: unknown): CommunityEditorSurface {
  const defaults = createDefaultCommunityEditorSurface();
  const source = isRecord(value) ? value : {};
  const fieldSource = isRecord(source.fields) ? source.fields : {};
  const fields = Object.fromEntries(Object.entries(FIELD_DEFAULTS).map(([key, fallback]) => [
    key,
    text(fieldSource[key], fallback, key === "title" || key === "description" ? 500 : 160),
  ])) as CommunityEditorFields;

  const textStyleSource = isRecord(source.textStyles) ? source.textStyles : {};
  const textStyles = Object.fromEntries(VIEWPORTS.map((viewport) => {
    const viewportSource = isRecord(textStyleSource[viewport]) ? textStyleSource[viewport] : {};
    const styles = Object.fromEntries(TEXT_TARGET_IDS.map((targetId) => [
      targetId,
      normalizeTextStyle(viewportSource[targetId], defaults.textStyles[viewport][targetId]),
    ])) as Record<CommunityTextTargetId, CommunityTextStyle>;
    return [viewport, styles];
  })) as CommunityEditorSurface["textStyles"];

  const layoutSource = isRecord(source.layouts) ? source.layouts : {};
  const layouts = Object.fromEntries(VIEWPORTS.map((viewport) => {
    const raw = isRecord(layoutSource[viewport]) ? layoutSource[viewport] : {};
    const fallback = defaults.layouts[viewport];
    return [viewport, {
      contentWidth: clamp(raw.contentWidth, 60, 100, fallback.contentWidth),
      paddingTop: clamp(raw.paddingTop, 0, 240, fallback.paddingTop),
      paddingBottom: clamp(raw.paddingBottom, 0, 240, fallback.paddingBottom),
      infoColumns: integer(raw.infoColumns, 1, 3, fallback.infoColumns),
      gap: clamp(raw.gap, 0, 80, fallback.gap),
    }];
  })) as CommunityEditorSurface["layouts"];

  const appearanceSource = isRecord(source.appearance) ? source.appearance : {};
  const appearance: CommunitySectionAppearance = {
    background: color(appearanceSource.background, defaults.appearance.background),
    accent: color(appearanceSource.accent, defaults.appearance.accent),
    text: color(appearanceSource.text, defaults.appearance.text),
    preset: text(appearanceSource.preset, defaults.appearance.preset, 40),
    decoration: typeof appearanceSource.decoration === "string"
      ? appearanceSource.decoration.slice(0, 80)
      : null,
  };

  const backgroundSource = isRecord(source.background) ? source.background : {};
  const rawImageSource = typeof backgroundSource.imageDataUrl === "string" ? backgroundSource.imageDataUrl : "";
  const imageDataUrl = rawImageSource && SAFE_IMAGE_SOURCE.test(rawImageSource) ? rawImageSource : null;
  const rawMode = String(backgroundSource.mode || "");
  const mode: CommunityBackground["mode"] = rawMode === "image" && imageDataUrl
    ? "image"
    : rawMode === "color" ? "color" : "default";
  const backgroundLayoutSource = isRecord(backgroundSource.layouts) ? backgroundSource.layouts : {};
  const background: CommunityBackground = {
    mode,
    color: color(backgroundSource.color, defaults.background.color),
    colorEnabled: Boolean(backgroundSource.colorEnabled),
    imageName: imageDataUrl ? text(backgroundSource.imageName, "community-background", 180) : null,
    imageDataUrl,
    naturalWidth: integer(backgroundSource.naturalWidth, 0, 20000, 0),
    naturalHeight: integer(backgroundSource.naturalHeight, 0, 20000, 0),
    opacity: clamp(backgroundSource.opacity, 0, 100, 100),
    layouts: Object.fromEntries(VIEWPORTS.map((viewport) => [
      viewport,
      normalizeBackgroundLayout(backgroundLayoutSource[viewport]),
    ])) as CommunityBackground["layouts"],
  };

  const decorationSource = isRecord(source.pageDecorations) ? source.pageDecorations : {};
  const decorations = Array.isArray(decorationSource.decorations)
    ? decorationSource.decorations.slice(0, 24).map(normalizeDecoration)
    : [];
  const maximumId = decorations.reduce((maximum, item) => {
    const numericId = Number(item.id.match(/(\d+)$/)?.[1] || 0);
    return Math.max(maximum, numericId);
  }, 0);

  return {
    schemaVersion: COMMUNITY_EDITOR_SCHEMA_VERSION,
    surfaceId: COMMUNITY_EDITOR_SURFACE_ID,
    sectionId: COMMUNITY_EDITOR_SECTION_ID,
    fields,
    textStyles,
    layouts,
    appearance,
    background,
    pageDecorations: {
      cards: [],
      decorations,
      nextDecorationId: Math.max(1, integer(decorationSource.nextDecorationId, 1, 100000, 1), maximumId + 1),
    },
  };
}

export function isCommunityEditorTargetId(value: unknown): value is CommunityEditorTargetId {
  return typeof value === "string" && TARGET_ID_SET.has(value as CommunityEditorTargetId);
}

/** Read the visual contract from its canonical document location. */
export function readCommunityEditorSurface(documentValue: unknown): CommunityEditorSurface {
  const document = isRecord(documentValue) ? documentValue : {};
  const globals = isRecord(document.globals) ? document.globals : {};
  const surfaces = isRecord(globals.externalSurfaces) ? globals.externalSurfaces : {};
  return normalizeCommunityEditorSurface(surfaces[COMMUNITY_EDITOR_SURFACE_KEY]);
}

/** Preserve other globals and external surfaces while replacing community visual state. */
export function withCommunityEditorSurface(globalsValue: unknown, surfaceValue: unknown): JsonRecord {
  const globals = isRecord(globalsValue) ? globalsValue : {};
  const surfaces = isRecord(globals.externalSurfaces) ? globals.externalSurfaces : {};
  return {
    ...globals,
    externalSurfaces: {
      ...surfaces,
      [COMMUNITY_EDITOR_SURFACE_KEY]: normalizeCommunityEditorSurface(surfaceValue),
    },
  };
}

type CommunityMessageBase = {
  channel: typeof COMMUNITY_EDITOR_MESSAGE_CHANNEL;
  schemaVersion: typeof COMMUNITY_EDITOR_SCHEMA_VERSION;
  surfaceId: typeof COMMUNITY_EDITOR_SURFACE_ID;
  nonce: string;
};

export type CommunityEditorReadyMessage = CommunityMessageBase & { type: "ready" };
export type CommunityEditorSelectMessage = CommunityMessageBase & {
  type: "select";
  targetId: CommunityEditorTargetId;
  rect: CommunityEditorTargetRect;
};
export type CommunityEditorStateMessage = CommunityMessageBase & {
  type: "state";
  state: CommunityEditorSurface;
  revision: number;
};
export type CommunityEditorChangeMessage = CommunityMessageBase & {
  type: "change";
  state: CommunityEditorSurface;
  revision: number;
};
export type CommunityEditorApplyMessage = CommunityMessageBase & {
  type: "apply";
  state: CommunityEditorSurface;
  revision: number;
};
export type CommunityEditorTargetRect = { x: number; y: number; width: number; height: number };
export type CommunityEditorMessage = CommunityEditorReadyMessage
  | CommunityEditorSelectMessage
  | CommunityEditorStateMessage
  | CommunityEditorChangeMessage
  | CommunityEditorApplyMessage;

function hasOnlyKeys(value: JsonRecord, allowed: readonly string[]): boolean {
  const allowlist = new Set(allowed);
  return Object.keys(value).every((key) => allowlist.has(key));
}

function hasVisualOnlySurfaceShape(value: unknown): value is JsonRecord {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    "schemaVersion", "surfaceId", "sectionId", "fields", "textStyles", "layouts",
    "appearance", "background", "pageDecorations",
  ])) return false;
  if (!isRecord(value.fields) || !hasOnlyKeys(value.fields, Object.keys(FIELD_DEFAULTS))) return false;
  const fields = value.fields;
  return Object.values(FIELD_DEFAULTS).every((_, index) => {
    const key = Object.keys(FIELD_DEFAULTS)[index];
    return typeof fields[key] === "string";
  });
}

function hasMessageBase(value: unknown): value is JsonRecord & CommunityMessageBase {
  return isRecord(value)
    && value.channel === COMMUNITY_EDITOR_MESSAGE_CHANNEL
    && value.schemaVersion === COMMUNITY_EDITOR_SCHEMA_VERSION
    && value.surfaceId === COMMUNITY_EDITOR_SURFACE_ID
    && typeof value.nonce === "string"
    && /^[a-z0-9_-]{16,128}$/i.test(value.nonce);
}

function isTargetRect(value: unknown): value is CommunityEditorTargetRect {
  if (!isRecord(value) || !hasOnlyKeys(value, ["x", "y", "width", "height"])) return false;
  return [value.x, value.y, value.width, value.height].every((entry) => Number.isFinite(entry))
    && Number(value.width) >= 0
    && Number(value.height) >= 0;
}

function hasStatePayload(value: JsonRecord): boolean {
  return Number.isSafeInteger(value.revision)
    && Number(value.revision) >= 0
    && hasVisualOnlySurfaceShape(value.state);
}

export function isCommunityEditorReadyMessage(value: unknown): value is CommunityEditorReadyMessage {
  return hasMessageBase(value)
    && value.type === "ready"
    && hasOnlyKeys(value, ["channel", "schemaVersion", "surfaceId", "nonce", "type"]);
}

export function isCommunityEditorSelectMessage(value: unknown): value is CommunityEditorSelectMessage {
  return hasMessageBase(value)
    && value.type === "select"
    && isCommunityEditorTargetId(value.targetId)
    && isTargetRect(value.rect)
    && hasOnlyKeys(value, ["channel", "schemaVersion", "surfaceId", "nonce", "type", "targetId", "rect"]);
}

export function isCommunityEditorStateMessage(value: unknown): value is CommunityEditorStateMessage {
  return hasMessageBase(value)
    && value.type === "state"
    && hasStatePayload(value)
    && hasOnlyKeys(value, ["channel", "schemaVersion", "surfaceId", "nonce", "type", "state", "revision"]);
}

export function isCommunityEditorChangeMessage(value: unknown): value is CommunityEditorChangeMessage {
  return hasMessageBase(value)
    && value.type === "change"
    && hasStatePayload(value)
    && hasOnlyKeys(value, ["channel", "schemaVersion", "surfaceId", "nonce", "type", "state", "revision"]);
}

export function isCommunityEditorApplyMessage(value: unknown): value is CommunityEditorApplyMessage {
  return hasMessageBase(value)
    && value.type === "apply"
    && hasStatePayload(value)
    && hasOnlyKeys(value, ["channel", "schemaVersion", "surfaceId", "nonce", "type", "state", "revision"]);
}

export function isCommunityEditorMessage(value: unknown): value is CommunityEditorMessage {
  return isCommunityEditorReadyMessage(value)
    || isCommunityEditorSelectMessage(value)
    || isCommunityEditorStateMessage(value)
    || isCommunityEditorChangeMessage(value)
    || isCommunityEditorApplyMessage(value);
}

export function createCommunityEditorReadyMessage(nonce: string): CommunityEditorReadyMessage {
  return {
    channel: COMMUNITY_EDITOR_MESSAGE_CHANNEL,
    schemaVersion: COMMUNITY_EDITOR_SCHEMA_VERSION,
    surfaceId: COMMUNITY_EDITOR_SURFACE_ID,
    nonce,
    type: "ready",
  };
}

export function createCommunityEditorSelectMessage(
  nonce: string,
  targetId: CommunityEditorTargetId,
  rect: CommunityEditorTargetRect,
): CommunityEditorSelectMessage {
  return {
    channel: COMMUNITY_EDITOR_MESSAGE_CHANNEL,
    schemaVersion: COMMUNITY_EDITOR_SCHEMA_VERSION,
    surfaceId: COMMUNITY_EDITOR_SURFACE_ID,
    nonce,
    type: "select",
    targetId,
    rect: { x: Number(rect.x), y: Number(rect.y), width: Number(rect.width), height: Number(rect.height) },
  };
}

function createStatePayload(
  nonce: string,
  type: "state" | "change" | "apply",
  state: unknown,
  revision: number,
): CommunityEditorStateMessage | CommunityEditorChangeMessage | CommunityEditorApplyMessage {
  return {
    channel: COMMUNITY_EDITOR_MESSAGE_CHANNEL,
    schemaVersion: COMMUNITY_EDITOR_SCHEMA_VERSION,
    surfaceId: COMMUNITY_EDITOR_SURFACE_ID,
    nonce,
    type,
    state: normalizeCommunityEditorSurface(state),
    revision: Math.max(0, Math.floor(Number.isFinite(Number(revision)) ? Number(revision) : 0)),
  };
}

export function createCommunityEditorStateMessage(nonce: string, state: unknown, revision = 0): CommunityEditorStateMessage {
  return createStatePayload(nonce, "state", state, revision) as CommunityEditorStateMessage;
}

export function createCommunityEditorChangeMessage(nonce: string, state: unknown, revision = 0): CommunityEditorChangeMessage {
  return createStatePayload(nonce, "change", state, revision) as CommunityEditorChangeMessage;
}

export function createCommunityEditorApplyMessage(nonce: string, state: unknown, revision = 0): CommunityEditorApplyMessage {
  return createStatePayload(nonce, "apply", state, revision) as CommunityEditorApplyMessage;
}

// Keep a named default for fixtures and adapters; always clone before mutation.
export const DEFAULT_COMMUNITY_EDITOR_SURFACE = Object.freeze(createDefaultCommunityEditorSurface());
