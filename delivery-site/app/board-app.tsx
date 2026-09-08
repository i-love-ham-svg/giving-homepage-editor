"use client";

import Link from "next/link";
import Image from "next/image";
import { CSSProperties, FormEvent, KeyboardEvent, SyntheticEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { BoardMedia, BoardPost, Category, PostStatus } from "../lib/board-types";
import { CATEGORIES } from "../lib/board-types";
import {
  COMMUNITY_EDITOR_TARGET_IDS,
  createCommunityEditorChangeMessage,
  createCommunityEditorReadyMessage,
  createCommunityEditorSelectMessage,
  createDefaultCommunityEditorSurface,
  isCommunityEditorApplyMessage,
  isCommunityEditorStateMessage,
  normalizeCommunityEditorSurface,
  readCommunityEditorSurface,
  type CommunityEditorFields,
  type CommunityDecoration,
  type CommunityEditorSurface,
  type CommunityEditorTargetId,
  type CommunityTextTargetId,
} from "../lib/community-editor-contract";
import { HomepageBreadcrumb, HomepageNavigation, type SharedNavigation } from "./homepage-navigation";

type ListResult = { items: BoardPost[]; total: number; page: number; pageSize: number; totalPages: number; admin: boolean };
type Draft = {
  category: Category;
  author: string;
  contact: string;
  title: string;
  body: string;
  password: string;
  website: string;
  pinned: boolean;
};

type PersistedBoardDraft = Pick<Draft, "category" | "title" | "body" | "pinned">;

const emptyDraft: Draft = {
  category: "resident",
  author: "",
  contact: "",
  title: "",
  body: "",
  password: "",
  website: "",
  pinned: false,
};

const statusLabels: Record<PostStatus, string> = {
  pending: "승인 대기",
  published: "공개",
  rejected: "반려",
  hidden: "숨김",
  deleted: "삭제",
};

const communityFieldByTarget: Record<CommunityTextTargetId, keyof CommunityEditorFields> = {
  [COMMUNITY_EDITOR_TARGET_IDS.eyebrow]: "eyebrow",
  [COMMUNITY_EDITOR_TARGET_IDS.title]: "title",
  [COMMUNITY_EDITOR_TARGET_IDS.description]: "description",
  [COMMUNITY_EDITOR_TARGET_IDS.primaryCta]: "primaryCta",
  [COMMUNITY_EDITOR_TARGET_IDS.secondaryCta]: "secondaryCta",
  [COMMUNITY_EDITOR_TARGET_IDS.publicLabel]: "publicLabel",
  [COMMUNITY_EDITOR_TARGET_IDS.publicValue]: "publicValue",
  [COMMUNITY_EDITOR_TARGET_IDS.privacyLabel]: "privacyLabel",
  [COMMUNITY_EDITOR_TARGET_IDS.privacyValue]: "privacyValue",
  [COMMUNITY_EDITOR_TARGET_IDS.processLabel]: "processLabel",
  [COMMUNITY_EDITOR_TARGET_IDS.processValue]: "processValue",
  [COMMUNITY_EDITOR_TARGET_IDS.listEyebrow]: "listEyebrow",
  [COMMUNITY_EDITOR_TARGET_IDS.listTitle]: "listTitle",
  [COMMUNITY_EDITOR_TARGET_IDS.emptyTitle]: "emptyTitle",
  [COMMUNITY_EDITOR_TARGET_IDS.emptyDescription]: "emptyDescription",
};

type CommunityVisualCss = CSSProperties
  & Record<`--community-${string}`, string | number>
  & Partial<Record<"--green" | "--green-dark" | "--ink" | "--muted" | "--line", string>>;
type CommunityCaretSnapshot = { targetId: CommunityTextTargetId; offset: number };

function readCommunityCaretOffset(element: HTMLElement): number | null {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return null;
  const range = selection.getRangeAt(0);
  if (!element.contains(range.endContainer)) return null;
  const prefix = range.cloneRange();
  prefix.selectNodeContents(element);
  try {
    prefix.setEnd(range.endContainer, range.endOffset);
  } catch {
    return null;
  }
  return prefix.toString().length;
}

function restoreCommunityCaretOffset(element: HTMLElement, offset: number) {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let remaining = Math.max(0, offset);
  let node = walker.nextNode();
  while (node) {
    const length = node.textContent?.length || 0;
    if (remaining <= length) {
      range.setStart(node, remaining);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    remaining -= length;
    node = walker.nextNode();
  }
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function communityBackgroundGeometry(surface: CommunityEditorSurface): CommunityVisualCss {
  const style: CommunityVisualCss = {};
  const viewports = ["desktop", "tablet", "phone", "phoneSmall"] as const;
  for (const viewport of viewports) {
    const layout = surface.background.layouts[viewport];
    const suffix = viewport === "phoneSmall" ? "phone-small" : viewport;
    const cropX = layout?.cropX ?? 0;
    const cropY = layout?.cropY ?? 0;
    const cropW = layout?.cropW ?? 100;
    const cropH = layout?.cropH ?? 100;
    const imageX = layout?.imageX ?? 0;
    const imageY = layout?.imageY ?? 0;
    // imageW/imageH already contain the persisted editor scale. Applying
    // imageScale again would enlarge older snapshots twice and move the crop.
    const imageW = layout?.imageW ?? 100;
    const imageH = layout?.imageH ?? 100;
    style[`--community-background-crop-x-${suffix}`] = `${cropX}%`;
    style[`--community-background-crop-y-${suffix}`] = `${cropY}%`;
    style[`--community-background-crop-w-${suffix}`] = `${cropW}%`;
    style[`--community-background-crop-h-${suffix}`] = `${cropH}%`;
    style[`--community-background-image-x-${suffix}`] = `${(imageX - cropX) / cropW * 100}%`;
    style[`--community-background-image-y-${suffix}`] = `${(imageY - cropY) / cropH * 100}%`;
    style[`--community-background-image-w-${suffix}`] = `${imageW / cropW * 100}%`;
    style[`--community-background-image-h-${suffix}`] = `${imageH / cropH * 100}%`;
    style[`--community-background-image-fit-${suffix}`] = layout ? "100% 100%" : "cover";
  }
  return style;
}

function CommunityBackgroundLayer({ surface }: { surface: CommunityEditorSurface }) {
  const hasImage = surface.background.mode === "image" && Boolean(surface.background.imageDataUrl);
  return (
    <div className="community-page-background-layer" aria-hidden="true">
      <span className="community-page-background-fill">
        {hasImage && <span className="community-page-background-image" />}
      </span>
    </div>
  );
}

const communityDecorationStyles = new Set([
  "plain", "soft-circle", "solid-circle", "ring", "double-ring", "soft-square",
  "solid-square", "diamond", "capsule", "spotlight", "underline", "badge",
]);

function communityDecorationAsset(icon: string): { image?: string; mask?: string } | null {
  if (/^sticker-imported-\d{2}-\d{2}$/i.test(icon)) {
    return { image: `/songak/assets/stickers/web/${icon}.webp` };
  }
  const localSticker = icon.match(/^sticker-(nature|earth|daily)-([a-z0-9-]+)$/i);
  if (!localSticker) return null;
  return { mask: `/songak/assets/${localSticker[1].toLowerCase()}-stickers/${localSticker[1].toLowerCase()}-${localSticker[2].toLowerCase()}.png` };
}

function CommunityDecorationIcon({ icon }: { icon: string }) {
  const asset = communityDecorationAsset(icon);
  if (asset?.image) {
    return <span className="community-decoration-raster" style={{ backgroundImage: `url("${asset.image}")` }} />;
  }
  if (asset?.mask) {
    return <span className="community-decoration-mask" style={{ WebkitMaskImage: `url("${asset.mask}")`, maskImage: `url("${asset.mask}")` }} />;
  }

  const paths = (() => {
    switch (icon) {
      case "clipboard-edit": return <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V2h6v2M8 9h6M8 13h4M14.5 17.5l4-4 2 2-4 4-3 .8z" /></>;
      case "users-chat": return <><circle cx="8" cy="9" r="3" /><circle cx="17" cy="9" r="3" /><path d="M2.5 20c.4-4 2.2-6 5.5-6s5.1 2 5.5 6M12.5 20c.3-3.2 1.8-5 4.5-5s4.2 1.8 4.5 5M10 3h7l3 3-3 3h-2" /></>;
      case "user-search": return <><circle cx="10" cy="9" r="4" /><path d="M3 20c.5-4.3 2.8-6.5 7-6.5 2 0 3.6.5 4.8 1.5M16 16l5 5M17.5 17.5a4 4 0 1 0-5.7-5.7" /></>;
      case "clipboard-check": return <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V2h6v2M8 9l1.5 1.5L12 8M8 14l1.5 1.5L12 13M14 9h2M14 14h2" /></>;
      case "handshake": return <path d="M3 12l4-4 4 2 2-2 4 2 4 4-4 5-3-1-2 2-2-2-2 1-5-5zM7 8l2-3 4 2 2-2 4 3-2 2M9 13l4 4M12 11l4 4" />;
      case "report-check": return <><rect x="4" y="3" width="14" height="18" rx="2" /><path d="M8 3V1h6v2M8 16v-3M11 16V9M14 16v-5M16 19l2 2 4-5" /></>;
      case "clipboard": return <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V2h6v2M8 9h8M8 13h8M8 17h5" /></>;
      case "network": return <><circle cx="12" cy="5" r="3" /><circle cx="5" cy="18" r="3" /><circle cx="19" cy="18" r="3" /><path d="M10 7.5L6.5 15M14 7.5l3.5 7.5M8 18h8" /></>;
      case "calendar": return <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" /></>;
      case "clock": return <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>;
      case "medical": return <><circle cx="12" cy="12" r="9" /><path d="M9 7h6v3h3v5h-3v3H9v-3H6v-5h3z" /></>;
      case "phone": return <path d="M5 3h4l2 5-3 2a16 16 0 0 0 6 6l2-3 5 2v4c0 1.1-.9 2-2 2C10.2 21 3 13.8 3 5a2 2 0 0 1 2-2z" />;
      case "mail": return <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>;
      case "map-pin": return <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0z" /><circle cx="12" cy="10" r="3" /></>;
      case "file-text": return <path d="M6 2h8l4 4v16H6zM14 2v5h5M9 12h6M9 16h6" />;
      case "check-circle": return <><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 6-7" /></>;
      case "lightbulb": return <path d="M9 18h6M10 22h4M8.5 15.5A7 7 0 1 1 15.5 15.5c-.9.7-1.5 1.4-1.5 2.5h-4c0-1.1-.6-1.8-1.5-2.5z" />;
      case "shield": return <><path d="M12 2l8 3v6c0 5.2-3.4 9-8 11-4.6-2-8-5.8-8-11V5z" /><path d="M9 12l2 2 4-5" /></>;
      case "recurring": return <><path d="M7 3v3M17 3v3M4 9h16M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" /><path d="M12 18s-4-2.3-4-5a2.2 2.2 0 0 1 4-1.3A2.2 2.2 0 0 1 16 13c0 2.7-4 5-4 5z" /></>;
      case "handHeart": return <><path d="M12 9.5s-4.8-2.7-4.8-5.8A2.7 2.7 0 0 1 12 2a2.7 2.7 0 0 1 4.8 1.7C16.8 6.8 12 9.5 12 9.5z" /><path d="M3 14h4l3 2h4.5a1.5 1.5 0 0 1 0 3H9M3 13v7h4l4 2 9-5a1.6 1.6 0 0 0-1.6-2.8L14 16" /></>;
      case "boxHeart": return <><path d="M3 8l9-5 9 5-9 5zM3 8v9l9 5 9-5V8M12 13v9" /><path d="M12 10s-3-1.7-3-3.6A1.7 1.7 0 0 1 12 5.3a1.7 1.7 0 0 1 3 1.1C15 8.3 12 10 12 10z" /></>;
      case "bank": return <path d="M3 10h18M5 10v9M9 10v9M15 10v9M19 10v9M2 21h20M12 3l9 5H3z" />;
      case "award": return <><circle cx="12" cy="8" r="5" /><path d="M8.5 12L7 22l5-3 5 3-1.5-10M10 8l1.3 1.3L14 6.5" /></>;
      case "star": return <path d="m12 2.7 2.8 5.7 6.3.9-4.5 4.4 1.1 6.2-5.7-3-5.7 3 1.1-6.2-4.5-4.4 6.3-.9L12 2.7z" />;
      case "sprout": return <><path d="M12 21V10" /><path d="M12 13c-5 0-8-3-8-8 5 0 8 3 8 8zm0-3c0-4 3-7 8-7 0 5-3 8-8 8" /></>;
      case "leaf-branch": return <><path d="M4 21C8 15 12 10 20 4" /><path d="M8 16c-3 .2-5-1.4-5-4.4 3-.2 5 1.4 5 4.4zm3.8-4.2c-2.6-1.2-3.5-3.7-2.1-6.2 2.7 1.2 3.5 3.7 2.1 6.2zm3.5-3.6c.2-3 2-4.8 5-4.8-.2 3-2 4.8-5 4.8z" /></>;
      case "paper-plane": return <path d="M2.5 11.2 21.5 3l-7.2 18-3.7-7-8.1-2.8zM10.6 14 21.5 3" />;
      case "flower": return <><path d="M12 21V10M12 15 7 10M12 13l5-5M8 11l-3 3M16 9l3 3" /><circle cx="12" cy="7" r="2.2" /><circle cx="6.5" cy="8.5" r="1.8" /><circle cx="18" cy="6.5" r="1.8" /></>;
      case "forsythia": return <><path d="M3 21c5-6 9-10 18-17M8 16l-3-5M11 13l4 1M14 10l-1-5M17 7l4 1" /><path d="m4 10 2-1 2 1-2 2zm10 3 2-1 2 1-2 2zM12 4l2-1 2 1-2 2zm8 3 2-1 1 2-2 1z" /></>;
      case "gift": return <><rect x="3" y="8" width="18" height="13" rx="2" /><path d="M12 8v13M3 12h18M12 8H7.5a2.5 2.5 0 1 1 0-5C10.5 3 12 8 12 8zm0 0h4.5a2.5 2.5 0 1 0 0-5C13.5 3 12 8 12 8z" /></>;
      case "megaphone": return <path d="M3 11v4h4l9 4V7l-9 4H3zM7 15l2 6h3l-2-5M19 9l2-2M19 17l2 2M20 13h3" />;
      case "book":
      case "book-open": return <path d="M3 5.5A5.5 5.5 0 0 1 8.5 5H12v15H8.5A5.5 5.5 0 0 0 3 20.5zM21 5.5A5.5 5.5 0 0 0 15.5 5H12v15h3.5a5.5 5.5 0 0 1 5.5.5z" />;
      case "message": return <><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9h8M8 12h5" /></>;
      case "users": return <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 20c.4-4.2 2.4-6.3 6-6.3s5.6 2.1 6 6.3M14 15c3.8-.5 6 1.2 7 5" /></>;
      case "building": return <path d="M4 22V4h11v18M15 9h5v13M8 8h3M8 12h3M8 16h3M18 13h.01M18 17h.01M2 22h20" />;
      case "home": return <path d="M3 11l9-8 9 8v10h-6v-6H9v6H3zM9 11h6" />;
      default: return <path d="M20.8 5.8a5.5 5.5 0 0 0-7.8 0L12 6.9l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.4a5.5 5.5 0 0 0 0-7.8z" />;
    }
  })();
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">{paths}</svg>;
}

function communityDecorationStyle(decoration: CommunityDecoration, accent: string): CommunityVisualCss {
  return {
    "--community-decoration-x-desktop": `${decoration.layouts.desktop.x}%`,
    "--community-decoration-y-desktop": `${decoration.layouts.desktop.y}px`,
    "--community-decoration-size-desktop": `${decoration.sizes.desktop}px`,
    "--community-decoration-x-tablet": `${decoration.layouts.tablet.x}%`,
    "--community-decoration-y-tablet": `${decoration.layouts.tablet.y}px`,
    "--community-decoration-size-tablet": `${decoration.sizes.tablet}px`,
    "--community-decoration-x-phone": `${decoration.layouts.phone.x}%`,
    "--community-decoration-y-phone": `${decoration.layouts.phone.y}px`,
    "--community-decoration-size-phone": `${decoration.sizes.phone}px`,
    "--community-decoration-x-phone-small": `${decoration.layouts.phoneSmall.x}%`,
    "--community-decoration-y-phone-small": `${decoration.layouts.phoneSmall.y}px`,
    "--community-decoration-size-phone-small": `${decoration.sizes.phoneSmall}px`,
    "--community-decoration-color": decoration.color || accent,
  };
}

function CommunityDecorationLayer({ layer, decorations, accent }: { layer: CommunityDecoration["layer"]; decorations: CommunityDecoration[]; accent: string }) {
  const items = decorations.filter((decoration) => decoration.layer === layer);
  if (!items.length) return null;
  return (
    <div className={`community-decoration-layer community-decoration-layer--${layer}`} data-community-decoration-layer={layer} aria-hidden="true">
      {items.map((decoration) => {
        const style = communityDecorationStyles.has(decoration.style) ? decoration.style : "plain";
        return (
          <span
            className={`community-decoration community-decoration--${style}`}
            data-community-decoration-id={decoration.id}
            data-community-decoration-icon={decoration.icon}
            data-community-decoration-style={style}
            key={decoration.id}
            style={communityDecorationStyle(decoration, accent)}
          >
            <CommunityDecorationIcon icon={decoration.icon} />
          </span>
        );
      })}
    </div>
  );
}

function communityFontFamily(font: string): string {
  if (font === "serif") return '"Noto Serif KR", Batang, serif';
  if (["koreanBrush", "koreanKcc", "koreanNanumBrush", "koreanLoveLetter"].includes(font)) return 'Hahmlet, "Noto Serif KR", Batang, serif';
  if (["englishScript", "englishSignature"].includes(font)) return 'cursive';
  return 'Pretendard, "Noto Sans KR", "Malgun Gothic", system-ui, sans-serif';
}

function communityTargetStyle(surface: CommunityEditorSurface, targetId: CommunityTextTargetId): CommunityVisualCss {
  const desktop = surface.textStyles.desktop[targetId];
  const tablet = surface.textStyles.tablet[targetId];
  const phone = surface.textStyles.phone[targetId];
  const phoneSmall = surface.textStyles.phoneSmall[targetId];
  const isCta = targetId === COMMUNITY_EDITOR_TARGET_IDS.primaryCta || targetId === COMMUNITY_EDITOR_TARGET_IDS.secondaryCta;
  // Legacy CTA models used 100 as an ignored text-box default. Preserve their
  // compact public geometry until a staff member chooses a custom width.
  const targetWidth = (value: number) => isCta && value >= 100 ? "auto" : `${value}%`;
  return {
    "--community-editor-size-desktop": `${desktop.size}px`,
    "--community-editor-size-tablet": `${tablet.size}px`,
    "--community-editor-size-phone": `${phone.size}px`,
    "--community-editor-size-phone-small": `${phoneSmall.size}px`,
    "--community-editor-color-desktop": desktop.color,
    "--community-editor-color-tablet": tablet.color,
    "--community-editor-color-phone": phone.color,
    "--community-editor-color-phone-small": phoneSmall.color,
    "--community-editor-background-desktop": desktop.background || "transparent",
    "--community-editor-background-tablet": tablet.background || "transparent",
    "--community-editor-background-phone": phone.background || "transparent",
    "--community-editor-background-phone-small": phoneSmall.background || "transparent",
    "--community-editor-font-desktop": communityFontFamily(desktop.font),
    "--community-editor-font-tablet": communityFontFamily(tablet.font),
    "--community-editor-font-phone": communityFontFamily(phone.font),
    "--community-editor-font-phone-small": communityFontFamily(phoneSmall.font),
    "--community-editor-align-desktop": desktop.align,
    "--community-editor-align-tablet": tablet.align,
    "--community-editor-align-phone": phone.align,
    "--community-editor-align-phone-small": phoneSmall.align,
    "--community-editor-width-desktop": targetWidth(desktop.boxWidth),
    "--community-editor-width-tablet": targetWidth(tablet.boxWidth),
    "--community-editor-width-phone": targetWidth(phone.boxWidth),
    "--community-editor-width-phone-small": targetWidth(phoneSmall.boxWidth),
    "--community-editor-offset-x-desktop": `${desktop.boxOffsetX}px`,
    "--community-editor-offset-x-tablet": `${tablet.boxOffsetX}px`,
    "--community-editor-offset-x-phone": `${phone.boxOffsetX}px`,
    "--community-editor-offset-x-phone-small": `${phoneSmall.boxOffsetX}px`,
    "--community-editor-offset-y-desktop": `${desktop.boxOffsetY}px`,
    "--community-editor-offset-y-tablet": `${tablet.boxOffsetY}px`,
    "--community-editor-offset-y-phone": `${phone.boxOffsetY}px`,
    "--community-editor-offset-y-phone-small": `${phoneSmall.boxOffsetY}px`,
  };
}

const publicNavigation: SharedNavigation = {
  layoutMode: "selected-dropdown",
  brand: "송악사회복지관",
  brandMode: "text",
  logoDataUrl: null,
  logoShape: "horizontal",
  brandPosition: "left",
  brandIndex: 0,
  align: "center",
  fontSize: 14,
  brandFontSize: 18,
  items: [
  {
    id: "home-menu-intro",
    label: "복지관 소개",
    href: "/about",
    children: [
      { id: "home-menu-intro-main", label: "대표자 인사말", href: "/about", children: [] },
      { id: "home-menu-intro-mission", label: "미션·비전·슬로건", href: "/about/mission", children: [] },
      { id: "home-menu-intro-corporate", label: "운영법인 소개", href: "/about/corporate", children: [] },
      { id: "home-menu-intro-history", label: "연혁", href: "/about/history", children: [] },
      { id: "home-menu-intro-location", label: "찾아오시는 길", href: "/directions", children: [] },
      { id: "home-menu-intro-facility", label: "시설현황", href: "/about/facility", children: [] },
      { id: "home-menu-intro-organization", label: "조직도·직원 안내", href: "/about/organization", children: [] },
    ],
  },
  {
    id: "home-menu-business",
    label: "사업 안내",
    href: "/programs",
    children: [
      { id: "home-menu-business-program", label: "프로그램 안내", href: "/programs", children: [] },
      { id: "home-menu-business-schedule", label: "프로그램 일정표", href: "/programs/schedule", children: [] },
      { id: "home-menu-business-schedule-original", label: "인쇄용 프로그램 시간표", href: "/programs/schedule-original", children: [] },
      { id: "home-menu-business-process", label: "사례관리 이용 절차", href: "/programs/case-management", children: [] },
      { id: "home-menu-business-application", label: "온라인 신청·문의", href: "/programs/application", children: [] },
    ],
  },
  {
    id: "home-menu-participation",
    label: "참여마당",
    href: "/participation",
    children: [
      { id: "home-menu-participation-volunteer", label: "자원봉사 안내", href: "/participation/volunteer", children: [] },
      { id: "home-menu-participation-donation", label: "후원 안내", href: "/participation/donation", children: [] },
    ],
  },
  {
    id: "home-menu-news",
    label: "알림마당",
    href: "/news",
    children: [
      { id: "home-menu-news-notice", label: "공지·소식", href: "/news/notices", children: [] },
      { id: "home-menu-news-press", label: "언론보도", href: "/news/press", children: [] },
      { id: "home-menu-news-video", label: "영상 아카이브", href: "/news/videos", children: [] },
      { id: "home-menu-news-gallery", label: "갤러리", href: "/news/gallery", children: [] },
      { id: "home-menu-news-board", label: "소통게시판", href: "/community", children: [] },
    ],
  },
  { id: "home-menu-account", label: "로그인·회원가입", href: "/", children: [] },
]};

async function requestJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin", ...init });
  const data = await response.json().catch(() => ({ error: "응답을 확인할 수 없습니다." })) as { error?: string };
  if (!response.ok) throw new Error(data.error || "요청을 처리하지 못했습니다.");
  return data as T;
}

function formatDate(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function categoryLabel(id: Category): string {
  return CATEGORIES.find((entry) => entry.id === id)?.label || "게시글";
}

function mediaUrl(media: BoardMedia): string {
  if (media.claimToken) return `${media.url}?claim=${encodeURIComponent(media.claimToken)}`;
  return media.url;
}

function DialogHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="dialog-head">
      <h2>{title}</h2>
      <button className="icon-btn" type="button" onClick={onClose} aria-label="닫기">×</button>
    </div>
  );
}

function PostThumbnail({ post }: { post: BoardPost }) {
  const selected = post.media.find((item) => item.id === post.thumbnailMediaId) || post.media[0];
  if (selected?.kind === "image") {
    return <div className="thumbnail"><Image src={mediaUrl(selected)} alt={selected.alt || ""} fill sizes="(max-width: 720px) 100vw, 33vw" unoptimized /></div>;
  }
  return (
    <div className={`thumbnail thumbnail-${post.category}`} aria-hidden="true">
      <span className="thumbnail-letter">{post.category === "notice" ? "알" : post.category === "question" ? "문" : "송"}</span>
      {selected?.kind === "video" && <span className="video-badge">▶ 영상</span>}
    </div>
  );
}

export function BoardApp() {
  const [sharedNavigation, setSharedNavigation] = useState<SharedNavigation | null>(null);
  const [communitySurface, setCommunitySurface] = useState<CommunityEditorSurface>(() => createDefaultCommunityEditorSurface());
  const [communityRevision, setCommunityRevision] = useState(0);
  const [communityEditor, setCommunityEditor] = useState<{ active: boolean; nonce: string }>({ active: false, nonce: "" });
  const [selectedCommunityTarget, setSelectedCommunityTarget] = useState<CommunityEditorTargetId | null>(null);
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sort, setSort] = useState("latest");
  const [view, setView] = useState("card");
  const [status, setStatus] = useState("pending");
  const [admin, setAdmin] = useState(false);
  const [adminSignInPath, setAdminSignInPath] = useState("/staff-login?returnTo=%2Fcommunity%3Fmanage%3D1");
  const [loading, setLoading] = useState(true);
  const [activePost, setActivePost] = useState<BoardPost | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [draftMedia, setDraftMedia] = useState<BoardMedia[]>([]);
  const [discardedDraftMedia, setDiscardedDraftMedia] = useState<BoardMedia[]>([]);
  const [thumbnailMediaId, setThumbnailMediaId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState("");
  const [moderationNote, setModerationNote] = useState("");
  const [reportReason, setReportReason] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [claimPostId, setClaimPostId] = useState("");
  const [claimPassword, setClaimPassword] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [claimedModerationNote, setClaimedModerationNote] = useState("");

  const writeDialog = useRef<HTMLDialogElement>(null);
  const detailDialog = useRef<HTMLDialogElement>(null);
  const adminDialog = useRef<HTMLDialogElement>(null);
  const reportDialog = useRef<HTMLDialogElement>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const claimDialog = useRef<HTMLDialogElement>(null);
  const returnToDetailAfterWriteRef = useRef(false);
  const returnToDetailAfterPostActionRef = useRef(false);
  const communitySurfaceRef = useRef(communitySurface);
  const communityRevisionRef = useRef(communityRevision);
  const communityCaretRef = useRef<CommunityCaretSnapshot | null>(null);
  const communityEditorHydrationLockedRef = useRef(false);

  useEffect(() => { communitySurfaceRef.current = communitySurface; }, [communitySurface]);
  useEffect(() => { communityRevisionRef.current = communityRevision; }, [communityRevision]);
  // An input must update canonical React state. Restore the logical caret after
  // React commits so controlled text never makes the user's cursor jump.
  useLayoutEffect(() => {
    const caret = communityCaretRef.current;
    if (!caret || document.activeElement?.getAttribute("data-editor-target-id") !== caret.targetId) return;
    const selected = document.querySelector<HTMLElement>(`[data-editor-target-id="${caret.targetId}"]`);
    if (selected) restoreCommunityCaretOffset(selected, caret.offset);
    communityCaretRef.current = null;
  }, [communitySurface]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  }, []);

  // Keep one application dialog in the top layer at a time. Detail actions
  // temporarily close the detail dialog and restore it after cancel/finish,
  // rather than stacking a second modal over it.
  function openExclusiveDialog(next: HTMLDialogElement | null) {
    if (!next) return;
    for (const dialog of [writeDialog.current, detailDialog.current, adminDialog.current, reportDialog.current, deleteDialog.current, claimDialog.current]) {
      if (dialog && dialog !== next && dialog.open) dialog.close();
    }
    if (!next.open) next.showModal();
  }

  function cancelWrite() {
    if (writeDialog.current?.open) writeDialog.current.close();
    const shouldRestoreDetail = returnToDetailAfterWriteRef.current;
    returnToDetailAfterWriteRef.current = false;
    if (shouldRestoreDetail && activePost) openExclusiveDialog(detailDialog.current);
  }

  function openPostActionDialog(next: HTMLDialogElement | null) {
    returnToDetailAfterPostActionRef.current = Boolean(detailDialog.current?.open && activePost);
    openExclusiveDialog(next);
  }

  function closePostActionDialog(current: HTMLDialogElement | null, restoreDetail = true) {
    if (current?.open) current.close();
    const shouldRestoreDetail = returnToDetailAfterPostActionRef.current;
    returnToDetailAfterPostActionRef.current = false;
    if (restoreDetail && shouldRestoreDetail && activePost) openExclusiveDialog(detailDialog.current);
  }

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "9",
        category,
        search,
        sort,
        status: admin && !communityEditor.active ? status : "published",
      });
      const result = await requestJson<ListResult>(`/api/board/posts?${params}`);
      setPosts(result.items);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "게시글을 불러오지 못했습니다.");
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [admin, category, communityEditor.active, page, search, sort, status, showToast]);

  useEffect(() => {
    requestJson<SharedNavigation>("/api/site-navigation")
      .then((result) => {
        setSharedNavigation({ ...publicNavigation, ...result, items: result.items?.length ? result.items : publicNavigation.items });
      })
      .catch(() => setSharedNavigation(publicNavigation));
  }, []);

  useEffect(() => {
    let cancelled = false;
    requestJson<{ content?: unknown; revision?: number }>("/api/site-content/songak-homepage?scope=home-menu-news-board")
      .then((result) => {
        // The parent editor owns the canonical draft once the embed is active.
        // A slower published response must never replace that newer draft.
        if (cancelled || communityEditorHydrationLockedRef.current || !result.content) return;
        const next = readCommunityEditorSurface(result.content);
        setCommunitySurface(next);
        setCommunityRevision(Math.max(0, Number(result.revision) || 0));
      })
      .catch(() => { /* Published visual state is optional; keep the checked-in defaults. */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    requestJson<{ admin: boolean; signInPath: string }>("/api/board/admin/session")
      .then((result) => {
        setAdmin(result.admin);
        setAdminSignInPath(result.signInPath);
        const params = new URLSearchParams(window.location.search);
        const nonce = params.get("editorNonce") || "";
        const requestedEditorEmbed = params.get("editorEmbed") === "1" && window.parent !== window && /^[a-z0-9_-]{16,128}$/i.test(nonce);
        if (result.admin && requestedEditorEmbed) {
          communityEditorHydrationLockedRef.current = true;
          setCommunityEditor({ active: true, nonce });
          window.parent.postMessage(createCommunityEditorReadyMessage(nonce), window.location.origin);
        }
        if (!result.admin && params.get("manage") === "1") {
          window.setTimeout(() => {
            openExclusiveDialog(adminDialog.current);
          }, 0);
        }
      })
      .catch(() => setAdmin(false));
  }, []);


  useEffect(() => {
    if (!communityEditor.active) return;
    const receiveEditorState = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      if (isCommunityEditorStateMessage(event.data) || isCommunityEditorApplyMessage(event.data)) {
        if (event.data.nonce !== communityEditor.nonce) return;
        communityEditorHydrationLockedRef.current = true;
        const next = normalizeCommunityEditorSurface(event.data.state);
        setCommunitySurface(next);
        setCommunityRevision(event.data.revision);
      }
    };
    window.addEventListener("message", receiveEditorState);
    return () => window.removeEventListener("message", receiveEditorState);
  }, [communityEditor]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPosts(), 0);
    return () => window.clearTimeout(timer);
  }, [loadPosts]);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("post");
    if (id) void openPost(id, false);
    // URL 진입 시 한 번만 실행합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const availableCategories = useMemo(() => admin ? CATEGORIES : CATEGORIES.filter((entry) => !entry.adminOnly), [admin]);

  async function openPost(id: string, countView = true) {
    try {
      // The embedded visual preview may inspect a post, but it must not mutate
      // operational counters or records while staff are editing presentation.
      const shouldCountView = countView && !communityEditor.active;
      const result = await requestJson<{ item: BoardPost }>(`/api/board/posts/${encodeURIComponent(id)}${shouldCountView ? "?view=1" : ""}`);
      setActivePost(result.item);
      setModerationNote(result.item.moderationNote || "");
      returnToDetailAfterWriteRef.current = false;
      returnToDetailAfterPostActionRef.current = false;
      openExclusiveDialog(detailDialog.current);
      const url = new URL(window.location.href);
      url.searchParams.set("post", id);
      history.replaceState(null, "", url);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "게시글을 열지 못했습니다.");
    }
  }

  function closeDetail() {
    detailDialog.current?.close();
    returnToDetailAfterWriteRef.current = false;
    returnToDetailAfterPostActionRef.current = false;
    setActivePost(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("post");
    history.replaceState(null, "", url);
  }

  function resetWrite() {
    let restored = emptyDraft;
    if (!admin) {
      try {
        const saved = JSON.parse(localStorage.getItem("songak-board-draft-v2") || "null") as Partial<Draft> | null;
        if (saved) {
          const safeSaved: PersistedBoardDraft = {
            category: saved.category || emptyDraft.category,
            title: saved.title || "",
            body: saved.body || "",
            pinned: Boolean(saved.pinned),
          };
          restored = { ...emptyDraft, ...safeSaved };
          // Migrate older drafts that may have persisted identity fields.
          localStorage.setItem("songak-board-draft-v2", JSON.stringify(safeSaved));
        }
      } catch { /* 손상된 임시저장은 무시합니다. */ }
    }
    setDraft({ ...restored, category: admin ? "welfare" : restored.category });
    setDraftMedia([]);
    setDiscardedDraftMedia([]);
    setThumbnailMediaId(null);
    setEditingId("");
    setClaimedModerationNote("");
  }

  function openWrite(post?: BoardPost) {
    if (communityEditor.active) return;
    returnToDetailAfterWriteRef.current = Boolean(post && detailDialog.current?.open);
    if (post) {
      setDraft({
        category: post.category,
        author: post.author,
        contact: post.contact || "",
        title: post.title,
        body: post.body,
        password: "",
        website: "",
        pinned: post.pinned,
      });
      setDraftMedia(post.media);
      setDiscardedDraftMedia([]);
      setThumbnailMediaId(post.thumbnailMediaId || post.media[0]?.id || null);
      setEditingId(post.id);
    } else resetWrite();
    openExclusiveDialog(writeDialog.current);
  }

  function openClaimDialog() {
    if (communityEditor.active || admin) return;
    const recentId = localStorage.getItem("songak-board-recent-post-id-v1") || "";
    setClaimPostId(recentId);
    setClaimPassword("");
    openExclusiveDialog(claimDialog.current);
  }

  async function claimVisitorPost(event: FormEvent) {
    event.preventDefault();
    if (claiming || communityEditor.active || admin) return;
    setClaiming(true);
    try {
      const id = claimPostId.trim();
      const result = await requestJson<{ item: BoardPost }>(`/api/board/posts/${encodeURIComponent(id)}/claim`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: claimPassword }),
      });
      localStorage.setItem("songak-board-recent-post-id-v1", result.item.id);
      claimDialog.current?.close();
      setClaimPassword("");
      setClaimedModerationNote(result.item.status === "rejected" ? result.item.moderationNote || "" : "");
      openWrite(result.item);
      if (result.item.status === "rejected" && result.item.moderationNote) {
        showToast(`반려 사유: ${result.item.moderationNote}`);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "내 게시글을 불러오지 못했습니다.");
    } finally {
      setClaiming(false);
    }
  }

  function saveDraft() {
    if (admin || communityEditor.active) return;
    // Keep browser persistence content-only. Identity and contact fields stay
    // in React state for the active form and are sent only with submission.
    const safeDraft: PersistedBoardDraft = {
      category: draft.category,
      title: draft.title,
      body: draft.body,
      pinned: draft.pinned,
    };
    localStorage.setItem("songak-board-draft-v2", JSON.stringify(safeDraft));
    showToast("작성 중인 글을 이 기기에 임시저장했습니다.");
  }

  async function uploadFiles(files: FileList | null) {
    if (communityEditor.active || !files?.length) return;
    if (draftMedia.length + files.length > 12) return showToast("사진과 영상은 합계 12개까지 등록할 수 있습니다.");
    setUploading(true);
    try {
      const added: BoardMedia[] = [];
      for (const file of Array.from(files)) {
        const result = await requestJson<{ item: BoardMedia }>("/api/board/media", {
          method: "POST",
          headers: { "content-type": file.type, "x-file-name": encodeURIComponent(file.name) },
          body: file,
        });
        added.push(result.item);
      }
      setDraftMedia((current) => [...current, ...added]);
      setThumbnailMediaId((current) => current || added[0]?.id || null);
      showToast(`${added.length}개 파일을 추가했습니다.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "파일을 올리지 못했습니다.");
    } finally {
      setUploading(false);
    }
  }

  function removeDraftMedia(item: BoardMedia) {
    const remaining = draftMedia.filter((entry) => entry.id !== item.id);
    setDraftMedia(remaining);
    if (thumbnailMediaId === item.id) setThumbnailMediaId(remaining[0]?.id || null);
    // A newly uploaded file removed while editing is not part of the final media
    // list. Keep its claim so the PATCH can delete the temporary D1/R2 object.
    if (editingId && item.claimToken) {
      setDiscardedDraftMedia((current) => current.some((entry) => entry.id === item.id) ? current : [...current, item]);
    }
  }

  async function submitPost(event: FormEvent) {
    event.preventDefault();
    if (communityEditor.active || uploading || submitting) return;
    setSubmitting(true);
    try {
      const payload = {
        ...draft,
        media: draftMedia.map((item) => ({ id: item.id, claimToken: item.claimToken, alt: item.alt })),
        thumbnailMediaId,
        ...(editingId ? {
          discardedMedia: discardedDraftMedia.map((item) => ({ id: item.id, claimToken: item.claimToken })),
        } : {}),
      };
      if (editingId) {
        const result = await requestJson<{ item: BoardPost }>(`/api/board/posts/${encodeURIComponent(editingId)}`, {
          method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
        });
        if (!admin) localStorage.setItem("songak-board-recent-post-id-v1", result.item.id);
        showToast(admin ? "게시글을 수정했습니다." : "수정 내용을 다시 검수 요청했습니다.");
      } else {
        const result = await requestJson<{ item: BoardPost }>("/api/board/posts", {
          method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
        });
        if (!admin) {
          localStorage.removeItem("songak-board-draft-v2");
          localStorage.setItem("songak-board-recent-post-id-v1", result.item.id);
        }
        showToast(admin ? "복지관 소식을 게시했습니다." : "접수되었습니다. 관리자 확인 후 공개됩니다.");
      }
      if (writeDialog.current?.open) writeDialog.current.close();
      returnToDetailAfterWriteRef.current = false;
      closeDetail();
      await loadPosts();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "게시글을 저장하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  function loginAdmin() {
    window.location.assign(adminSignInPath);
  }

  async function moderate(nextStatus: PostStatus) {
    if (communityEditor.active || !activePost) return;
    try {
      const result = await requestJson<{ item: BoardPost }>(`/api/board/posts/${activePost.id}/moderate`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: nextStatus, note: moderationNote }),
      });
      setActivePost(result.item);
      showToast(nextStatus === "published" ? "게시글을 공개했습니다." : nextStatus === "rejected" ? "게시글을 반려했습니다." : "게시글을 숨겼습니다.");
      await loadPosts();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "검수 상태를 변경하지 못했습니다.");
    }
  }

  async function sharePost() {
    if (communityEditor.active || !activePost) return;
    const post = activePost;
    const shouldRestoreDetail = Boolean(detailDialog.current?.open);
    if (shouldRestoreDetail) detailDialog.current?.close();
    const url = new URL(window.location.href);
    url.searchParams.set("post", post.id);
    try {
      if (navigator.share) await navigator.share({ title: post.title, text: post.body.slice(0, 90), url: url.toString() });
      else { await navigator.clipboard.writeText(url.toString()); showToast("게시글 주소를 복사했습니다."); }
      void requestJson(`/api/board/posts/${post.id}/share`, { method: "POST" });
    } catch (error) {
      if ((error as DOMException)?.name !== "AbortError") showToast("공유를 완료하지 못했습니다.");
    } finally {
      if (shouldRestoreDetail && activePost?.id === post.id) openExclusiveDialog(detailDialog.current);
    }
  }

  async function submitReport(event: FormEvent) {
    event.preventDefault();
    if (communityEditor.active || !activePost) return;
    try {
      await requestJson(`/api/board/posts/${activePost.id}/report`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: reportReason }),
      });
      setReportReason("");
      closePostActionDialog(reportDialog.current);
      showToast("신고를 접수했습니다. 관리자가 확인하겠습니다.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "신고를 접수하지 못했습니다.");
    }
  }

  async function deleteActivePost(event: FormEvent) {
    event.preventDefault();
    if (communityEditor.active || !activePost) return;
    try {
      await requestJson(`/api/board/posts/${activePost.id}`, {
        method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: deletePassword }),
      });
      setDeletePassword("");
      closePostActionDialog(deleteDialog.current, false);
      closeDetail();
      showToast("게시글을 삭제했습니다.");
      await loadPosts();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "게시글을 삭제하지 못했습니다.");
    }
  }

  function applySearch(event: FormEvent) {
    event.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }

  function selectCommunityTarget(event: SyntheticEvent<HTMLElement>, targetId: CommunityTextTargetId) {
    if (!communityEditor.active) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setSelectedCommunityTarget(targetId);
    window.parent.postMessage(createCommunityEditorSelectMessage(communityEditor.nonce, targetId, {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    }), window.location.origin);
  }

  function changeCommunityTarget(event: SyntheticEvent<HTMLElement>, targetId: CommunityTextTargetId) {
    if (!communityEditor.active) return;
    const field = communityFieldByTarget[targetId];
    const value = (event.currentTarget.textContent || "").replace(/\u00a0/g, " ");
    const caretOffset = readCommunityCaretOffset(event.currentTarget);
    const next = normalizeCommunityEditorSurface({
      ...communitySurfaceRef.current,
      fields: { ...communitySurfaceRef.current.fields, [field]: value },
    });
    const nextRevision = communityRevisionRef.current + 1;
    communityCaretRef.current = caretOffset === null ? null : { targetId, offset: caretOffset };
    communitySurfaceRef.current = next;
    communityRevisionRef.current = nextRevision;
    setCommunitySurface(next);
    setCommunityRevision(nextRevision);
    window.parent.postMessage(createCommunityEditorChangeMessage(communityEditor.nonce, next, nextRevision), window.location.origin);
  }

  function editorTargetProps(targetId: CommunityTextTargetId) {
    return {
      "data-editor-target-id": targetId,
      "data-editor-selected": selectedCommunityTarget === targetId ? "true" : undefined,
      contentEditable: communityEditor.active,
      suppressContentEditableWarning: true,
      spellCheck: communityEditor.active,
      style: communityTargetStyle(communitySurface, targetId),
      onClick: (event: SyntheticEvent<HTMLElement>) => selectCommunityTarget(event, targetId),
      onFocus: (event: SyntheticEvent<HTMLElement>) => selectCommunityTarget(event, targetId),
      onInput: (event: SyntheticEvent<HTMLElement>) => changeCommunityTarget(event, targetId),
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        if (!communityEditor.active) return;
        if (event.key === "Enter" && (targetId === COMMUNITY_EDITOR_TARGET_IDS.primaryCta || targetId === COMMUNITY_EDITOR_TARGET_IDS.secondaryCta)) event.preventDefault();
      },
    };
  }

  const surfaceAppearance = communitySurface.appearance;
  const surfaceBackground = communitySurface.background;
  const boardVisualStyle: CommunityVisualCss = {
    "--community-surface-background": surfaceAppearance.background,
    "--community-surface-accent": surfaceAppearance.accent,
    "--community-surface-text": surfaceAppearance.text,
    "--community-surface-motif": surfaceAppearance.decoration || "none",
    "--green": surfaceAppearance.accent,
    "--green-dark": `color-mix(in srgb, ${surfaceAppearance.accent} 78%, #10231b)`,
    "--ink": surfaceAppearance.text,
    "--muted": `color-mix(in srgb, ${surfaceAppearance.text} 62%, ${surfaceAppearance.background})`,
    "--line": `color-mix(in srgb, ${surfaceAppearance.accent} 24%, ${surfaceAppearance.background})`,
    "--community-page-background": surfaceBackground.colorEnabled || surfaceBackground.mode === "color" || surfaceBackground.mode === "image" ? surfaceBackground.color : "#fbfdfb",
    "--community-page-background-image": surfaceBackground.mode === "image" && surfaceBackground.imageDataUrl ? `url("${surfaceBackground.imageDataUrl.replace(/["\\]/g, "")}")` : "none",
    "--community-page-background-opacity": surfaceBackground.opacity / 100,
    ...communityBackgroundGeometry(communitySurface),
    "--community-content-width-desktop": `${communitySurface.layouts.desktop.contentWidth}%`,
    "--community-content-width-tablet": `${communitySurface.layouts.tablet.contentWidth}%`,
    "--community-content-width-phone": `${communitySurface.layouts.phone.contentWidth}%`,
    "--community-content-width-phone-small": `${communitySurface.layouts.phoneSmall.contentWidth}%`,
    "--community-padding-top-desktop": `${communitySurface.layouts.desktop.paddingTop}px`,
    "--community-padding-top-tablet": `${communitySurface.layouts.tablet.paddingTop}px`,
    "--community-padding-top-phone": `${communitySurface.layouts.phone.paddingTop}px`,
    "--community-padding-top-phone-small": `${communitySurface.layouts.phoneSmall.paddingTop}px`,
    "--community-padding-bottom-desktop": `${communitySurface.layouts.desktop.paddingBottom}px`,
    "--community-padding-bottom-tablet": `${communitySurface.layouts.tablet.paddingBottom}px`,
    "--community-padding-bottom-phone": `${communitySurface.layouts.phone.paddingBottom}px`,
    "--community-padding-bottom-phone-small": `${communitySurface.layouts.phoneSmall.paddingBottom}px`,
    "--community-info-columns-desktop": communitySurface.layouts.desktop.infoColumns,
    "--community-info-columns-tablet": communitySurface.layouts.tablet.infoColumns,
    "--community-info-columns-phone": communitySurface.layouts.phone.infoColumns,
    "--community-info-columns-phone-small": communitySurface.layouts.phoneSmall.infoColumns,
  };

  return (
    <div className={`board-page${communityEditor.active ? " community-editor-embed" : ""}`} data-songak-board-shell="renewal" data-community-editor-active={communityEditor.active ? "true" : undefined} data-community-appearance-decoration={surfaceAppearance.decoration || "none"} style={boardVisualStyle}>
      <CommunityBackgroundLayer surface={communitySurface} />
      <CommunityDecorationLayer layer="back" decorations={communitySurface.pageDecorations.decorations} accent={surfaceAppearance.accent} />
      <CommunityDecorationLayer layer="front" decorations={communitySurface.pageDecorations.decorations} accent={surfaceAppearance.accent} />
      <a className="skip-link" href="#board-list">게시글 목록으로 이동</a>
      <HomepageNavigation navigation={sharedNavigation || publicNavigation} currentPath="/community" />

      {communityEditor.active && (
        <aside className="community-editor-preview-note" id="community-editor-preview-note" aria-label="소통게시판 편집 미리보기 안내">
          <div>
            <b>시각 편집 미리보기</b>
            <span>이 화면에서는 문구와 디자인만 편집합니다. 게시글 등록·검수·삭제는 실제 소통게시판에서 진행하세요.</span>
          </div>
          <Link href="/community?manage=1" target="_blank" rel="noopener noreferrer">실제 게시물 관리 열기</Link>
        </aside>
      )}

      <main>
        <section className="board-intro" aria-labelledby="board-title" data-editor-target-id={COMMUNITY_EDITOR_TARGET_IDS.section}>
          <HomepageBreadcrumb navigation={sharedNavigation || publicNavigation} currentPath="/community" className="board-breadcrumb" />
          <div className="board-intro-copy">
            <p className="eyebrow community-editor-text" {...editorTargetProps(COMMUNITY_EDITOR_TARGET_IDS.eyebrow)}>{communitySurface.fields.eyebrow}</p>
            <h1 id="board-title" className="community-editor-text" {...editorTargetProps(COMMUNITY_EDITOR_TARGET_IDS.title)}>{communitySurface.fields.title}</h1>
            <p className="board-intro-description community-editor-text" {...editorTargetProps(COMMUNITY_EDITOR_TARGET_IDS.description)}>{communitySurface.fields.description}</p>
            <div className="board-intro-actions">
            <button className="primary-btn community-editor-cta" style={communityTargetStyle(communitySurface, COMMUNITY_EDITOR_TARGET_IDS.primaryCta)} type="button" aria-disabled={communityEditor.active || undefined} aria-describedby={communityEditor.active ? "community-editor-preview-note" : undefined} onClick={() => { if (!communityEditor.active) openWrite(); }}><span className="community-editor-text" {...editorTargetProps(COMMUNITY_EDITOR_TARGET_IDS.primaryCta)}>{communityEditor.active ? communitySurface.fields.primaryCta : admin ? "공식 소식 등록" : communitySurface.fields.primaryCta}</span></button>
            {!admin && !communityEditor.active && <button className="secondary-btn" type="button" onClick={openClaimDialog}>내 글 수정</button>}
            <a className="secondary-btn button-link community-editor-cta" style={communityTargetStyle(communitySurface, COMMUNITY_EDITOR_TARGET_IDS.secondaryCta)} href="#board-list" aria-disabled={communityEditor.active || undefined} aria-describedby={communityEditor.active ? "community-editor-preview-note" : undefined} onClick={(event) => { if (communityEditor.active) event.preventDefault(); }}><span className="community-editor-text" {...editorTargetProps(COMMUNITY_EDITOR_TARGET_IDS.secondaryCta)}>{communitySurface.fields.secondaryCta}</span></a>
            </div>
          </div>
          <dl className="board-info-row" aria-label="소통게시판 이용 안내">
            <div><dt className="community-editor-text" {...editorTargetProps(COMMUNITY_EDITOR_TARGET_IDS.publicLabel)}>{communitySurface.fields.publicLabel}</dt><dd className="community-editor-text" {...editorTargetProps(COMMUNITY_EDITOR_TARGET_IDS.publicValue)}>{communitySurface.fields.publicValue}</dd></div>
            <div><dt className="community-editor-text" {...editorTargetProps(COMMUNITY_EDITOR_TARGET_IDS.privacyLabel)}>{communitySurface.fields.privacyLabel}</dt><dd className="community-editor-text" {...editorTargetProps(COMMUNITY_EDITOR_TARGET_IDS.privacyValue)}>{communitySurface.fields.privacyValue}</dd></div>
            <div><dt className="community-editor-text" {...editorTargetProps(COMMUNITY_EDITOR_TARGET_IDS.processLabel)}>{communitySurface.fields.processLabel}</dt><dd className="community-editor-text" {...editorTargetProps(COMMUNITY_EDITOR_TARGET_IDS.processValue)}>{communitySurface.fields.processValue}</dd></div>
          </dl>
        </section>

        <section className="board-shell" id="board-list" aria-label="게시글 목록">
          {admin && !communityEditor.active && (
            <div className="admin-console">
              <div><span className="admin-dot" /><b>담당자 게시물 관리</b><small>주민 게시글을 확인하고 공개·반려·숨김 처리할 수 있습니다.</small></div>
              <label>표시 상태
                <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
                  <option value="pending">승인 대기</option><option value="published">공개</option><option value="rejected">반려</option><option value="hidden">숨김</option><option value="all">전체</option>
                </select>
              </label>
              <button className="admin-write" type="button" onClick={() => openWrite()}>＋ 공식 소식 등록</button>
            </div>
          )}

          <div className="board-toolbar">
            <form className="search-box" onSubmit={applySearch} role="search">
              <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} maxLength={100} placeholder="제목, 내용, 작성자 검색" aria-label="게시글 검색" />
              <button type="submit" aria-label="검색">검색</button>
            </form>
            <select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }} aria-label="게시글 정렬">
              <option value="latest">최신순</option><option value="views">조회순</option>
            </select>
            <div className="view-toggle" aria-label="보기 방식">
              <button className={view === "card" ? "active" : ""} type="button" onClick={() => setView("card")} aria-label="카드형 보기">▦</button>
              <button className={view === "list" ? "active" : ""} type="button" onClick={() => setView("list")} aria-label="목록형 보기">☷</button>
            </div>
          </div>

          <nav className="category-tabs" aria-label="게시글 분류">
            {[{ id: "all", label: "전체" }, ...CATEGORIES].map((entry) => (
              <button key={entry.id} className={category === entry.id ? "active" : ""} type="button" onClick={() => { setCategory(entry.id); setPage(1); }} aria-pressed={category === entry.id}>{entry.label}</button>
            ))}
          </nav>

          <div className="section-heading"><div><p className="eyebrow community-editor-text" {...editorTargetProps(COMMUNITY_EDITOR_TARGET_IDS.listEyebrow)}>{communitySurface.fields.listEyebrow}</p><h2 className="community-editor-text" {...editorTargetProps(COMMUNITY_EDITOR_TARGET_IDS.listTitle)}>{communityEditor.active ? communitySurface.fields.listTitle : admin ? statusLabels[status as PostStatus] || "전체 게시글" : communitySurface.fields.listTitle}</h2></div><span>{loading ? "불러오는 중" : `총 ${total}건`}</span></div>

          {loading ? (
            <div className="loading-grid" aria-label="게시글 불러오는 중">{[1,2,3].map((item) => <div key={item} className="loading-card" />)}</div>
          ) : posts.length ? (
            <div className={`post-grid ${view === "list" ? "list-view" : ""}`}>
              {posts.map((post) => (
                <article className="post-card" key={post.id}>
                  <button className="post-card-button" type="button" onClick={() => void openPost(post.id)} aria-label={`${post.title} 게시글 보기`}>
                    <PostThumbnail post={post} />
                    <div className="post-card-body">
                      <div className="post-meta"><span className="category-badge">{categoryLabel(post.category)}</span><time>{formatDate(post.publishedAt || post.createdAt)}</time>{admin && !communityEditor.active && post.status !== "published" && <span className={`status-pill status-${post.status}`}>{statusLabels[post.status]}</span>}</div>
                      <h3>{post.title}</h3><p>{post.body}</p>
                      <div className="post-stats"><span>{post.author}</span><span>조회 {post.views}</span>{post.media.length > 0 && <span>첨부 {post.media.length}</span>}</div>
                    </div>
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state"><span>송</span><h3 className="community-editor-text" {...editorTargetProps(COMMUNITY_EDITOR_TARGET_IDS.emptyTitle)}>{communitySurface.fields.emptyTitle}</h3><p className="community-editor-text" {...editorTargetProps(COMMUNITY_EDITOR_TARGET_IDS.emptyDescription)}>{communitySurface.fields.emptyDescription}</p><button className="primary-btn" type="button" aria-disabled={communityEditor.active || undefined} aria-describedby={communityEditor.active ? "community-editor-preview-note" : undefined} onClick={() => { if (!communityEditor.active) openWrite(); }}>글쓰기</button></div>
          )}

          {totalPages > 1 && <div className="pagination"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>이전</button><span><b>{page}</b> / {totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>다음</button></div>}
        </section>
      </main>

      <footer className="site-footer">
        <section className="footer-brand">
          <small>SONGAK COMMUNITY WELFARE CENTER</small>
          <h2>송악사회복지관</h2>
          <p>주민과 함께 행복한 지역공동체를 만들어갑니다.</p>
        </section>
        <dl className="contact-grid">
          <div><dt>주소</dt><dd>(31728) 충남 당진시 송악읍 송악로 656</dd></div>
          <div><dt>전화</dt><dd><a href="tel:0413535077">041-353-5077</a></dd></div>
          <div><dt>팩스</dt><dd>041-353-6077</dd></div>
          <div><dt>이메일</dt><dd><a href="mailto:sacwc2021@hanmail.net">sacwc2021@hanmail.net</a></dd></div>
        </dl>
        <div className="footer-links">
          <nav aria-label="하단 정책 메뉴">
            <Link href="/privacy-policy">개인정보처리방침</Link>
            <Link href="/email-refusal">이메일무단수집거부</Link>
            <Link href="/directions">찾아오시는 길</Link>
          </nav>
          <p>Copyright © 송악사회복지관. All rights reserved.</p>
        </div>
      </footer>
      <button className="mobile-write" type="button" onClick={() => openWrite()} aria-label="게시글 작성" aria-hidden={communityEditor.active || undefined} tabIndex={communityEditor.active ? -1 : undefined}>＋</button>

      <dialog ref={writeDialog} className="write-dialog" onCancel={(event) => { event.preventDefault(); cancelWrite(); }}>
        <form onSubmit={submitPost}>
          <DialogHeader title={editingId ? "게시글 수정" : admin ? "복지관 소식 등록" : "주민 글쓰기"} onClose={cancelWrite} />
          <div className="dialog-body">
            {!admin && !editingId && <div className="notice-box"><b>작성한 글은 관리자 확인 후 공개됩니다.</b><span>연락처는 검수 목적으로만 사용되며 게시판에 표시되지 않습니다.</span></div>}
            {!admin && editingId && claimedModerationNote && <div className="notice-box"><b>반려 사유를 확인해 주세요.</b><span>{claimedModerationNote}</span></div>}
            <div className="field-grid">
              <label className="field"><span>분류 <em>필수</em></span><select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as Category })}>{availableCategories.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select></label>
              <label className="field"><span>작성자 <em>필수</em></span><input required maxLength={40} value={draft.author} onChange={(event) => setDraft({ ...draft, author: event.target.value })} placeholder="이름 또는 별명" /></label>
              <label className="field full"><span>제목 <em>필수</em></span><input required minLength={2} maxLength={160} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="어떤 소식인지 한눈에 알 수 있게 적어주세요" /></label>
              <label className="field full"><span>내용 <em>필수</em></span><textarea required minLength={10} maxLength={20000} value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} placeholder="개인정보가 포함되지 않도록 확인해 주세요" /></label>
              <label className="field honeypot" aria-hidden="true"><span>웹사이트</span><input tabIndex={-1} autoComplete="off" value={draft.website} onChange={(event) => setDraft({ ...draft, website: event.target.value })} /></label>
              <div className="field full"><span>사진·영상 <small>최대 12개 · 사진 15MB · 영상 100MB</small></span><label className={`upload-zone ${uploading ? "uploading" : ""}`}><input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" multiple disabled={uploading} onChange={(event) => { void uploadFiles(event.target.files); event.currentTarget.value = ""; }} /><b>{uploading ? "안전하게 올리는 중…" : "＋ 사진·영상 추가"}</b><span>파일을 선택하거나 모바일에서 바로 촬영해 올릴 수 있습니다.</span></label></div>
              {draftMedia.length > 0 && <div className="media-preview full">{draftMedia.map((item) => <div className="media-tile" key={item.id}>{item.kind === "image" ? <Image src={mediaUrl(item)} alt="" width={320} height={180} sizes="180px" unoptimized /> : <video src={mediaUrl(item)} muted preload="metadata" />}<div className="media-controls"><button className={thumbnailMediaId === item.id ? "selected" : ""} type="button" onClick={() => setThumbnailMediaId(item.id)}>{thumbnailMediaId === item.id ? "대표" : "대표 선택"}</button><button type="button" onClick={() => removeDraftMedia(item)}>삭제</button></div><input aria-label={`${item.name} 설명`} value={item.alt} onChange={(event) => setDraftMedia((current) => current.map((entry) => entry.id === item.id ? { ...entry, alt: event.target.value } : entry))} placeholder="사진 설명(선택)" /></div>)}</div>}
              <label className="field"><span>연락처 <small>비공개</small></span><input maxLength={120} value={draft.contact} onChange={(event) => setDraft({ ...draft, contact: event.target.value })} placeholder="전화 또는 이메일" /></label>
              {!admin && <label className="field"><span>수정·삭제 비밀번호 <em>필수</em></span><input required minLength={6} maxLength={32} type="password" value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} placeholder="6~32자" /></label>}
              {admin && <label className="check-field full"><input type="checkbox" checked={draft.pinned} onChange={(event) => setDraft({ ...draft, pinned: event.target.checked })} />상단 중요 공지로 고정</label>}
            </div>
          </div>
          <div className="dialog-actions">{!admin && !editingId && <button className="ghost-btn" type="button" onClick={saveDraft}>임시저장</button>}<button className="secondary-btn" type="button" onClick={cancelWrite}>취소</button><button className="primary-btn" type="submit" disabled={submitting || uploading}>{submitting ? "저장 중…" : admin ? "바로 게시" : editingId ? "수정 검수 요청" : "검수 요청"}</button></div>
        </form>
      </dialog>

      <dialog ref={detailDialog} className="detail-dialog" onCancel={(event) => { event.preventDefault(); closeDetail(); }}>
        {activePost && <><DialogHeader title="게시글" onClose={closeDetail} /><article className="dialog-body detail-body"><div className="detail-meta"><span>{categoryLabel(activePost.category)}</span><time>{formatDate(activePost.publishedAt || activePost.createdAt)}</time><span>작성자 {activePost.author}</span><span>조회 {activePost.views}</span>{admin && !communityEditor.active && <span className={`status-pill status-${activePost.status}`}>{statusLabels[activePost.status]}</span>}</div><h2>{activePost.title}</h2><div className="detail-content">{activePost.body}</div>{activePost.media.length > 0 && <div className="detail-media">{activePost.media.map((item) => <figure key={item.id}>{item.kind === "image" ? <Image src={mediaUrl(item)} alt={item.alt || ""} width={1200} height={900} sizes="(max-width: 720px) 100vw, 80vw" unoptimized /> : <video src={mediaUrl(item)} controls preload="metadata" />}{item.alt && <figcaption>{item.alt}</figcaption>}</figure>)}</div>}{!communityEditor.active && <div className="detail-tools"><button className="secondary-btn" type="button" onClick={() => void sharePost()}>공유하기</button><button className="ghost-btn" type="button" onClick={() => openPostActionDialog(reportDialog.current)}>신고</button><button className="ghost-btn" type="button" onClick={() => openWrite(activePost)}>수정</button><button className="ghost-btn danger-text" type="button" onClick={() => openPostActionDialog(deleteDialog.current)}>삭제</button></div>}{admin && !communityEditor.active && <section className="moderation-panel"><div><b>관리자 검수</b><span>개인정보·비방·광고·저작권 침해 여부를 확인하세요.</span></div>{activePost.contact && <p><b>작성자 연락처</b> {activePost.contact}</p>}<textarea value={moderationNote} onChange={(event) => setModerationNote(event.target.value)} maxLength={500} placeholder="반려 사유 또는 내부 메모(작성자에게 공개하지 않음)" /><div><button className="approve-btn" type="button" onClick={() => void moderate("published")}>공개 승인</button><button className="reject-btn" type="button" onClick={() => void moderate("rejected")}>반려</button><button className="hide-btn" type="button" onClick={() => void moderate("hidden")}>숨김</button></div></section>}</article></>}
      </dialog>

      <dialog ref={adminDialog} className="small-dialog"><DialogHeader title="담당자 로그인" onClose={() => adminDialog.current?.close()} /><div className="dialog-body"><p className="dialog-copy">허용된 담당자 계정으로 로그인하면 편집·저장·게시 기능을 이용할 수 있습니다.</p></div><div className="dialog-actions"><button className="secondary-btn" type="button" onClick={() => adminDialog.current?.close()}>취소</button><button className="primary-btn" type="button" onClick={loginAdmin}>로그인 화면으로 이동</button></div></dialog>
      <dialog ref={reportDialog} className="small-dialog" onCancel={(event) => { event.preventDefault(); closePostActionDialog(reportDialog.current); }}><form onSubmit={submitReport}><DialogHeader title="게시글 신고" onClose={() => closePostActionDialog(reportDialog.current)} /><div className="dialog-body"><p className="dialog-copy">개인정보 노출, 비방, 광고, 저작권 침해 등 확인이 필요한 이유를 알려주세요.</p><label className="field"><span>신고 사유</span><textarea required minLength={2} maxLength={300} value={reportReason} onChange={(event) => setReportReason(event.target.value)} /></label></div><div className="dialog-actions"><button className="secondary-btn" type="button" onClick={() => closePostActionDialog(reportDialog.current)}>취소</button><button className="danger-btn" type="submit">신고 접수</button></div></form></dialog>
      <dialog ref={deleteDialog} className="small-dialog" onCancel={(event) => { event.preventDefault(); closePostActionDialog(deleteDialog.current); }}><form onSubmit={deleteActivePost}><DialogHeader title="게시글 삭제" onClose={() => closePostActionDialog(deleteDialog.current)} /><div className="dialog-body"><p className="dialog-copy">삭제한 게시글은 일반 화면에서 즉시 보이지 않습니다.</p>{!admin && <label className="field"><span>작성 시 입력한 비밀번호</span><input required type="password" minLength={6} maxLength={32} value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} /></label>}</div><div className="dialog-actions"><button className="secondary-btn" type="button" onClick={() => closePostActionDialog(deleteDialog.current)}>취소</button><button className="danger-btn" type="submit">삭제</button></div></form></dialog>
      <dialog ref={claimDialog} className="small-dialog" onCancel={(event) => { event.preventDefault(); claimDialog.current?.close(); }}><form onSubmit={claimVisitorPost}><DialogHeader title="내 글 수정" onClose={() => claimDialog.current?.close()} /><div className="dialog-body"><p className="dialog-copy">접수·반려된 글도 게시글 번호와 작성 시 비밀번호로 다시 열 수 있습니다.</p><label className="field"><span>게시글 번호</span><input required autoComplete="off" value={claimPostId} onChange={(event) => setClaimPostId(event.target.value)} /></label><label className="field"><span>작성 시 입력한 비밀번호</span><input required type="password" minLength={6} maxLength={32} value={claimPassword} onChange={(event) => setClaimPassword(event.target.value)} /></label></div><div className="dialog-actions"><button className="secondary-btn" type="button" onClick={() => claimDialog.current?.close()}>취소</button><button className="primary-btn" type="submit" disabled={claiming}>{claiming ? "확인 중…" : "내 글 열기"}</button></div></form></dialog>

      <div className={`toast ${toast ? "show" : ""}`} role="status" aria-live="polite">{toast}</div>
    </div>
  );
}
