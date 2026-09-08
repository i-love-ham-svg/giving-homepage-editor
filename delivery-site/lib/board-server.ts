import { env } from "cloudflare:workers";
import type { BoardMedia, BoardPost, Category, PostStatus } from "./board-types";
import { CATEGORIES, STATUSES } from "./board-types";

type BoardEnv = {
  DB: D1Database;
  MEDIA: R2Bucket;
  TEMP_EDITOR_ID?: string;
  TEMP_EDITOR_PASSWORD?: string;
  BOARD_SESSION_SECRET?: string;
  BOARD_HASH_PEPPER?: string;
  BOARD_EDITOR_EMAILS?: string;
};

type D1Row = Record<string, unknown>;
type MediaInput = { id?: unknown; claimToken?: unknown; alt?: unknown };
type StoredMedia = {
  id: string;
  postId: string | null;
  objectKey: string;
  ownerTokenHash: string;
  status: string;
  alt: string;
};
type DesiredMedia = StoredMedia & { alt: string; newlyAttached: boolean };
type MediaDeletion = StoredMedia & { kind: "post" | "temporary" };
type MediaUpdatePlan = {
  desired: DesiredMedia[];
  deletions: MediaDeletion[];
  thumbnailMediaId: string | null;
};

export const ADMIN_COOKIE = "songak_board_admin";
const encoder = new TextEncoder();
const categoryIds = new Set(CATEGORIES.map((entry) => entry.id));
const statusIds = new Set(STATUSES);
let schemaReady: Promise<unknown> | null = null;

export function getBoardEnv(): BoardEnv {
  const runtime = env as unknown as BoardEnv;
  if (!runtime.DB || !runtime.MEDIA) throw new Error("게시판 저장소가 연결되지 않았습니다.");
  return runtime;
}

export function ensureBoardSchema(): Promise<unknown> {
  if (schemaReady) return schemaReady;
  const { DB } = getBoardEnv();
  const statements = [
    `CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY NOT NULL, category TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
      title TEXT NOT NULL, body TEXT NOT NULL, author TEXT NOT NULL, contact TEXT NOT NULL DEFAULT '',
      password_salt TEXT NOT NULL DEFAULT '', password_hash TEXT NOT NULL DEFAULT '', thumbnail_media_id TEXT,
      pinned INTEGER NOT NULL DEFAULT 0, official INTEGER NOT NULL DEFAULT 0, views INTEGER NOT NULL DEFAULT 0,
      report_count INTEGER NOT NULL DEFAULT 0, share_count INTEGER NOT NULL DEFAULT 0, moderation_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      published_at TEXT, deleted_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY NOT NULL, post_id TEXT REFERENCES posts(id), object_key TEXT NOT NULL, kind TEXT NOT NULL,
      content_type TEXT NOT NULL, original_name TEXT NOT NULL, byte_size INTEGER NOT NULL, alt_text TEXT NOT NULL DEFAULT '',
      owner_token_hash TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'temporary', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY NOT NULL, post_id TEXT NOT NULL REFERENCES posts(id), reporter_hash TEXT NOT NULL,
      reason TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY NOT NULL, action TEXT NOT NULL, target_type TEXT NOT NULL, target_id TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT '', actor_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS rate_limits (
      scope TEXT NOT NULL, actor_hash TEXT NOT NULL, bucket INTEGER NOT NULL, count INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(scope, actor_hash, bucket)
    )`,
    "CREATE INDEX IF NOT EXISTS idx_posts_public_feed ON posts(status, pinned, published_at)",
    "CREATE INDEX IF NOT EXISTS idx_posts_category_status ON posts(category, status, published_at)",
    "CREATE INDEX IF NOT EXISTS idx_posts_moderation_queue ON posts(status, created_at)",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_media_object_key ON media(object_key)",
    "CREATE INDEX IF NOT EXISTS idx_media_post_id ON media(post_id)",
    "CREATE INDEX IF NOT EXISTS idx_media_temporary ON media(status, created_at)",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_post_reporter ON reports(post_id, reporter_hash)",
    "CREATE INDEX IF NOT EXISTS idx_reports_post_id ON reports(post_id)",
    "CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_type, target_id, created_at)",
    "CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)",
    "CREATE INDEX IF NOT EXISTS idx_rate_limits_updated_at ON rate_limits(updated_at)",
    `INSERT OR IGNORE INTO posts (id, category, status, title, body, author, pinned, official, published_at)
      VALUES ('welcome-notice', 'notice', 'published', '송악사회복지관 소통게시판을 시작합니다',
      '복지관의 새로운 소식과 주민 여러분의 따뜻한 이야기를 한곳에서 나눌 수 있습니다. 주민 게시글은 안전한 운영을 위해 관리자 확인 후 공개됩니다.',
      '송악사회복지관', 1, 1, CURRENT_TIMESTAMP)`,
  ];
  schemaReady = DB.batch(statements.map((statement) => DB.prepare(statement))).catch((error) => {
    schemaReady = null;
    throw error;
  });
  return schemaReady;
}

export function cleanText(value: unknown, maxLength = 10_000): string {
  return String(value ?? "").replace(/\u0000/g, "").replace(/\r\n?/g, "\n").trim().slice(0, maxLength);
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new Error("허용되지 않은 요청입니다.");
}

export async function readJson<T = Record<string, unknown>>(request: Request, maxBytes = 1_000_000): Promise<T> {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > maxBytes) throw new Error("요청 용량이 너무 큽니다.");
  const text = await request.text();
  if (encoder.encode(text).byteLength > maxBytes) throw new Error("요청 용량이 너무 큽니다.");
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("요청 내용을 확인할 수 없습니다.");
  }
}

function bytesToBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

function base64UrlToBytes(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, "base64url"));
}

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

export async function hashClaimToken(value: string): Promise<string> {
  return bytesToBase64Url(await sha256(value));
}

async function hmac(secret: string, value: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

async function safeEqual(left: string, right: string): Promise<boolean> {
  const [a, b] = await Promise.all([sha256(left), sha256(right)]);
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) difference |= a[i] ^ b[i];
  return difference === 0;
}

function cookieValue(request: Request, name: string): string {
  const cookies = request.headers.get("cookie") || "";
  for (const item of cookies.split(";")) {
    const [key, ...value] = item.trim().split("=");
    if (key === name) return value.join("=");
  }
  return "";
}

function requireSecret(value: string | undefined, label: string): string {
  if (!value || value.length < 12) throw new Error(`${label} 설정이 필요합니다.`);
  return value;
}

function requireConfigured(value: string | undefined, label: string): string {
  if (!value) throw new Error(`${label} 설정이 필요합니다.`);
  return value;
}

export async function createAdminSession(id: string, password: string): Promise<string> {
  const runtime = getBoardEnv();
  const expectedId = requireConfigured(runtime.TEMP_EDITOR_ID, "임시 담당자 아이디");
  const expectedPassword = requireSecret(runtime.TEMP_EDITOR_PASSWORD, "임시 담당자 비밀번호");
  const [idMatches, passwordMatches] = await Promise.all([
    safeEqual(id, expectedId),
    safeEqual(password, expectedPassword),
  ]);
  if (!idMatches || !passwordMatches) throw new Error("아이디 또는 비밀번호가 올바르지 않습니다.");
  const payload = bytesToBase64Url(encoder.encode(JSON.stringify({
    role: "admin",
    subject: "temporary-editor",
    exp: Date.now() + 8 * 60 * 60 * 1000,
  })));
  const signature = bytesToBase64Url(await hmac(requireSecret(runtime.BOARD_SESSION_SECRET, "관리자 세션"), payload));
  return `${payload}.${signature}`;
}

async function hasValidAdminCookie(request: Request): Promise<boolean> {
  const token = cookieValue(request, ADMIN_COOKIE);
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return false;
  let expectedSignature: string;
  try {
    expectedSignature = bytesToBase64Url(await hmac(
      requireSecret(getBoardEnv().BOARD_SESSION_SECRET, "관리자 세션"),
      payload,
    ));
  } catch {
    return false;
  }
  if (!(await safeEqual(signature, expectedSignature))) return false;
  try {
    const session = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload))) as {
      role?: unknown;
      subject?: unknown;
      exp?: unknown;
    };
    return session.role === "admin"
      && session.subject === "temporary-editor"
      && typeof session.exp === "number"
      && session.exp > Date.now();
  } catch {
    return false;
  }
}

export async function isAdminRequest(request: Request): Promise<boolean> {
  if (await hasValidAdminCookie(request)) return true;
  const authenticatedEmail = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  const authenticatedUserId = request.headers.get("oai-authenticated-user-id")?.trim();
  if (authenticatedEmail && authenticatedUserId) {
    const allowlist = (getBoardEnv().BOARD_EDITOR_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
    return allowlist.includes(authenticatedEmail);
  }

  return false;
}

export async function getEditorSession(request: Request): Promise<{
  authenticated: boolean;
  authorized: boolean;
  email: string | null;
}> {
  const temporaryEditor = await hasValidAdminCookie(request);
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() || null;
  const userId = request.headers.get("oai-authenticated-user-id")?.trim() || null;
  return {
    authenticated: temporaryEditor || Boolean(email && userId),
    authorized: temporaryEditor || await isAdminRequest(request),
    email: temporaryEditor ? null : email,
  };
}

export function adminCookie(token: string, secure = true): string {
  return `${ADMIN_COOKIE}=${token}; Path=/; HttpOnly;${secure ? " Secure;" : ""} SameSite=Lax; Max-Age=28800`;
}

export function clearAdminCookie(secure = true): string {
  return `${ADMIN_COOKIE}=; Path=/; HttpOnly;${secure ? " Secure;" : ""} SameSite=Lax; Max-Age=0`;
}

export async function actorHash(request: Request, suffix = ""): Promise<string> {
  const runtime = getBoardEnv();
  const pepper = requireSecret(runtime.BOARD_HASH_PEPPER, "보안 해시");
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0] || "local";
  const agent = request.headers.get("user-agent") || "unknown";
  return bytesToBase64Url(await hmac(pepper, `${ip}|${agent}|${suffix}`));
}

export async function enforceRateLimit(request: Request, scope: string, limit: number, windowMs: number): Promise<void> {
  await ensureBoardSchema();
  const { DB } = getBoardEnv();
  const actor = await actorHash(request);
  const bucket = Math.floor(Date.now() / windowMs);
  const row = await DB.prepare(`
    INSERT INTO rate_limits (scope, actor_hash, bucket, count, updated_at)
    VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
    ON CONFLICT(scope, actor_hash, bucket)
    DO UPDATE SET count = count + 1, updated_at = CURRENT_TIMESTAMP
    RETURNING count
  `).bind(scope, actor, bucket).first<{ count: number }>();
  if ((row?.count ?? 1) > limit) throw new Error("요청이 너무 많습니다. 잠시 후 다시 이용해 주세요.");
}

export async function createVisitorPassword(password: string): Promise<{ salt: string; hash: string }> {
  if (password.length < 6 || password.length > 32) throw new Error("수정·삭제 비밀번호는 6~32자로 입력해 주세요.");
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: saltBytes, iterations: 120_000 }, key, 256);
  return { salt: bytesToBase64Url(saltBytes), hash: bytesToBase64Url(new Uint8Array(bits)) };
}

export async function verifyVisitorPassword(password: string, salt: string, expected: string): Promise<boolean> {
  if (!password || !salt || !expected) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const saltBytes = Uint8Array.from(base64UrlToBytes(salt));
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: saltBytes.buffer, iterations: 120_000 }, key, 256);
  return safeEqual(bytesToBase64Url(new Uint8Array(bits)), expected);
}

export function parseCategory(value: unknown, isAdmin: boolean): Category {
  const category = cleanText(value, 20) as Category;
  if (!categoryIds.has(category)) throw new Error("게시글 분류를 선택해 주세요.");
  if (!isAdmin && (category === "notice" || category === "welfare")) throw new Error("공식 소식은 관리자만 작성할 수 있습니다.");
  return category;
}

export function parseStatus(value: unknown): PostStatus {
  const status = cleanText(value, 20) as PostStatus;
  if (!statusIds.has(status) || status === "deleted") throw new Error("처리 상태를 확인해 주세요.");
  return status;
}

function mapMedia(row: D1Row): BoardMedia {
  return {
    id: String(row.id),
    kind: row.kind === "video" ? "video" : "image",
    type: String(row.content_type),
    name: String(row.original_name),
    size: Number(row.byte_size) || 0,
    url: `/api/media/${encodeURIComponent(String(row.id))}`,
    alt: String(row.alt_text || ""),
  };
}

function mapPost(row: D1Row, attached: BoardMedia[], admin: boolean): BoardPost {
  const result: BoardPost = {
    id: String(row.id),
    category: row.category as Category,
    status: row.status as PostStatus,
    title: String(row.title),
    body: String(row.body),
    author: String(row.author),
    media: attached,
    thumbnailMediaId: row.thumbnail_media_id ? String(row.thumbnail_media_id) : null,
    pinned: Boolean(row.pinned),
    official: Boolean(row.official),
    views: Number(row.views) || 0,
    reportCount: Number(row.report_count) || 0,
    shareCount: Number(row.share_count) || 0,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    publishedAt: row.published_at ? String(row.published_at) : null,
  };
  if (admin) {
    result.contact = String(row.contact || "");
    result.moderationNote = String(row.moderation_note || "");
  }
  return result;
}

async function mediaForPosts(postIds: string[]): Promise<Map<string, BoardMedia[]>> {
  const grouped = new Map<string, BoardMedia[]>();
  if (!postIds.length) return grouped;
  const { results = [] } = await getBoardEnv().DB.prepare(`
    SELECT id, post_id, kind, content_type, original_name, byte_size, alt_text
    FROM media
    WHERE status = 'attached' AND post_id IN (${postIds.map(() => "?").join(",")})
    ORDER BY created_at ASC
  `).bind(...postIds).all<D1Row>();
  for (const row of results) {
    const key = String(row.post_id);
    const list = grouped.get(key) || [];
    list.push(mapMedia(row));
    grouped.set(key, list);
  }
  return grouped;
}

export async function listPosts(request: Request): Promise<Record<string, unknown>> {
  await ensureBoardSchema();
  const admin = await isAdminRequest(request);
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.min(24, Math.max(1, Number(url.searchParams.get("pageSize")) || 9));
  const category = cleanText(url.searchParams.get("category"), 20);
  const search = cleanText(url.searchParams.get("search"), 100);
  const sort = url.searchParams.get("sort") === "views" ? "views DESC, published_at DESC" : "pinned DESC, COALESCE(published_at, created_at) DESC";
  const requestedStatus = cleanText(url.searchParams.get("status"), 20);
  const status = admin && statusIds.has(requestedStatus as PostStatus) ? requestedStatus : admin && requestedStatus === "all" ? "all" : "published";
  const where: string[] = ["status != 'deleted'"];
  const values: unknown[] = [];
  if (status !== "all") { where.push("status = ?"); values.push(status); }
  if (categoryIds.has(category as Category)) { where.push("category = ?"); values.push(category); }
  if (search) {
    where.push("(title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\' OR author LIKE ? ESCAPE '\\')");
    const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
    values.push(pattern, pattern, pattern);
  }
  const sqlWhere = where.join(" AND ");
  const { DB } = getBoardEnv();
  const count = await DB.prepare(`SELECT COUNT(*) AS total FROM posts WHERE ${sqlWhere}`).bind(...values).first<{ total: number }>();
  const total = Number(count?.total) || 0;
  const { results = [] } = await DB.prepare(`
    SELECT * FROM posts WHERE ${sqlWhere}
    ORDER BY ${sort}
    LIMIT ? OFFSET ?
  `).bind(...values, pageSize, (page - 1) * pageSize).all<D1Row>();
  const grouped = await mediaForPosts(results.map((row) => String(row.id)));
  return {
    items: results.map((row) => mapPost(row, grouped.get(String(row.id)) || [], admin)),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    admin,
  };
}

export async function getPost(request: Request, id: string, incrementView = false): Promise<BoardPost | null> {
  await ensureBoardSchema();
  const admin = await isAdminRequest(request);
  const { DB } = getBoardEnv();
  const row = await DB.prepare("SELECT * FROM posts WHERE id = ? AND status != 'deleted'").bind(id).first<D1Row>();
  if (!row || (!admin && row.status !== "published")) return null;
  if (incrementView && !admin) {
    await DB.prepare("UPDATE posts SET views = views + 1 WHERE id = ?").bind(id).run();
    row.views = Number(row.views) + 1;
  }
  const grouped = await mediaForPosts([id]);
  return mapPost(row, grouped.get(id) || [], admin);
}

async function validateMediaInputs(inputs: MediaInput[], admin: boolean): Promise<{ id: string; alt: string }[]> {
  if (inputs.length > 12) throw new Error("사진과 영상은 합계 12개까지 등록할 수 있습니다.");
  const output: { id: string; alt: string }[] = [];
  for (const item of inputs) {
    const id = cleanText(item.id, 80);
    if (!id) continue;
    const row = await getBoardEnv().DB.prepare("SELECT id, owner_token_hash, status FROM media WHERE id = ?").bind(id).first<D1Row>();
    if (!row || row.status !== "temporary") throw new Error("첨부파일 정보를 확인해 주세요.");
    if (!admin) {
      const claim = cleanText(item.claimToken, 160);
      if (!claim || !(await safeEqual(bytesToBase64Url(await sha256(claim)), String(row.owner_token_hash)))) throw new Error("첨부파일 소유 정보를 확인해 주세요.");
    }
    output.push({ id, alt: cleanText(item.alt, 240) });
  }
  return output;
}

function storedMedia(row: D1Row): StoredMedia {
  return {
    id: String(row.id),
    postId: row.post_id == null ? null : String(row.post_id),
    objectKey: String(row.object_key),
    ownerTokenHash: String(row.owner_token_hash),
    status: String(row.status),
    alt: String(row.alt_text || ""),
  };
}

async function requireMediaClaim(item: MediaInput, media: StoredMedia, admin: boolean): Promise<void> {
  if (admin) return;
  const claim = cleanText(item.claimToken, 160);
  if (!claim || !(await safeEqual(bytesToBase64Url(await sha256(claim)), media.ownerTokenHash))) {
    throw new Error("첨부파일 소유 정보를 확인해 주세요.");
  }
}

async function readStoredMedia(mediaId: string): Promise<StoredMedia | null> {
  const row = await getBoardEnv().DB.prepare(`
    SELECT id, post_id, object_key, owner_token_hash, status, alt_text
    FROM media WHERE id = ?
  `).bind(mediaId).first<D1Row>();
  return row ? storedMedia(row) : null;
}

async function prepareMediaUpdate(
  postId: string,
  input: Record<string, unknown>,
  currentThumbnailMediaId: string | null,
  admin: boolean,
): Promise<MediaUpdatePlan> {
  if (input.media != null && !Array.isArray(input.media)) throw new Error("첨부파일 정보를 확인해 주세요.");
  if (input.discardedMedia != null && !Array.isArray(input.discardedMedia)) throw new Error("첨부파일 정보를 확인해 주세요.");

  const { results: currentRows = [] } = await getBoardEnv().DB.prepare(`
    SELECT id, post_id, object_key, owner_token_hash, status, alt_text
    FROM media
    WHERE post_id = ? AND status IN ('attached', 'pending_delete')
    ORDER BY created_at ASC
  `).bind(postId).all<D1Row>();
  const current = currentRows.map(storedMedia);
  const currentAttached = current.filter((item) => item.status === "attached");
  const requested = Array.isArray(input.media) ? input.media as MediaInput[] : null;
  if ((requested?.length || currentAttached.length) > 12) throw new Error("사진과 영상은 합계 12개까지 등록할 수 있습니다.");

  const desired: DesiredMedia[] = [];
  const desiredIds = new Set<string>();
  if (requested) {
    for (const rawItem of requested) {
      if (!rawItem || typeof rawItem !== "object") throw new Error("첨부파일 정보를 확인해 주세요.");
      const item = rawItem as MediaInput;
      const mediaId = cleanText(item.id, 80);
      if (!mediaId || desiredIds.has(mediaId)) throw new Error("첨부파일 정보를 확인해 주세요.");
      const media = await readStoredMedia(mediaId);
      if (!media) throw new Error("첨부파일 정보를 확인해 주세요.");
      if (media.status === "attached") {
        if (media.postId !== postId) throw new Error("다른 게시글의 첨부파일은 사용할 수 없습니다.");
        desired.push({ ...media, alt: cleanText(item.alt, 240), newlyAttached: false });
      } else if (media.status === "temporary") {
        await requireMediaClaim(item, media, admin);
        desired.push({ ...media, alt: cleanText(item.alt, 240), newlyAttached: true });
      } else {
        throw new Error("첨부파일 정보를 확인해 주세요.");
      }
      desiredIds.add(mediaId);
    }
  } else {
    for (const media of currentAttached) {
      desired.push({ ...media, newlyAttached: false });
      desiredIds.add(media.id);
    }
  }

  const deletions: MediaDeletion[] = current
    .filter((media) => !desiredIds.has(media.id) && (requested != null || media.status === "pending_delete"))
    .map((media) => ({ ...media, kind: "post" as const }));
  const deletionIds = new Set(deletions.map((media) => media.id));
  const discarded = Array.isArray(input.discardedMedia) ? input.discardedMedia as MediaInput[] : [];
  if (discarded.length > 12) throw new Error("첨부파일 정보를 확인해 주세요.");
  for (const rawItem of discarded) {
    if (!rawItem || typeof rawItem !== "object") throw new Error("첨부파일 정보를 확인해 주세요.");
    const item = rawItem as MediaInput;
    const mediaId = cleanText(item.id, 80);
    if (!mediaId || desiredIds.has(mediaId) || deletionIds.has(mediaId)) throw new Error("첨부파일 정보를 확인해 주세요.");
    const media = await readStoredMedia(mediaId);
    if (!media || !["temporary", "pending_delete", "deleted"].includes(media.status) || media.postId) {
      throw new Error("첨부파일 정보를 확인해 주세요.");
    }
    await requireMediaClaim(item, media, admin);
    deletions.push({ ...media, kind: "temporary" });
    deletionIds.add(mediaId);
  }

  const requestedThumbnail = input.thumbnailMediaId == null ? "" : cleanText(input.thumbnailMediaId, 80);
  if (requestedThumbnail && !desiredIds.has(requestedThumbnail)) throw new Error("대표 첨부파일 정보를 확인해 주세요.");
  const thumbnailMediaId = desired.length === 0
    ? null
    : requestedThumbnail || (requested == null && currentThumbnailMediaId && desiredIds.has(currentThumbnailMediaId)
      ? currentThumbnailMediaId
      : desired[0].id);
  return { desired, deletions, thumbnailMediaId };
}

export async function createPost(request: Request): Promise<BoardPost> {
  await ensureBoardSchema();
  const admin = await isAdminRequest(request);
  if (!admin) await enforceRateLimit(request, "create-post", 4, 10 * 60 * 1000);
  const input = await readJson<Record<string, unknown>>(request);
  if (cleanText(input.website, 200)) throw new Error("요청을 처리할 수 없습니다.");
  const category = parseCategory(input.category, admin);
  const title = cleanText(input.title, 160);
  const body = cleanText(input.body, 20_000);
  const author = cleanText(input.author, 40);
  if (title.length < 2 || body.length < 10 || !author) throw new Error("제목, 내용, 작성자를 확인해 주세요.");
  const attachments = await validateMediaInputs(Array.isArray(input.media) ? input.media as MediaInput[] : [], admin);
  const thumbnailMediaId = attachments.some((item) => item.id === input.thumbnailMediaId) ? String(input.thumbnailMediaId) : attachments[0]?.id || null;
  const password = admin ? { salt: "", hash: "" } : await createVisitorPassword(String(input.password || ""));
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const status = admin ? "published" : "pending";
  const actor = await actorHash(request, admin ? "admin" : "visitor");
  const { DB } = getBoardEnv();
  const statements = [
    DB.prepare(`
      INSERT INTO posts (
        id, category, status, title, body, author, contact, password_salt, password_hash,
        thumbnail_media_id, pinned, official, created_at, updated_at, published_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, category, status, title, body, author, cleanText(input.contact, 120), password.salt, password.hash,
      thumbnailMediaId, admin && Boolean(input.pinned) ? 1 : 0, admin ? 1 : 0, now, now, admin ? now : null),
    ...attachments.map((item) => DB.prepare("UPDATE media SET post_id = ?, status = 'attached', alt_text = ? WHERE id = ?").bind(id, item.alt, item.id)),
    DB.prepare("INSERT INTO audit_logs (id, action, target_type, target_id, detail, actor_hash, created_at) VALUES (?, ?, 'post', ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), admin ? "publish" : "submit", id, JSON.stringify({ category }), actor, now),
  ];
  await DB.batch(statements);
  const post = await getPost(request, id);
  if (!post) {
    const row = await DB.prepare("SELECT * FROM posts WHERE id = ?").bind(id).first<D1Row>();
    const grouped = await mediaForPosts([id]);
    return mapPost(row!, grouped.get(id) || [], admin);
  }
  return post;
}

export async function updatePost(request: Request, id: string): Promise<BoardPost | null> {
  await ensureBoardSchema();
  const admin = await isAdminRequest(request);
  const input = await readJson<Record<string, unknown>>(request);
  const { DB } = getBoardEnv();
  const row = await DB.prepare("SELECT * FROM posts WHERE id = ? AND status != 'deleted'").bind(id).first<D1Row>();
  if (!row) return null;
  if (!admin && !(await verifyVisitorPassword(String(input.password || ""), String(row.password_salt), String(row.password_hash)))) {
    throw new Error("게시글 비밀번호가 올바르지 않습니다.");
  }
  const title = cleanText(input.title ?? row.title, 160);
  const body = cleanText(input.body ?? row.body, 20_000);
  const author = cleanText(input.author ?? row.author, 40);
  if (title.length < 2 || body.length < 10 || !author) throw new Error("제목, 내용, 작성자를 확인해 주세요.");
  const category = input.category == null ? row.category as Category : parseCategory(input.category, admin);
  const status = admin ? row.status : "pending";
  const now = new Date().toISOString();
  const mediaPlan = await prepareMediaUpdate(id, input, row.thumbnail_media_id ? String(row.thumbnail_media_id) : null, admin);
  const statements = [
    DB.prepare(`
      UPDATE posts SET category = ?, status = ?, title = ?, body = ?, author = ?, contact = ?, pinned = ?,
        thumbnail_media_id = ?, updated_at = ?, published_at = CASE WHEN ? = 'pending' THEN NULL ELSE published_at END
      WHERE id = ?
    `).bind(category, status, title, body, author, cleanText(input.contact ?? row.contact, 120), admin && Boolean(input.pinned ?? row.pinned) ? 1 : 0,
      mediaPlan.thumbnailMediaId, now, status, id),
    ...mediaPlan.desired.map((media) => media.newlyAttached
      ? DB.prepare(`
          UPDATE media SET post_id = ?, status = 'attached', alt_text = ?
          WHERE id = ? AND status = 'temporary' AND owner_token_hash = ?
        `).bind(id, media.alt, media.id, media.ownerTokenHash)
      : DB.prepare(`
          UPDATE media SET alt_text = ?
          WHERE id = ? AND post_id = ? AND status = 'attached'
        `).bind(media.alt, media.id, id)),
    ...mediaPlan.deletions.filter((media) => media.status !== "deleted").map((media) => media.kind === "post"
      ? DB.prepare(`
          UPDATE media SET status = 'pending_delete'
          WHERE id = ? AND post_id = ? AND status IN ('attached', 'pending_delete')
        `).bind(media.id, id)
      : DB.prepare(`
          UPDATE media SET status = 'pending_delete'
          WHERE id = ? AND post_id IS NULL AND status IN ('temporary', 'pending_delete') AND owner_token_hash = ?
        `).bind(media.id, media.ownerTokenHash)),
  ];
  await DB.batch(statements);

  const attachedAfterUpdate = (await mediaForPosts([id])).get(id) || [];
  const attachedById = new Map(attachedAfterUpdate.map((media) => [media.id, media]));
  const mediaStoredExactly = attachedAfterUpdate.length === mediaPlan.desired.length
    && mediaPlan.desired.every((media) => attachedById.get(media.id)?.alt === media.alt);
  const postAfterUpdate = await DB.prepare("SELECT * FROM posts WHERE id = ?").bind(id).first<D1Row>();
  if (!mediaStoredExactly || !postAfterUpdate || (postAfterUpdate.thumbnail_media_id == null ? null : String(postAfterUpdate.thumbnail_media_id)) !== mediaPlan.thumbnailMediaId) {
    throw new Error("첨부파일을 저장하지 못했습니다. 다시 시도해 주세요.");
  }

  if (mediaPlan.deletions.length > 0) {
    await Promise.all(mediaPlan.deletions.map((media) => getBoardEnv().MEDIA.delete(media.objectKey)));
    await DB.batch(mediaPlan.deletions.map((media) => DB.prepare(`
      UPDATE media SET post_id = NULL, status = 'deleted'
      WHERE id = ? AND status IN ('pending_delete', 'deleted')
    `).bind(media.id)));
  }
  await logAudit(request, "update", "post", id, { status });
  const updated = await DB.prepare("SELECT * FROM posts WHERE id = ?").bind(id).first<D1Row>();
  if (!updated) return null;
  const grouped = await mediaForPosts([id]);
  return mapPost(updated, grouped.get(id) || [], admin);
}

export async function claimVisitorPost(request: Request, id: string): Promise<BoardPost | null> {
  await ensureBoardSchema();
  const input = await readJson<Record<string, unknown>>(request, 4_096);
  const { DB } = getBoardEnv();
  const row = await DB.prepare("SELECT * FROM posts WHERE id = ? AND status != 'deleted'").bind(id).first<D1Row>();
  if (!row) return null;
  if (!(await verifyVisitorPassword(String(input.password || ""), String(row.password_salt), String(row.password_hash)))) {
    throw new Error("게시글 번호 또는 비밀번호가 올바르지 않습니다.");
  }
  const grouped = await mediaForPosts([id]);
  const item = mapPost(row, grouped.get(id) || [], false);
  item.contact = String(row.contact || "");
  item.moderationNote = String(row.moderation_note || "");
  return item;
}

export async function deletePost(request: Request, id: string): Promise<boolean> {
  await ensureBoardSchema();
  const admin = await isAdminRequest(request);
  const input = await readJson<Record<string, unknown>>(request);
  const { DB } = getBoardEnv();
  const row = await DB.prepare("SELECT * FROM posts WHERE id = ? AND status != 'deleted'").bind(id).first<D1Row>();
  if (!row) return false;
  if (!admin && !(await verifyVisitorPassword(String(input.password || ""), String(row.password_salt), String(row.password_hash)))) {
    throw new Error("게시글 비밀번호가 올바르지 않습니다.");
  }
  const now = new Date().toISOString();
  await DB.prepare("UPDATE posts SET status = 'deleted', deleted_at = ?, updated_at = ? WHERE id = ?").bind(now, now, id).run();
  await logAudit(request, "delete", "post", id, {});
  return true;
}

export async function moderatePost(request: Request, id: string): Promise<BoardPost | null> {
  await ensureBoardSchema();
  if (!(await isAdminRequest(request))) throw new Error("관리자 로그인이 필요합니다.");
  const input = await readJson<Record<string, unknown>>(request);
  const status = parseStatus(input.status);
  const note = cleanText(input.note, 500);
  const now = new Date().toISOString();
  const result = await getBoardEnv().DB.prepare(`
    UPDATE posts SET status = ?, moderation_note = ?, updated_at = ?,
      published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, ?) ELSE NULL END
    WHERE id = ? AND status != 'deleted'
  `).bind(status, note, now, status, now, id).run();
  if (!result.meta.changes) return null;
  await logAudit(request, `moderate:${status}`, "post", id, { note });
  return getPost(request, id);
}

export async function reportPost(request: Request, id: string): Promise<number> {
  await ensureBoardSchema();
  await enforceRateLimit(request, "report-post", 5, 24 * 60 * 60 * 1000);
  const input = await readJson<Record<string, unknown>>(request);
  const reason = cleanText(input.reason, 300);
  if (reason.length < 2) throw new Error("신고 사유를 입력해 주세요.");
  const { DB } = getBoardEnv();
  const post = await DB.prepare("SELECT id FROM posts WHERE id = ? AND status = 'published'").bind(id).first();
  if (!post) throw new Error("게시글을 찾을 수 없습니다.");
  const reporter = await actorHash(request, new Date().toISOString().slice(0, 10));
  try {
    await DB.batch([
      DB.prepare("INSERT INTO reports (id, post_id, reporter_hash, reason, created_at) VALUES (?, ?, ?, ?, ?)")
        .bind(crypto.randomUUID(), id, reporter, reason, new Date().toISOString()),
      DB.prepare("UPDATE posts SET report_count = report_count + 1 WHERE id = ?").bind(id),
    ]);
  } catch (error) {
    if (String(error).includes("UNIQUE")) throw new Error("오늘 이미 신고한 게시글입니다.");
    throw error;
  }
  const row = await DB.prepare("SELECT report_count FROM posts WHERE id = ?").bind(id).first<{ report_count: number }>();
  return Number(row?.report_count) || 0;
}

export async function registerShare(request: Request, id: string): Promise<void> {
  await ensureBoardSchema();
  await enforceRateLimit(request, "share-post", 30, 60 * 60 * 1000);
  await getBoardEnv().DB.prepare("UPDATE posts SET share_count = share_count + 1 WHERE id = ? AND status = 'published'").bind(id).run();
}

export async function logAudit(request: Request, action: string, targetType: string, targetId: string, detail: unknown): Promise<void> {
  await ensureBoardSchema();
  const actor = await actorHash(request, await isAdminRequest(request) ? "admin" : "visitor");
  await getBoardEnv().DB.prepare(`
    INSERT INTO audit_logs (id, action, target_type, target_id, detail, actor_hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(crypto.randomUUID(), action, targetType, targetId, JSON.stringify(detail), actor, new Date().toISOString()).run();
}

export function routeError(error: unknown): Response {
  const message = error instanceof Error ? error.message : "요청을 처리하지 못했습니다.";
  const status = /로그인|비밀번호/.test(message) ? 401
    : /너무 많/.test(message) ? 429
      : /용량/.test(message) ? 413
        : /연결되지|설정이 필요/.test(message) ? 503 : 400;
  return json({ error: message }, { status });
}
