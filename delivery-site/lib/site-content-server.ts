import { env } from "cloudflare:workers";
import { assertSameOrigin, isAdminRequest, json } from "./board-server";

type SiteContentRow = {
  key: string;
  draft_json: string;
  published_json: string | null;
  revision: number;
  updated_by: string;
  updated_at: string;
  published_at: string | null;
};

// D1 limits a complete row to 2,000,000 bytes. site_documents keeps both the
// draft and the published JSON in one row, so each copy must remain well below
// half of that limit. Images belong in R2 through /api/site-assets.
const MAX_CONTENT_BYTES = 900 * 1024;
const documentKeyPattern = /^[a-z0-9][a-z0-9-]{0,63}$/;
let schemaReady: Promise<unknown> | null = null;

function db(): D1Database {
  const runtime = env as unknown as { DB?: D1Database };
  if (!runtime.DB) throw new Error("홈페이지 저장소가 연결되지 않았습니다.");
  return runtime.DB;
}

export function ensureSiteContentSchema(): Promise<unknown> {
  if (schemaReady) return schemaReady;
  const database = db();
  schemaReady = database.batch([
    database.prepare(`CREATE TABLE IF NOT EXISTS site_documents (
      key TEXT PRIMARY KEY NOT NULL, draft_json TEXT NOT NULL DEFAULT '{}', published_json TEXT,
      revision INTEGER NOT NULL DEFAULT 0, updated_by TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, published_at TEXT
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS site_versions (
      id TEXT PRIMARY KEY NOT NULL, document_key TEXT NOT NULL, revision INTEGER NOT NULL,
      kind TEXT NOT NULL, content_json TEXT NOT NULL, created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (document_key) REFERENCES site_documents(key)
    )`),
    database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_site_versions_document_revision ON site_versions(document_key, revision)"),
    database.prepare("CREATE INDEX IF NOT EXISTS idx_site_versions_document_created ON site_versions(document_key, created_at)"),
  ]).catch((error) => {
    schemaReady = null;
    throw error;
  });
  return schemaReady;
}

function validKey(key: string): string {
  if (!documentKeyPattern.test(key)) throw new SiteContentError("올바르지 않은 문서 키입니다.", 400);
  return key;
}

function parseJson(value: string | null): unknown {
  if (value === null) return null;
  return JSON.parse(value);
}

function serializeContent(content: unknown): string {
  if (content === null || typeof content !== "object" || Array.isArray(content)) {
    throw new SiteContentError("저장할 내용은 JSON 객체여야 합니다.", 400);
  }
  const serialized = JSON.stringify(content);
  if (new TextEncoder().encode(serialized).byteLength > MAX_CONTENT_BYTES) {
    throw new SiteContentError("편집 내용은 900KB까지 저장할 수 있습니다. 이미지는 사이트 이미지 저장소에 올려 주세요.", 413);
  }
  return serialized;
}

function actor(request: Request): string {
  return request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() || "unknown";
}

async function requireEditor(request: Request): Promise<void> {
  if (!(await isAdminRequest(request))) throw new SiteContentError("편집 권한이 있는 로그인이 필요합니다.", 403);
}

async function row(key: string): Promise<SiteContentRow | null> {
  return db().prepare("SELECT * FROM site_documents WHERE key = ?").bind(key).first<SiteContentRow>();
}

export async function getSiteContent(request: Request, keyValue: string): Promise<Response> {
  await ensureSiteContentSchema();
  const key = validKey(keyValue);
  const wantsDraft = new URL(request.url).searchParams.get("mode") === "draft";
  if (wantsDraft) await requireEditor(request);
  const current = await row(key);
  if (!current) return json({ key, content: null, revision: 0, publishedAt: null });
  return json({
    key,
    content: parseJson(wantsDraft ? current.draft_json : current.published_json),
    revision: current.revision,
    updatedAt: current.updated_at,
    publishedAt: current.published_at,
  });
}

export async function saveSiteDraft(request: Request, keyValue: string): Promise<Response> {
  assertSameOrigin(request);
  await requireEditor(request);
  await ensureSiteContentSchema();
  const key = validKey(keyValue);
  const input = await request.json() as { content?: unknown; expectedRevision?: unknown };
  const expected = Number(input.expectedRevision);
  if (!Number.isInteger(expected) || expected < 0) throw new SiteContentError("현재 수정 버전을 확인해 주세요.", 400);
  const contentJson = serializeContent(input.content);
  const email = actor(request);
  const now = new Date().toISOString();
  const database = db();
  await database.prepare("INSERT OR IGNORE INTO site_documents (key, draft_json, revision, updated_by, updated_at) VALUES (?, '{}', 0, ?, ?)")
    .bind(key, email, now).run();
  const nextRevision = expected + 1;
  const result = await database.prepare(`UPDATE site_documents
    SET draft_json = ?, revision = ?, updated_by = ?, updated_at = ?
    WHERE key = ? AND revision = ?`).bind(contentJson, nextRevision, email, now, key, expected).run();
  if (!result.meta.changes) throw new SiteContentError("다른 사용자가 먼저 저장했습니다. 최신 내용을 다시 불러와 주세요.", 409);
  await database.prepare("INSERT INTO site_versions (id, document_key, revision, kind, content_json, created_by, created_at) VALUES (?, ?, ?, 'draft', ?, ?, ?)")
    .bind(crypto.randomUUID(), key, nextRevision, contentJson, email, now).run();
  return json({ key, revision: nextRevision, updatedAt: now });
}

export async function publishSiteContent(request: Request, keyValue: string): Promise<Response> {
  assertSameOrigin(request);
  await requireEditor(request);
  await ensureSiteContentSchema();
  const key = validKey(keyValue);
  const input = await request.json().catch(() => ({})) as { expectedRevision?: unknown };
  const expected = Number(input.expectedRevision);
  if (!Number.isInteger(expected) || expected < 0) throw new SiteContentError("현재 수정 버전을 확인해 주세요.", 400);
  const current = await row(key);
  if (!current || current.revision !== expected) throw new SiteContentError("최신 임시저장을 다시 불러와 주세요.", 409);
  const email = actor(request);
  const now = new Date().toISOString();
  const nextRevision = expected + 1;
  const result = await db().prepare(`UPDATE site_documents SET published_json = draft_json, revision = ?, updated_by = ?,
    updated_at = ?, published_at = ? WHERE key = ? AND revision = ?`)
    .bind(nextRevision, email, now, now, key, expected).run();
  if (!result.meta.changes) throw new SiteContentError("다른 사용자가 먼저 게시했습니다.", 409);
  await db().prepare("INSERT INTO site_versions (id, document_key, revision, kind, content_json, created_by, created_at) VALUES (?, ?, ?, 'published', ?, ?, ?)")
    .bind(crypto.randomUUID(), key, nextRevision, current.draft_json, email, now).run();
  return json({ key, revision: nextRevision, publishedAt: now });
}

export async function listSiteVersions(request: Request, keyValue: string): Promise<Response> {
  await requireEditor(request);
  await ensureSiteContentSchema();
  const key = validKey(keyValue);
  const { results = [] } = await db().prepare(`SELECT id, revision, kind, created_by, created_at
    FROM site_versions WHERE document_key = ? ORDER BY revision DESC LIMIT 50`).bind(key).all();
  return json({ items: results });
}

export async function restoreSiteVersion(request: Request, keyValue: string, versionId: string): Promise<Response> {
  assertSameOrigin(request);
  await requireEditor(request);
  await ensureSiteContentSchema();
  const key = validKey(keyValue);
  const input = await request.json() as { expectedRevision?: unknown };
  const expected = Number(input.expectedRevision);
  if (!Number.isInteger(expected) || expected < 0) throw new SiteContentError("현재 수정 버전을 확인해 주세요.", 400);
  const version = await db().prepare("SELECT content_json FROM site_versions WHERE id = ? AND document_key = ?")
    .bind(versionId, key).first<{ content_json: string }>();
  if (!version) throw new SiteContentError("복원할 버전을 찾을 수 없습니다.", 404);
  const email = actor(request);
  const now = new Date().toISOString();
  const nextRevision = expected + 1;
  const result = await db().prepare(`UPDATE site_documents SET draft_json = ?, revision = ?, updated_by = ?, updated_at = ?
    WHERE key = ? AND revision = ?`).bind(version.content_json, nextRevision, email, now, key, expected).run();
  if (!result.meta.changes) throw new SiteContentError("다른 사용자가 먼저 저장했습니다. 최신 내용을 다시 불러와 주세요.", 409);
  await db().prepare("INSERT INTO site_versions (id, document_key, revision, kind, content_json, created_by, created_at) VALUES (?, ?, ?, 'restored', ?, ?, ?)")
    .bind(crypto.randomUUID(), key, nextRevision, version.content_json, email, now).run();
  return json({ key, revision: nextRevision, content: parseJson(version.content_json), updatedAt: now });
}

export class SiteContentError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export function siteContentRouteError(error: unknown): Response {
  if (error instanceof SiteContentError) return json({ error: error.message }, { status: error.status });
  console.error(error);
  return json({ error: "저장 처리 중 오류가 발생했습니다." }, { status: 500 });
}
