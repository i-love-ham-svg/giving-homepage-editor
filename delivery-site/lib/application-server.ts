import { env } from "cloudflare:workers";
import { assertSameOrigin, isAdminRequest, json, readJson } from "./board-server";

type ApplicationEnv = {
  DB: D1Database;
  APPLICATION_HASH_PEPPER?: string;
  BOARD_HASH_PEPPER?: string;
};

type D1Row = Record<string, unknown>;

const APPLICATION_TYPES = new Set(["program", "case", "volunteer", "donation", "facility", "general"]);
const APPLICANT_KINDS = new Set(["individual", "family", "group"]);
const APPLICATION_STATUSES = new Set(["received", "contacted", "closed"]);
const APPLICATION_KEYS = new Set([
  "type",
  "applicantKind",
  "name",
  "phone",
  "preferredContact",
  "participants",
  "message",
  "consent",
  "website",
]);
const encoder = new TextEncoder();
let schemaReady: Promise<unknown> | null = null;

export class ApplicationError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "ApplicationError";
  }
}

function applicationEnv(): ApplicationEnv {
  const runtime = env as unknown as ApplicationEnv;
  if (!runtime.DB) throw new ApplicationError("신청 저장소가 연결되지 않았습니다.", 503);
  return runtime;
}

export function ensureApplicationSchema(): Promise<unknown> {
  if (schemaReady) return schemaReady;
  const { DB } = applicationEnv();
  const statements = [
    `CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY NOT NULL, receipt_id TEXT NOT NULL, type TEXT NOT NULL, applicant_kind TEXT NOT NULL,
      name TEXT NOT NULL, phone TEXT NOT NULL, preferred_contact TEXT NOT NULL DEFAULT '',
      participants INTEGER NOT NULL DEFAULT 1, message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'received',
      actor_hash TEXT NOT NULL, consented_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_receipt_id ON applications(receipt_id)",
    "CREATE INDEX IF NOT EXISTS idx_applications_status_created ON applications(status, created_at)",
    `CREATE TABLE IF NOT EXISTS rate_limits (
      scope TEXT NOT NULL, actor_hash TEXT NOT NULL, bucket INTEGER NOT NULL, count INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(scope, actor_hash, bucket)
    )`,
    "CREATE INDEX IF NOT EXISTS idx_rate_limits_updated_at ON rate_limits(updated_at)",
  ];
  schemaReady = DB.batch(statements.map((statement) => DB.prepare(statement))).catch((error) => {
    schemaReady = null;
    throw error;
  });
  return schemaReady;
}

function strictText(value: unknown, field: string, min: number, max: number, multiline = false): string {
  if (typeof value !== "string") throw new ApplicationError(`${field} 항목을 확인해 주세요.`);
  if (!multiline && /[\r\n]/.test(value)) throw new ApplicationError(`${field} 항목에 사용할 수 없는 문자가 있습니다.`);
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value)) {
    throw new ApplicationError(`${field} 항목에 사용할 수 없는 문자가 있습니다.`);
  }
  const normalized = (multiline ? value.replace(/\r\n?/g, "\n") : value).trim();
  if (normalized.length < min || normalized.length > max) {
    throw new ApplicationError(`${field} 항목은 ${min}~${max}자로 입력해 주세요.`);
  }
  return normalized;
}

function optionalText(value: unknown, field: string, max: number): string {
  if (value == null || value === "") return "";
  return strictText(value, field, 1, max);
}

function parseParticipants(value: unknown): number {
  if (value == null || value === "") return 1;
  const text = typeof value === "number" ? String(value) : value;
  if (typeof text !== "string" || !/^\d{1,3}$/.test(text.trim())) {
    throw new ApplicationError("참여 인원은 1~100 사이의 정수로 입력해 주세요.");
  }
  const participants = Number(text);
  if (!Number.isInteger(participants) || participants < 1 || participants > 100) {
    throw new ApplicationError("참여 인원은 1~100 사이의 정수로 입력해 주세요.");
  }
  return participants;
}

function parseApplication(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ApplicationError("신청 내용을 확인해 주세요.");
  }
  const record = input as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!APPLICATION_KEYS.has(key)) throw new ApplicationError("신청서에 허용되지 않은 항목이 있습니다.");
  }
  if (typeof record.website !== "string" && record.website != null) {
    throw new ApplicationError("요청을 처리할 수 없습니다.");
  }
  if (String(record.website || "").trim()) throw new ApplicationError("요청을 처리할 수 없습니다.");
  if (record.consent !== true && record.consent !== "on") {
    throw new ApplicationError("개인정보 수집·처리에 동의해 주세요.");
  }
  const type = strictText(record.type, "신청 분야", 1, 20);
  const applicantKind = strictText(record.applicantKind, "신청자 구분", 1, 20);
  if (!APPLICATION_TYPES.has(type)) throw new ApplicationError("신청 분야를 확인해 주세요.");
  if (!APPLICANT_KINDS.has(applicantKind)) throw new ApplicationError("신청자 구분을 확인해 주세요.");
  const name = strictText(record.name, "이름 또는 단체명", 2, 50);
  const phone = strictText(record.phone, "연락처", 8, 20);
  if (!/^[0-9+()\- ]+$/.test(phone) || phone.replace(/\D/g, "").length < 8) {
    throw new ApplicationError("연락처를 확인해 주세요.");
  }
  return {
    type,
    applicantKind,
    name,
    phone,
    preferredContact: optionalText(record.preferredContact, "연락 희망 시간", 50),
    participants: parseParticipants(record.participants),
    message: strictText(record.message, "신청·상담 내용", 5, 1500, true),
  };
}

function requireSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    throw new ApplicationError("허용되지 않은 요청입니다.", 403);
  }
  assertSameOrigin(request);
}

async function applicationActorHash(request: Request): Promise<string> {
  const runtime = applicationEnv();
  const pepper = runtime.APPLICATION_HASH_PEPPER || runtime.BOARD_HASH_PEPPER;
  if (!pepper || pepper.length < 12) throw new ApplicationError("신청 보안 설정이 필요합니다.", 503);
  const ip = request.headers.get("cf-connecting-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "local";
  const agent = request.headers.get("user-agent") || "unknown";
  const key = await crypto.subtle.importKey("raw", encoder.encode(pepper), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`${ip}|${agent}|application`));
  return Buffer.from(signature).toString("base64url");
}

async function enforceApplicationRateLimit(request: Request): Promise<string> {
  await ensureApplicationSchema();
  const actor = await applicationActorHash(request);
  const bucket = Math.floor(Date.now() / (10 * 60 * 1000));
  const row = await applicationEnv().DB.prepare(`
    INSERT INTO rate_limits (scope, actor_hash, bucket, count, updated_at)
    VALUES ('create-application', ?, ?, 1, CURRENT_TIMESTAMP)
    ON CONFLICT(scope, actor_hash, bucket)
    DO UPDATE SET count = count + 1, updated_at = CURRENT_TIMESTAMP
    RETURNING count
  `).bind(actor, bucket).first<{ count: number }>();
  if ((row?.count ?? 1) > 4) {
    throw new ApplicationError("신청 요청이 너무 많습니다. 잠시 후 다시 이용해 주세요.", 429);
  }
  return actor;
}

export async function submitApplication(request: Request): Promise<Response> {
  requireSameOrigin(request);
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
    throw new ApplicationError("JSON 형식의 신청서만 접수할 수 있습니다.", 415);
  }
  let raw: unknown;
  try {
    raw = await readJson(request, 20_000);
  } catch (error) {
    const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
    if (/용량/.test(message)) {
      throw new ApplicationError("신청 내용 용량이 너무 큽니다.", 413);
    }
    throw new ApplicationError("신청 내용을 확인해 주세요.");
  }
  const input = parseApplication(raw);
  const actor = await enforceApplicationRateLimit(request);
  const now = new Date().toISOString();
  const receiptId = `SACWC-${now.slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
  await applicationEnv().DB.prepare(`
    INSERT INTO applications (
      id, receipt_id, type, applicant_kind, name, phone, preferred_contact, participants,
      message, status, actor_hash, consented_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'received', ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(), receiptId, input.type, input.applicantKind, input.name, input.phone,
    input.preferredContact, input.participants, input.message, actor, now, now, now,
  ).run();
  return json({ receiptId }, { status: 201 });
}

export async function listApplications(request: Request): Promise<Response> {
  assertSameOrigin(request);
  if (!(await isAdminRequest(request))) throw new ApplicationError("관리자 로그인이 필요합니다.", 401);
  await ensureApplicationSchema();
  const url = new URL(request.url);
  const status = url.searchParams.get("status")?.trim() || "";
  if (status && !APPLICATION_STATUSES.has(status)) throw new ApplicationError("처리 상태를 확인해 주세요.");
  const requestedLimit = Number(url.searchParams.get("limit") || 100);
  const limit = Number.isInteger(requestedLimit) ? Math.min(200, Math.max(1, requestedLimit)) : 100;
  const statement = status
    ? applicationEnv().DB.prepare("SELECT * FROM applications WHERE status = ? ORDER BY created_at DESC LIMIT ?").bind(status, limit)
    : applicationEnv().DB.prepare("SELECT * FROM applications ORDER BY created_at DESC LIMIT ?").bind(limit);
  const { results = [] } = await statement.all<D1Row>();
  const items = results.map((row) => ({
    id: String(row.id),
    receiptId: String(row.receipt_id),
    type: String(row.type),
    applicantKind: String(row.applicant_kind),
    name: String(row.name),
    phone: String(row.phone),
    preferredContact: String(row.preferred_contact || ""),
    participants: Number(row.participants) || 1,
    message: String(row.message),
    status: String(row.status),
    consentedAt: String(row.consented_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }));
  return json({ items, total: items.length });
}

export function applicationRouteError(error: unknown): Response {
  if (error instanceof ApplicationError) return json({ error: error.message }, { status: error.status });
  console.error("application route failed", error instanceof Error ? error.message : "unknown error");
  return json({ error: "신청 접수를 처리하지 못했습니다." }, { status: 500 });
}
