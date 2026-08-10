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
  "/": "/songak/representative-greeting-editor.html",
  "/about": "/songak/representative-greeting-editor.html",
  "/about/greeting": "/songak/representative-greeting-editor.html",
  "/about/mission": "/songak/representative-greeting-editor.html",
  "/about/corporate": "/songak/representative-greeting-editor.html",
  "/about/history": "/songak/representative-greeting-editor.html",
  "/about/facility": "/songak/representative-greeting-editor.html",
  "/about/organization": "/songak/representative-greeting-editor.html",
  "/programs": "/songak/representative-greeting-editor.html",
  "/programs/list": "/songak/representative-greeting-editor.html",
  "/programs/schedule": "/songak/representative-greeting-editor.html",
  "/programs/schedule-original": "/songak/representative-greeting-editor.html",
  "/programs/case-management": "/songak/representative-greeting-editor.html",
  "/programs/application": "/songak/representative-greeting-editor.html",
  "/participation": "/songak/representative-greeting-editor.html",
  "/participation/volunteer": "/songak/representative-greeting-editor.html",
  "/participation/donation": "/songak/representative-greeting-editor.html",
  "/news": "/songak/representative-greeting-editor.html",
  "/news/notices": "/songak/representative-greeting-editor.html",
  "/news/press": "/songak/representative-greeting-editor.html",
  "/news/videos": "/songak/representative-greeting-editor.html",
  "/news/gallery": "/songak/representative-greeting-editor.html",
  "/news/visitor-board": "/songak/representative-greeting-editor.html",
  "/privacy-policy": "/songak/representative-greeting-editor.html",
  "/email-refusal": "/songak/representative-greeting-editor.html",
  "/directions": "/songak/representative-greeting-editor.html",
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

    if ((url.pathname === "/songak/representative-greeting-editor" || url.pathname === "/songak/representative-greeting-editor.html")
      && !(url.searchParams.get("mode") === "view" && url.searchParams.get("editorRole") !== "staff")) {
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

    const dynamicPublicMenuPath = /^\/page\/home-menu-[a-z0-9-]+$/.test(url.pathname);
    const publicAssetPath = PUBLIC_PAGE_ROUTES[url.pathname]
      || (dynamicPublicMenuPath ? "/songak/representative-greeting-editor.html" : "");
    if ((request.method === "GET" || request.method === "HEAD") && publicAssetPath) {
      // All public routes use the exact same canonical renderer as the editor.
      // The browser pathname selects a single read-only page inside that renderer,
      // while edit controls and mutations remain isolated behind /editor.
      const publicResponse = await fetchPublicAssetWithoutBrowserRedirect(env.ASSETS, publicAssetPath, request);
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

async function fetchPublicAssetWithoutBrowserRedirect(assets: Fetcher, assetPath: string, request: Request): Promise<Response> {
  let assetUrl = new URL(assetPath, request.url);

  // Some production asset dispatchers canonicalize `page.html` to `page` even
  // when local preview serves the file directly. Follow that redirect inside
  // the Worker so a public URL never exposes the protected editor pathname.
  for (let redirectCount = 0; redirectCount < 3; redirectCount += 1) {
    const response = await assets.fetch(new Request(assetUrl, request));
    if (response.status < 300 || response.status >= 400) return response;

    const location = response.headers.get("location");
    if (!location) return response;
    const nextUrl = new URL(location, assetUrl);
    if (nextUrl.origin !== assetUrl.origin || !nextUrl.pathname.startsWith("/songak/representative-greeting-editor")) {
      return response;
    }
    assetUrl = nextUrl;
  }

  return new Response("Public page asset redirect loop", { status: 502 });
}

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
  } else if (pathname.endsWith("/representative-greeting-editor.html") || pathname.endsWith("/representative-greeting-editor") || pathname.endsWith("/representative-greeting-public.html") || pathname.includes("/public-")) {
    secured.headers.set("cache-control", "public, no-cache, must-revalidate");
  }
  return secured;
}

export default worker;
