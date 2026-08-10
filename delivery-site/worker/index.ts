/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  MEDIA: R2Bucket;
  BOARD_ADMIN_PASSWORD?: string;
  BOARD_SESSION_SECRET?: string;
  BOARD_HASH_PEPPER?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const PUBLIC_PAGE_ROUTES: Record<string, string> = {
  "/": "/songak/representative-greeting-public.html",
  "/about": "/songak/public-about.html",
  "/about/greeting": "/songak/public-about-greeting.html",
  "/about/mission": "/songak/public-about-mission.html",
  "/about/corporate": "/songak/public-about-corporate.html",
  "/about/history": "/songak/public-about-history.html",
  "/about/facility": "/songak/public-about-facility.html",
  "/about/organization": "/songak/public-about-organization.html",
  "/programs": "/songak/public-programs.html",
  "/programs/list": "/songak/public-programs-list.html",
  "/programs/schedule": "/songak/public-programs-schedule.html",
  "/programs/schedule-original": "/songak/public-programs-schedule-original.html",
  "/programs/case-management": "/songak/public-programs-case-management.html",
  "/programs/application": "/songak/public-programs-application.html",
  "/participation": "/songak/public-participation.html",
  "/participation/volunteer": "/songak/public-participation-volunteer.html",
  "/participation/donation": "/songak/public-participation-donation.html",
  "/news": "/songak/public-news.html",
  "/news/notices": "/songak/public-news-notices.html",
  "/news/press": "/songak/public-news-press.html",
  "/news/videos": "/songak/public-news-videos.html",
  "/news/gallery": "/songak/public-news-gallery.html",
  "/news/visitor-board": "/songak/public-news-visitor-board.html",
  "/privacy-policy": "/songak/public-privacy.html",
  "/email-refusal": "/songak/public-email-refusal.html",
  "/directions": "/songak/public-directions.html",
};

const LEGACY_PUBLIC_REDIRECTS: Record<string, string> = {
  "/songak/facility-detail": "/about/facility",
  "/songak/facility-detail.html": "/about/facility",
  "/songak/program-schedule": "/programs/schedule",
  "/songak/program-schedule.html": "/programs/schedule",
  "/songak/case-management-detail": "/programs/case-management",
  "/songak/case-management-detail.html": "/programs/case-management",
  "/songak/organization-staff": "/about/organization",
  "/songak/organization-staff.html": "/about/organization",
  "/songak/video-archive": "/news/videos",
  "/songak/video-archive.html": "/news/videos",
  "/songak/online-application": "/programs/application",
  "/songak/online-application.html": "/programs/application",
  "/songak/community-board": "/community",
  "/songak/community-board.html": "/community",
};

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/songak/representative-greeting-public" || url.pathname === "/songak/representative-greeting-public.html") {
      url.pathname = "/";
      return Response.redirect(url.toString(), 308);
    }

    if (url.pathname === "/community-board") {
      url.pathname = "/community";
      return Response.redirect(url.toString(), 308);
    }

    const legacyPublicPath = LEGACY_PUBLIC_REDIRECTS[url.pathname];
    if (legacyPublicPath) {
      url.pathname = legacyPublicPath;
      return Response.redirect(url.toString(), 308);
    }

    if (url.pathname === "/songak/representative-greeting-editor" || url.pathname === "/songak/representative-greeting-editor.html") {
      const sessionUrl = new URL("/api/board/admin/session", request.url);
      const sessionResponse = await handler.fetch(new Request(sessionUrl, { headers: request.headers }), env, ctx);
      const session = await sessionResponse.clone().json().catch(() => ({ admin: false })) as { admin?: boolean };
      if (!session.admin) {
        const loginUrl = new URL("/staff-login", request.url);
        return Response.redirect(loginUrl.toString(), 302);
      }
    }

    if ((request.method === "GET" || request.method === "HEAD") && url.pathname !== "/" && url.pathname.endsWith("/")) {
      const canonicalPath = url.pathname.replace(/\/+$/, "");
      if (PUBLIC_PAGE_ROUTES[canonicalPath]) {
        url.pathname = canonicalPath;
        return Response.redirect(url.toString(), 308);
      }
    }

    const publicAssetPath = PUBLIC_PAGE_ROUTES[url.pathname];
    if ((request.method === "GET" || request.method === "HEAD") && publicAssetPath) {
      // Public visitors receive only the selected read-only page. The full
      // editor remains isolated behind the authenticated /editor route.
      const publicUrl = new URL(publicAssetPath, request.url);
      const publicResponse = await env.ASSETS.fetch(new Request(publicUrl, request));
      return withSecurityHeaders(publicResponse, publicAssetPath);
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      const imageResponse = await handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
      return withSecurityHeaders(imageResponse, url.pathname);
    }

    return withSecurityHeaders(await handler.fetch(request, env, ctx), url.pathname);
  },
};

function withSecurityHeaders(response: Response, pathname = ""): Response {
  const secured = new Response(response.body, response);
  secured.headers.set("x-content-type-options", "nosniff");
  secured.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  secured.headers.set("x-frame-options", "SAMEORIGIN");
  secured.headers.set("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=()");
  secured.headers.set(
    "content-security-policy",
    "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'"
  );
  if (pathname.startsWith("/songak/assets/fonts/")) {
    secured.headers.set("cache-control", "public, max-age=31536000, immutable");
  } else if (pathname.startsWith("/songak/assets/")) {
    secured.headers.set("cache-control", "public, max-age=604800");
  } else if (pathname === "/songak/public-site.css") {
    secured.headers.set("cache-control", "public, max-age=86400, stale-while-revalidate=604800");
  } else if (/^\/songak\/.*\.(?:css|js)$/.test(pathname)) {
    secured.headers.set("cache-control", "public, max-age=86400");
  } else if (pathname.endsWith("/representative-greeting-editor.html") || pathname.endsWith("/representative-greeting-public.html") || pathname.includes("/public-")) {
    secured.headers.set("cache-control", "public, max-age=300, stale-while-revalidate=3600");
  }
  return secured;
}

export default worker;
