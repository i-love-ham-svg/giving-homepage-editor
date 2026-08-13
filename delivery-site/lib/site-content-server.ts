import { env } from "cloudflare:workers";
import { assertSameOrigin, isAdminRequest, json } from "./board-server";
import {
  COMMUNITY_EDITOR_SURFACE_KEY,
  normalizeCommunityEditorSurface,
} from "./community-editor-contract";

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
const publicScopePattern = /^home-menu-[a-z0-9-]{1,80}$/;
const legacySectionCollectionKeys = [
  "mainIntroSections",
  "greetingSections",
  "programSections",
  "processSections",
  "historySections",
  "donationSections",
  "gallerySections",
  "essentialSections",
] as const;
let schemaReady: Promise<unknown> | null = null;

type JsonObject = Record<string, unknown>;

export type PublicContentScopeResult = {
  content: unknown;
  scope: string;
  sectionIds: string[];
  fallback: "legacy-document" | "incomplete-scope" | "unpublished" | null;
};

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

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneJson<T>(value: T): T {
  return value == null ? value : structuredClone(value);
}

/**
 * Enforce the visual-only community contract at every server persistence and
 * read boundary. Sibling globals and external surfaces remain untouched.
 */
export function normalizeSiteContentExternalSurfaces(content: unknown): unknown {
  if (!isJsonObject(content)) return content;
  const document = isJsonObject(content.document) ? content.document : null;
  const globals = document && isJsonObject(document.globals) ? document.globals : null;
  const externalSurfaces = globals && isJsonObject(globals.externalSurfaces) ? globals.externalSurfaces : null;
  if (!externalSurfaces || !Object.prototype.hasOwnProperty.call(externalSurfaces, COMMUNITY_EDITOR_SURFACE_KEY)) {
    return content;
  }
  const normalized = cloneJson(content);
  const normalizedDocument = normalized.document as JsonObject;
  const normalizedGlobals = normalizedDocument.globals as JsonObject;
  const normalizedSurfaces = normalizedGlobals.externalSurfaces as JsonObject;
  normalizedSurfaces[COMMUNITY_EDITOR_SURFACE_KEY] = normalizeCommunityEditorSurface(
    normalizedSurfaces[COMMUNITY_EDITOR_SURFACE_KEY],
  );
  return normalized;
}

function normalizeSectionId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function findHomeMenuItem(items: unknown, scope: string): JsonObject | null {
  if (!Array.isArray(items)) return null;
  for (const candidate of items) {
    if (!isJsonObject(candidate)) continue;
    if (candidate.id === scope) return candidate;
    const nested = findHomeMenuItem(candidate.children, scope);
    if (nested) return nested;
  }
  return null;
}

function linkedSectionIds(menuItem: JsonObject): string[] {
  const values = [
    ...(Array.isArray(menuItem.sectionIds) ? menuItem.sectionIds : []),
    menuItem.sectionId,
  ];
  return [...new Set(values.map(normalizeSectionId).filter(Boolean))];
}

function filterRecordKeys(value: unknown, allowed: Set<string>): JsonObject {
  if (!isJsonObject(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([key]) => allowed.has(key)));
}

function fullScopeFallback(content: unknown, scope: string, reason: PublicContentScopeResult["fallback"]): PublicContentScopeResult {
  return { content, scope, sectionIds: [], fallback: reason };
}

/**
 * Build a canonical public snapshot for one menu item. The full menu and all
 * document globals are retained so navigation and theming keep working, while
 * only the linked sections plus the footer are sent. Legacy duplicated section
 * arrays and global layout maps are intentionally omitted; each canonical
 * document section already owns its responsive layouts and text styles.
 *
 * Older snapshots without the canonical document shape, or internally
 * inconsistent snapshots, fall back to the full published content. Unknown
 * menu ids throw a 404 so a typo cannot silently download the full document.
 */
export function scopePublishedSiteContent(content: unknown, scope: string): PublicContentScopeResult {
  content = normalizeSiteContentExternalSurfaces(content);
  if (!isJsonObject(content)) return fullScopeFallback(content, scope, "legacy-document");
  const document = isJsonObject(content.document) ? content.document : null;
  const globals = document && isJsonObject(document.globals) ? document.globals : null;
  const homeMenu = globals && isJsonObject(globals.homeMenu) ? globals.homeMenu : null;
  const sections = document && Array.isArray(document.sections) ? document.sections : null;
  if (!document || !globals || !homeMenu || !sections) {
    return fullScopeFallback(content, scope, "legacy-document");
  }

  const menuItem = findHomeMenuItem(homeMenu.items, scope);
  if (!menuItem) throw new SiteContentError("Unknown public content scope.", 404);

  const menuSectionIds = linkedSectionIds(menuItem);
  const requiredSectionIds = new Set([...menuSectionIds, "footer"]);
  const sectionsById = new Map<string, JsonObject>();
  sections.forEach((section) => {
    if (!isJsonObject(section)) return;
    const id = normalizeSectionId(section.id ?? section.sectionId);
    if (id) sectionsById.set(id, section);
  });
  const missingIds = [...requiredSectionIds].filter((id) => !sectionsById.has(id));
  if (missingIds.length) return fullScopeFallback(content, scope, "incomplete-scope");

  const originalOrder = Array.isArray(document.sectionOrder)
    ? document.sectionOrder.map(normalizeSectionId).filter(Boolean)
    : [];
  const scopedOrder = originalOrder.filter((id) => requiredSectionIds.has(id));
  for (const id of requiredSectionIds) {
    if (!scopedOrder.includes(id)) scopedOrder.push(id);
  }
  const scopedSections = scopedOrder.map((id) => cloneJson(sectionsById.get(id)!));
  const primarySectionId = normalizeSectionId(menuItem.sectionId);
  const activeSectionId = requiredSectionIds.has(primarySectionId)
    ? primarySectionId
    : menuSectionIds.find((id) => requiredSectionIds.has(id)) || "footer";

  const legacyContent = isJsonObject(content.content) ? cloneJson(content.content) : {};
  legacySectionCollectionKeys.forEach((key) => delete legacyContent[key]);
  legacyContent.activeSection = activeSectionId;
  legacyContent.sectionOrder = [...scopedOrder];
  legacyContent.hiddenSections = filterRecordKeys(legacyContent.hiddenSections, requiredSectionIds);
  delete legacyContent.homeMenu;
  delete legacyContent.sectionAppearances;

  const scopedGlobals = cloneJson(globals);
  scopedGlobals.sectionAppearances = filterRecordKeys(globals.sectionAppearances, requiredSectionIds);
  const scopedDocument: JsonObject = {
    ...cloneJson(document),
    activeSectionId,
    sectionOrder: [...scopedOrder],
    sections: scopedSections,
    globals: scopedGlobals,
  };
  const scopedContent: JsonObject = {
    schemaVersion: cloneJson(content.schemaVersion),
    savedAt: cloneJson(content.savedAt),
    layouts: {},
    textStyles: {},
    assets: cloneJson(content.assets),
    content: legacyContent,
    document: scopedDocument,
    storage: cloneJson(content.storage),
  };

  return {
    content: scopedContent,
    scope,
    sectionIds: [...scopedOrder],
    fallback: null,
  };
}

export function readPublicContentScope(url: URL): string | null {
  const scopes = url.searchParams.getAll("scope");
  if (!scopes.length) return null;
  if (scopes.length !== 1) throw new SiteContentError("Provide exactly one public content scope.", 400);
  const scope = scopes[0].trim().toLowerCase();
  if (!publicScopePattern.test(scope)) throw new SiteContentError("Invalid public content scope.", 400);
  return scope;
}

function publishedEtag(key: string, current: SiteContentRow | null, scope = "full", payload: unknown = null): string {
  const published = current?.published_json || "null";
  const publishedAt = current?.published_at || "unpublished";
  const payloadBytes = payload === null
    ? new TextEncoder().encode(published).byteLength
    : new TextEncoder().encode(JSON.stringify(payload)).byteLength;
  const marker = `${key}:${publishedAt}:${current?.revision ?? 0}:${scope}:${payloadBytes}`;
  let hash = 2166136261;
  for (let index = 0; index < marker.length; index += 1) {
    hash ^= marker.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `W/"site-${(hash >>> 0).toString(16)}"`;
}

function publicSiteContentResponse(
  request: Request,
  data: unknown,
  etag: string,
  scope: string | null = null,
  scopeFallback: PublicContentScopeResult["fallback"] = null,
): Response {
  const cacheHeaders = {
    "cache-control": "public, no-cache, must-revalidate",
    etag,
    vary: "accept-encoding",
  };
  const decorateHeaders = (headers: Headers) => {
    Object.entries(cacheHeaders).forEach(([name, value]) => headers.set(name, value));
    if (scope) headers.set("x-site-content-scope", scope);
    if (scopeFallback) headers.set("x-site-content-scope-fallback", scopeFallback);
  };
  if (request.headers.get("if-none-match") === etag) {
    const response = new Response(null, { status: 304 });
    decorateHeaders(response.headers);
    return response;
  }
  const response = json(data);
  decorateHeaders(response.headers);
  return response;
}

function serializeContent(content: unknown): string {
  if (content === null || typeof content !== "object" || Array.isArray(content)) {
    throw new SiteContentError("저장할 내용은 JSON 객체여야 합니다.", 400);
  }
  const serialized = JSON.stringify(normalizeSiteContentExternalSurfaces(content));
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
  const url = new URL(request.url);
  const wantsDraft = url.searchParams.get("mode") === "draft";
  if (wantsDraft) await requireEditor(request);
  // Draft/edit callers always receive the complete document. Public callers
  // may opt into a canonical menu scope; an omitted scope preserves the
  // backwards-compatible full published response.
  const requestedScope = wantsDraft ? null : readPublicContentScope(url);
  const current = await row(key);
  if (!current) {
    const data = {
      key,
      content: null,
      revision: 0,
      publishedAt: null,
      ...(requestedScope ? { scope: requestedScope, scopeFallback: "unpublished" } : {}),
    };
    return wantsDraft
      ? json(data)
      : publicSiteContentResponse(request, data, publishedEtag(key, null, requestedScope || "full", null), requestedScope, requestedScope ? "unpublished" : null);
  }
  const selectedContent = normalizeSiteContentExternalSurfaces(
    parseJson(wantsDraft ? current.draft_json : current.published_json),
  );
  const scoped = !wantsDraft && requestedScope && selectedContent !== null
    ? scopePublishedSiteContent(selectedContent, requestedScope)
    : null;
  const responseContent = scoped?.content ?? selectedContent;
  const data = {
    key,
    content: responseContent,
    revision: current.revision,
    updatedAt: current.updated_at,
    publishedAt: current.published_at,
    ...(scoped ? {
      scope: scoped.scope,
      scopeSectionIds: scoped.sectionIds,
      ...(scoped.fallback ? { scopeFallback: scoped.fallback } : {}),
    } : requestedScope ? { scope: requestedScope, scopeFallback: "unpublished" } : {}),
  };
  if (wantsDraft) return json(data);
  const fallback = scoped?.fallback ?? (requestedScope && selectedContent === null ? "unpublished" : null);
  return publicSiteContentResponse(
    request,
    data,
    publishedEtag(key, current, requestedScope || "full", responseContent),
    requestedScope,
    fallback,
  );
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
  const publishJson = serializeContent(parseJson(current.draft_json));
  const email = actor(request);
  const now = new Date().toISOString();
  const nextRevision = expected + 1;
  const result = await db().prepare(`UPDATE site_documents SET draft_json = ?, published_json = ?, revision = ?, updated_by = ?,
    updated_at = ?, published_at = ? WHERE key = ? AND revision = ?`)
    .bind(publishJson, publishJson, nextRevision, email, now, now, key, expected).run();
  if (!result.meta.changes) throw new SiteContentError("다른 사용자가 먼저 게시했습니다.", 409);
  await db().prepare("INSERT INTO site_versions (id, document_key, revision, kind, content_json, created_by, created_at) VALUES (?, ?, ?, 'published', ?, ?, ?)")
    .bind(crypto.randomUUID(), key, nextRevision, publishJson, email, now).run();
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
  const restoredJson = serializeContent(parseJson(version.content_json));
  const email = actor(request);
  const now = new Date().toISOString();
  const nextRevision = expected + 1;
  const result = await db().prepare(`UPDATE site_documents SET draft_json = ?, revision = ?, updated_by = ?, updated_at = ?
    WHERE key = ? AND revision = ?`).bind(restoredJson, nextRevision, email, now, key, expected).run();
  if (!result.meta.changes) throw new SiteContentError("다른 사용자가 먼저 저장했습니다. 최신 내용을 다시 불러와 주세요.", 409);
  await db().prepare("INSERT INTO site_versions (id, document_key, revision, kind, content_json, created_by, created_at) VALUES (?, ?, ?, 'restored', ?, ?, ?)")
    .bind(crypto.randomUUID(), key, nextRevision, restoredJson, email, now).run();
  return json({ key, revision: nextRevision, content: parseJson(restoredJson), updatedAt: now });
}

export class SiteContentError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export function siteContentRouteError(error: unknown): Response {
  if (error instanceof SiteContentError) return json({ error: error.message }, { status: error.status });
  console.error(error);
  return json({ error: "저장 처리 중 오류가 발생했습니다." }, { status: 500 });
}
