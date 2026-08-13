import { getSiteContent } from "../../../lib/site-content-server";

const allowedLayouts = new Set(["selected-dropdown", "cascade", "two-level", "mega", "disclosure", "sitemap", "unified"]);

type MenuItem = { id?: unknown; label?: unknown; externalUrl?: unknown; children?: unknown };
type SafeMenuItem = { id: string; label: string; href: string; children: SafeMenuItem[] };

const knownRoutes: Record<string, string> = {
  "home-menu-account": "/",
  "home-menu-intro-main": "/about",
  "home-menu-intro-mission": "/about/mission",
  "home-menu-intro-corporate": "/about/corporate",
  "home-menu-intro-history": "/about/history",
  "home-menu-intro-location": "/directions",
  "home-menu-intro-facility": "/about/facility",
  "home-menu-intro-organization": "/about/organization",
  "home-menu-business-program": "/programs",
  "home-menu-business-schedule": "/programs/schedule",
  "home-menu-business-schedule-original": "/programs/schedule-original",
  "home-menu-business-process": "/programs/case-management",
  "home-menu-business-application": "/programs/application",
  "home-menu-participation-volunteer": "/participation/volunteer",
  "home-menu-participation-donation": "/participation/donation",
  "home-menu-news-notice": "/news/notices",
  "home-menu-news-press": "/news/press",
  "home-menu-news-video": "/news/videos",
  "home-menu-news-gallery": "/news/gallery",
  "home-menu-news-board": "/community",
  "home-menu-news-visitor": "/community",
};

function routeFor(item: MenuItem): string {
  const id = String(item.id || "");
  if (knownRoutes[id]) return knownRoutes[id];
  if (item.externalUrl === "delivery-board") return "/community";
  return id.startsWith("home-menu-") ? `/page/${encodeURIComponent(id)}` : "/";
}

function safeItem(item: MenuItem): SafeMenuItem | null {
  const id = String(item.id || "").trim();
  const label = String(item.label || "").trim();
  if (!id || !label) return null;
  const children = Array.isArray(item.children)
    ? item.children.map((child) => safeItem(child as MenuItem)).filter((child): child is SafeMenuItem => Boolean(child))
    : [];
  return { id, label, href: routeFor(item), children };
}

export async function GET(request: Request) {
  const source = await getSiteContent(new Request(new URL("/api/site-content/songak-homepage", request.url)), "songak-homepage");
  const payload = await source.json().catch(() => ({})) as {
    content?: { document?: { globals?: { homeMenu?: {
      layoutDesignVersion?: number; selectedDropdownDefaultVersion?: number; layoutMode?: string; brand?: string; brandMode?: string; logo?: { dataUrl?: string; shape?: string } | null;
      brandPosition?: string; brandIndex?: number;
      align?: string; fontSize?: number; brandFontSize?: number; items?: MenuItem[];
    } } } }
  };
  const homeMenu = payload.content?.document?.globals?.homeMenu;
  const requested = homeMenu?.layoutMode;
  const selectedDropdownDefaultVersion = Math.max(0, Number(homeMenu?.selectedDropdownDefaultVersion) || 0);
  const layoutMode = selectedDropdownDefaultVersion < 1
    ? "selected-dropdown"
    : requested && allowedLayouts.has(requested) ? requested : "selected-dropdown";
  const items = Array.isArray(homeMenu?.items)
    ? homeMenu.items.map(safeItem).filter((item): item is SafeMenuItem => Boolean(item))
    : [];
  const logoDataUrl = homeMenu?.brandMode === "logo" && typeof homeMenu.logo?.dataUrl === "string"
    && /^(?:data:image\/(?:png|jpeg|webp);base64,|\/)/.test(homeMenu.logo.dataUrl)
    ? homeMenu.logo.dataUrl
    : null;
  const requestedBrandIndex = Number(homeMenu?.brandIndex);
  const brandIndex = Number.isFinite(requestedBrandIndex)
    ? requestedBrandIndex
    : homeMenu?.brandPosition === "right" ? items.length : 0;
  return Response.json({
    layoutMode,
    brand: String(homeMenu?.brand || "송악사회복지관").trim() || "송악사회복지관",
    brandMode: logoDataUrl ? "logo" : "text",
    logoDataUrl,
    logoShape: ["horizontal", "vertical", "square"].includes(String(homeMenu?.logo?.shape)) ? homeMenu?.logo?.shape : "horizontal",
    brandPosition: homeMenu?.brandPosition === "right" ? "right" : "left",
    brandIndex: Math.min(items.length, Math.max(0, brandIndex)),
    align: ["left", "center", "right"].includes(String(homeMenu?.align)) ? homeMenu?.align : "center",
    fontSize: Math.min(22, Math.max(11, Number(homeMenu?.fontSize) || 14)),
    brandFontSize: Math.min(34, Math.max(12, Number(homeMenu?.brandFontSize) || 18)),
    items,
  }, { headers: { "cache-control": "no-store" } });
}
