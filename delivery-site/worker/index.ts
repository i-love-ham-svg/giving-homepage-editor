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

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      const publicUrl = new URL("/songak/representative-greeting-editor.html", request.url);
      publicUrl.search = url.search;
      const publicResponse = await env.ASSETS.fetch(new Request(publicUrl, request));
      return withSecurityHeaders(publicResponse, "/songak/representative-greeting-editor.html");
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
  } else if (/^\/songak\/.*\.(?:css|js)$/.test(pathname)) {
    secured.headers.set("cache-control", "public, max-age=86400");
  } else if (pathname.endsWith("/representative-greeting-editor.html")) {
    secured.headers.set("cache-control", "public, max-age=300, stale-while-revalidate=3600");
  }
  return secured;
}

export default worker;
