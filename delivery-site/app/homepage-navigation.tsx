"use client";

import Link from "next/link";
import Image from "next/image";
import { CSSProperties, Fragment, ReactNode, useEffect, useState } from "react";

export type MenuLayoutMode = "selected-dropdown" | "cascade" | "two-level" | "mega" | "disclosure" | "sitemap" | "unified";
export type SharedMenuItem = { id: string; label: string; href: string; children: SharedMenuItem[]; groupLabel?: string };
export type SharedNavigation = {
  layoutMode: MenuLayoutMode;
  brand: string;
  brandMode: "text" | "logo";
  logoDataUrl: string | null;
  logoShape: "horizontal" | "vertical" | "square";
  brandPosition: "left" | "right";
  brandIndex: number;
  align: "left" | "center" | "right";
  fontSize: number;
  brandFontSize: number;
  items: SharedMenuItem[];
};

type Props = {
  navigation: SharedNavigation;
  currentPath: string;
};

export type HomepageBreadcrumbEntry = {
  id: string;
  label: string;
  href: string;
  current: boolean;
};

type BreadcrumbProps = Props & {
  className?: string;
};

function normalizePublicPath(value: string): string {
  const pathname = value.split(/[?#]/, 1)[0] || "/";
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/, "") || "/";
}

// The trail is derived from the saved navigation tree so page chrome never
// becomes a second, manually maintained copy of the site's information architecture.
function findNavigationTrail(items: SharedMenuItem[], currentPath: string): SharedMenuItem[] | null {
  const normalizedCurrentPath = normalizePublicPath(currentPath);
  for (const item of items) {
    const descendantTrail = findNavigationTrail(item.children, normalizedCurrentPath);
    if (descendantTrail) return [item, ...descendantTrail];
    if (normalizePublicPath(item.href) === normalizedCurrentPath) return [item];
  }
  return null;
}

function firstNavigableDescendantHref(item: SharedMenuItem): string {
  if (!item.children.length) return item.href;
  return firstNavigableDescendantHref(item.children[0]);
}

export function resolveHomepageBreadcrumb(navigation: SharedNavigation, currentPath: string): HomepageBreadcrumbEntry[] {
  const trail = findNavigationTrail(navigation.items, currentPath);
  if (!trail?.length) return [];
  const root = trail[0];
  const current = trail[trail.length - 1];
  if (root.id === current.id) {
    return [{ id: current.id, label: current.label, href: current.href, current: true }];
  }
  return [
    { id: root.id, label: root.label, href: firstNavigableDescendantHref(root), current: false },
    { id: current.id, label: current.label, href: current.href, current: true },
  ];
}

export function HomepageBreadcrumb({ navigation, currentPath, className = "homepage-breadcrumb" }: BreadcrumbProps) {
  const entries = resolveHomepageBreadcrumb(navigation, currentPath);
  if (!entries.length) return null;
  return (
    <nav className={className} aria-label="현재 위치" data-homepage-breadcrumb>
      {entries.map((entry, index) => (
        <Fragment key={entry.id}>
          {index > 0 && <span aria-hidden="true">›</span>}
          {entry.current
            ? <strong aria-current="page">{entry.label}</strong>
            : <Link href={entry.href}>{entry.label}</Link>}
        </Fragment>
      ))}
    </nav>
  );
}

function isCurrent(item: SharedMenuItem, currentPath: string): boolean {
  return item.href === currentPath || item.children.some((child) => isCurrent(child, currentPath));
}

function leafItems(item: SharedMenuItem): SharedMenuItem[] {
  if (!item.children.length) return [item];
  return item.children.flatMap(leafItems);
}

type DestinationEntry = { item: SharedMenuItem; groupLabel?: string };

function destinationEntries(item: SharedMenuItem): DestinationEntry[] {
  return item.children.flatMap((child) => {
    if (!child.children.length) return [{ item: child, groupLabel: child.groupLabel }];
    return leafItems(child).map((destination) => ({
      item: destination,
      groupLabel: destination.groupLabel || child.label,
    }));
  });
}

function HomepageNavigationContent({ navigation, currentPath }: Props) {
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState("");
  const [expandedBranchIds, setExpandedBranchIds] = useState<string[]>([]);
  const usesDropdown = ["selected-dropdown", "cascade", "unified"].includes(navigation.layoutMode);
  const expandedRoot = navigation.items.find((item) => item.id === expandedId);
  const brandIndex = Math.max(0, Math.min(navigation.items.length, navigation.brandIndex));
  const style = {
    "--home-menu-align": navigation.align,
    "--home-menu-font-size": `${navigation.fontSize}px`,
    "--home-menu-brand-font-size": `${navigation.brandFontSize}px`,
  } as CSSProperties;

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const brand = (
    <Link
      key="homepage-menu-brand"
      className={`homepage-menu-brand logo-${navigation.logoShape}`}
      href="/"
      aria-label="송악사회복지관 홈페이지로 이동"
      data-homepage-brand-link
      onClick={() => setOpen(false)}
    >
      {navigation.brandMode === "logo" && navigation.logoDataUrl
        ? <Image src={navigation.logoDataUrl} alt={navigation.brand} width={240} height={56} unoptimized />
        : navigation.brand}
    </Link>
  );

  const mobileBrand = (
    <Link
      className={`homepage-menu-mobile-brand logo-${navigation.logoShape}`}
      href="/"
      aria-label="송악사회복지관 홈페이지로 이동"
      data-homepage-brand-link
      onClick={() => setOpen(false)}
    >
      {navigation.brandMode === "logo" && navigation.logoDataUrl
        ? <Image src={navigation.logoDataUrl} alt={navigation.brand} width={240} height={56} unoptimized />
        : navigation.brand}
    </Link>
  );

  const renderCascadeItems = (items: SharedMenuItem[], level: number): ReactNode => items.map((item) => {
    const hasChildren = item.children.length > 0;
    const expanded = expandedBranchIds.includes(item.id);
    if (!hasChildren) {
      return (
        <div className={`homepage-menu-item level-${level}`} key={item.id}>
          <Link
            className={`homepage-menu-link${item.href === currentPath ? " active" : ""}`}
            href={item.href}
            aria-current={item.href === currentPath ? "page" : undefined}
            onClick={() => { setOpen(false); setExpandedId(""); setExpandedBranchIds([]); }}
          >{item.label}</Link>
        </div>
      );
    }
    return (
      <div className={`homepage-menu-item level-${level}${expanded ? " child-open" : ""}`} key={item.id}>
        <button
          className={`homepage-menu-link has-children${isCurrent(item, currentPath) ? " contains-active" : ""}${expanded ? " expanded" : ""}`}
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpandedBranchIds((current) => current.includes(item.id)
            ? current.filter((id) => id !== item.id)
            : [...current, item.id])}
        >{item.label}</button>
        <div className="homepage-submenu" aria-label={`${item.label} 세부 메뉴`}>
          {renderCascadeItems(item.children, level + 1)}
        </div>
      </div>
    );
  });

  const renderRoot = (item: SharedMenuItem) => {
    const leaves = leafItems(item);
    const containsActive = isCurrent(item, currentPath);
    const expanded = expandedId === item.id;
    if (!item.children.length) {
      return (
        <div className="homepage-menu-item level-1" key={item.id}>
          <Link
            className={`homepage-menu-link${item.href === currentPath ? " active" : ""}`}
            href={item.href}
            aria-current={item.href === currentPath ? "page" : undefined}
            onClick={() => setOpen(false)}
          >{item.label}</Link>
        </div>
      );
    }
    return (
      <div className={`homepage-menu-item level-1${expanded ? " expanded" : ""}`} key={item.id}>
        <button
          className={`homepage-menu-link has-children${containsActive ? " contains-active" : ""}${expanded ? " expanded" : ""}`}
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpandedId((current) => current === item.id ? "" : item.id)}
        >{item.label}</button>
        <div className={`homepage-submenu${navigation.layoutMode === "cascade" ? "" : ` quick-submenu${navigation.layoutMode === "selected-dropdown" ? " quick-selected-dropdown" : usesDropdown ? " quick-dropdown" : " quick-two-level"}`}`} aria-label={`${item.label} 세부 메뉴`}>
          {navigation.layoutMode === "cascade" ? renderCascadeItems(item.children, 2) : leaves.map((leaf) => (
            <div className="homepage-menu-item level-2 quick-destination" key={leaf.id}>
              <Link
                className={`homepage-menu-link${leaf.href === currentPath ? " active" : ""}`}
                href={leaf.href}
                aria-current={leaf.href === currentPath ? "page" : undefined}
                onClick={() => { setOpen(false); setExpandedId(""); setExpandedBranchIds([]); }}
              >{leaf.label}</Link>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const entries: ReactNode[] = navigation.items.map(renderRoot);
  entries.splice(brandIndex, 0, brand);

  return (
    <div className={`board-homepage-menu-shell${open ? " home-menu-open" : ""}`}>
      <nav
        className={`homepage-menu layout-${navigation.layoutMode} brand-inline${open ? " open" : ""}`}
        id="homepageMenu"
        aria-label="홈페이지 메뉴"
        data-layout-mode={navigation.layoutMode}
        style={style}
      >
        {mobileBrand}
        <div className="homepage-menu-list" id="homepageMenuList">{entries}</div>
        {!usesDropdown && expandedRoot && (
          <div className={`homepage-menu-subbar layout-${navigation.layoutMode}`} id="homepageMenuSubbar" aria-label={`${expandedRoot.label} 세부 메뉴`}>
            {destinationEntries(expandedRoot).map(({ item, groupLabel }) => (
              <div className="homepage-subbar-item quick-destination" key={item.id}>
                <Link
                  className={`homepage-subbar-link${item.href === currentPath ? " active" : ""}`}
                  href={item.href}
                  aria-current={item.href === currentPath ? "page" : undefined}
                  aria-label={groupLabel ? `${groupLabel} · ${item.label}` : item.label}
                  onClick={() => { setOpen(false); setExpandedId(""); }}
                >
                  {groupLabel && <small className="homepage-quick-group-label">{groupLabel}</small>}
                  <span className="homepage-quick-destination-label">{item.label}</span>
                </Link>
              </div>
            ))}
          </div>
        )}
        <button
          className="homepage-menu-toggle"
          type="button"
          aria-label={open ? "전체 메뉴 닫기" : "전체 메뉴 열기"}
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        ><span /></button>
      </nav>
    </div>
  );
}

// Route and layout changes define a new menu interaction session. Remounting
// the local disclosure state prevents an old expanded branch from leaking into
// the next route without an effect-driven reset render.
export function HomepageNavigation(props: Props) {
  return <HomepageNavigationContent key={`${props.currentPath}:${props.navigation.layoutMode}`} {...props} />;
}
