import { env } from "cloudflare:workers";
import { cleanText, isAdminRequest, json } from "./board-server";

type SiteAssetConfig = { extension: "jpg" | "png" | "webp" | "gif"; maxBytes: number };

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const allowedImageTypes: Record<string, SiteAssetConfig> = {
  "image/jpeg": { extension: "jpg", maxBytes: MAX_IMAGE_BYTES },
  "image/png": { extension: "png", maxBytes: MAX_IMAGE_BYTES },
  "image/webp": { extension: "webp", maxBytes: MAX_IMAGE_BYTES },
  "image/gif": { extension: "gif", maxBytes: MAX_IMAGE_BYTES },
};
const siteAssetIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp|gif)$/;

type SiteAssetEnv = { MEDIA?: R2Bucket };

export type SiteAsset = {
  id: string;
  type: string;
  name: string;
  size: number;
  url: string;
};

function bucket(): R2Bucket {
  const runtime = env as unknown as SiteAssetEnv;
  if (!runtime.MEDIA) throw new SiteAssetError("사이트 이미지 저장소가 연결되지 않았습니다.", 503);
  return runtime.MEDIA;
}

function matchesImageSignature(type: string, bytes: Uint8Array): boolean {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10";
  if (type === "image/gif") return new TextDecoder().decode(bytes.slice(0, 6)).startsWith("GIF8");
  if (type === "image/webp") {
    return new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF"
      && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  }
  return false;
}

function originalFileName(request: Request, extension: string): string {
  const encoded = request.headers.get("x-file-name") || "";
  let decoded = encoded;
  try {
    decoded = decodeURIComponent(encoded);
  } catch {
    decoded = encoded;
  }
  return cleanText(decoded, 180) || `site-image.${extension}`;
}

function objectKey(assetId: string): string {
  if (!siteAssetIdPattern.test(assetId)) throw new SiteAssetError("올바르지 않은 사이트 이미지 주소입니다.", 400);
  return `site-assets/${assetId}`;
}

export async function uploadSiteAsset(request: Request): Promise<SiteAsset> {
  if (!(await isAdminRequest(request))) throw new SiteAssetError("사이트 이미지 편집 권한이 필요합니다.", 403);
  const contentType = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const config = allowedImageTypes[contentType];
  if (!config) throw new SiteAssetError("JPG·PNG·WEBP·GIF 이미지만 등록할 수 있습니다.", 415);

  const declaredSize = Number(request.headers.get("content-length") || 0);
  if (declaredSize > config.maxBytes) throw new SiteAssetError("사이트 이미지는 15MB 이하만 등록할 수 있습니다.", 413);
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (!bytes.byteLength) throw new SiteAssetError("사이트 이미지 파일을 읽을 수 없습니다.", 400);
  if (bytes.byteLength > config.maxBytes) throw new SiteAssetError("사이트 이미지는 15MB 이하만 등록할 수 있습니다.", 413);
  if (!matchesImageSignature(contentType, bytes)) {
    throw new SiteAssetError("파일 형식과 실제 이미지 내용이 일치하지 않습니다.", 415);
  }

  const id = `${crypto.randomUUID()}.${config.extension}`;
  const name = originalFileName(request, config.extension);
  await bucket().put(objectKey(id), bytes, {
    httpMetadata: {
      contentType,
      cacheControl: "public, max-age=31536000, immutable",
    },
    customMetadata: { originalName: name },
  });
  return {
    id,
    type: contentType,
    name,
    size: bytes.byteLength,
    url: `/api/site-assets/${encodeURIComponent(id)}`,
  };
}

export async function serveSiteAsset(request: Request, assetId: string, head = false): Promise<Response> {
  const object = await bucket().get(objectKey(assetId), { range: request.headers });
  if (!object) throw new SiteAssetError("사이트 이미지를 찾을 수 없습니다.", 404);

  if (request.headers.get("if-none-match") === object.httpEtag) {
    return new Response(null, {
      status: 304,
      headers: {
        etag: object.httpEtag,
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("etag", object.httpEtag);
  headers.set("accept-ranges", "bytes");
  headers.set("x-content-type-options", "nosniff");
  headers.set("cross-origin-resource-policy", "same-origin");
  headers.set("content-disposition", `inline; filename*=UTF-8''${encodeURIComponent(assetId)}`);

  const range = object.range as { offset?: number; length?: number } | undefined;
  if (request.headers.has("range") && range && typeof range.offset === "number" && typeof range.length === "number") {
    headers.set("content-range", `bytes ${range.offset}-${range.offset + range.length - 1}/${object.size}`);
    headers.set("content-length", String(range.length));
    return new Response(head ? null : object.body, { status: 206, headers });
  }
  headers.set("content-length", String(object.size));
  return new Response(head ? null : object.body, { status: 200, headers });
}

export class SiteAssetError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export function siteAssetRouteError(error: unknown): Response {
  if (error instanceof SiteAssetError) return json({ error: error.message }, { status: error.status });
  console.error(error);
  return json({ error: "사이트 이미지 처리 중 오류가 발생했습니다." }, { status: 500 });
}
