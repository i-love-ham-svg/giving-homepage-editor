import { actorHash, cleanText, enforceRateLimit, ensureBoardSchema, getBoardEnv, hashClaimToken, isAdminRequest, json } from "./board-server";
import type { BoardMedia } from "./board-types";

type MediaConfig = { kind: "image" | "video"; extension: string; max: number };
const allowedTypes: Record<string, MediaConfig> = {
  "image/jpeg": { kind: "image", extension: "jpg", max: 15 * 1024 * 1024 },
  "image/png": { kind: "image", extension: "png", max: 15 * 1024 * 1024 },
  "image/webp": { kind: "image", extension: "webp", max: 15 * 1024 * 1024 },
  "image/gif": { kind: "image", extension: "gif", max: 15 * 1024 * 1024 },
  "video/mp4": { kind: "video", extension: "mp4", max: 100 * 1024 * 1024 },
  "video/webm": { kind: "video", extension: "webm", max: 100 * 1024 * 1024 },
};

function matchesSignature(type: string, bytes: Uint8Array): boolean {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10";
  if (type === "image/gif") return new TextDecoder().decode(bytes.slice(0, 6)).startsWith("GIF8");
  if (type === "image/webp") return new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  if (type === "video/mp4") return new TextDecoder().decode(bytes.slice(4, 8)) === "ftyp";
  if (type === "video/webm") return bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  return false;
}

function rebuildStream(first: Uint8Array, reader: ReadableStreamDefaultReader<Uint8Array>): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(first);
      const pump = async (): Promise<void> => {
        try {
          const { value, done } = await reader.read();
          if (done) return controller.close();
          if (value) controller.enqueue(value);
          await pump();
        } catch (error) {
          controller.error(error);
        }
      };
      void pump();
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

function randomToken(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
}

export async function uploadMedia(request: Request): Promise<BoardMedia> {
  await ensureBoardSchema();
  await enforceRateLimit(request, "upload-media", 20, 60 * 60 * 1000);
  const contentType = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const config = allowedTypes[contentType];
  if (!config) throw new Error("JPG·PNG·WEBP·GIF 사진 또는 MP4·WEBM 영상만 등록할 수 있습니다.");
  const size = Number(request.headers.get("content-length") || 0);
  if (!size || size > config.max) throw new Error(`${config.kind === "video" ? "영상" : "사진"}은 ${Math.round(config.max / 1024 / 1024)}MB 이하만 등록할 수 있습니다.`);
  if (!request.body) throw new Error("첨부파일을 읽을 수 없습니다.");
  const reader = request.body.getReader();
  const firstRead = await reader.read();
  if (firstRead.done || !firstRead.value || !matchesSignature(contentType, firstRead.value)) {
    await reader.cancel();
    throw new Error("파일 형식과 실제 내용이 일치하지 않습니다.");
  }
  const id = crypto.randomUUID();
  const now = new Date();
  const objectKey = `board/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${id}.${config.extension}`;
  const originalName = cleanText(decodeURIComponent(request.headers.get("x-file-name") || "media"), 180) || `media.${config.extension}`;
  const claimToken = randomToken();
  const ownerTokenHash = await hashClaimToken(claimToken);
  const { DB, MEDIA } = getBoardEnv();
  const source = rebuildStream(firstRead.value, reader);
  const fixed = new FixedLengthStream(size);
  const piping = source.pipeTo(fixed.writable);
  await Promise.all([
    MEDIA.put(objectKey, fixed.readable, {
      httpMetadata: { contentType, cacheControl: "public, max-age=31536000, immutable" },
      customMetadata: { originalName },
    }),
    piping,
  ]);
  try {
    await DB.prepare(`
      INSERT INTO media (id, object_key, kind, content_type, original_name, byte_size, owner_token_hash, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'temporary', ?)
    `).bind(id, objectKey, config.kind, contentType, originalName, size, ownerTokenHash, now.toISOString()).run();
  } catch (error) {
    await MEDIA.delete(objectKey);
    throw error;
  }
  const actor = await actorHash(request);
  await DB.prepare("INSERT INTO audit_logs (id, action, target_type, target_id, detail, actor_hash, created_at) VALUES (?, 'upload', 'media', ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), id, JSON.stringify({ contentType, size }), actor, now.toISOString()).run();
  return {
    id,
    kind: config.kind,
    type: contentType,
    name: originalName,
    size,
    url: `/api/media/${encodeURIComponent(id)}`,
    alt: "",
    claimToken,
  };
}

export async function serveMedia(request: Request, id: string): Promise<Response> {
  await ensureBoardSchema();
  const { DB, MEDIA } = getBoardEnv();
  const row = await DB.prepare("SELECT object_key, content_type, original_name, status FROM media WHERE id = ? AND status != 'deleted'").bind(id)
    .first<{ object_key: string; content_type: string; original_name: string; status: string }>();
  if (!row) return json({ error: "첨부파일을 찾을 수 없습니다." }, { status: 404 });
  if (row.status === "temporary" && !(await isAdminRequest(request))) {
    const claim = new URL(request.url).searchParams.get("claim") || "";
    const stored = await DB.prepare("SELECT owner_token_hash FROM media WHERE id = ?").bind(id).first<{ owner_token_hash: string }>();
    if (!claim || !stored || (await hashClaimToken(claim)) !== stored.owner_token_hash) return json({ error: "첨부파일 접근 권한이 없습니다." }, { status: 403 });
  }
  const object = await MEDIA.get(row.object_key, { range: request.headers });
  if (!object) return json({ error: "첨부파일을 찾을 수 없습니다." }, { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("accept-ranges", "bytes");
  headers.set("x-content-type-options", "nosniff");
  headers.set("content-disposition", `inline; filename*=UTF-8''${encodeURIComponent(row.original_name)}`);
  const range = object.range as { offset?: number; length?: number } | undefined;
  if (request.headers.has("range") && range && typeof range.offset === "number" && typeof range.length === "number") {
    headers.set("content-range", `bytes ${range.offset}-${range.offset + range.length - 1}/${object.size}`);
    headers.set("content-length", String(range.length));
    return new Response(object.body, { status: 206, headers });
  }
  headers.set("content-length", String(object.size));
  return new Response(object.body, { status: 200, headers });
}
