// ARCHIVED LEGACY FIXTURE ONLY.
// The static editor server and default acceptance suite do not import this file.
// Production submissions use delivery-site /api/applications with D1 storage.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";

const ALLOWED_TYPES = new Set(["program", "case", "volunteer", "donation", "facility", "general"]);
const ALLOWED_KINDS = new Set(["individual", "family", "group"]);

function clean(value, max = 300) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}

function normalizePhone(value) {
  const phone = clean(value, 20);
  if (!/^[0-9+()\-\s]{8,20}$/.test(phone)) throw new Error("연락처를 확인해 주세요.");
  return phone;
}

export class ApplicationStore {
  constructor({ dataDir }) {
    this.dataDir = resolve(dataDir);
    this.file = resolve(this.dataDir, "applications.json");
    mkdirSync(this.dataDir, { recursive: true });
    if (!existsSync(this.file)) writeFileSync(this.file, "[]\n", "utf8");
  }

  read() {
    try {
      const value = JSON.parse(readFileSync(this.file, "utf8"));
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  write(items) {
    writeFileSync(this.file, `${JSON.stringify(items, null, 2)}\n`, "utf8");
  }

  create(input = {}) {
    if (clean(input.website, 100)) throw new Error("자동 접수 방지 확인에 실패했습니다.");
    if (input.consent !== "on" && input.consent !== true) throw new Error("개인정보 수집·처리에 동의해 주세요.");
    const type = clean(input.type, 20);
    const applicantKind = clean(input.applicantKind, 20);
    if (!ALLOWED_TYPES.has(type)) throw new Error("신청 분야를 확인해 주세요.");
    if (!ALLOWED_KINDS.has(applicantKind)) throw new Error("신청자 구분을 확인해 주세요.");
    const name = clean(input.name, 50);
    const message = clean(input.message, 1500);
    if (name.length < 2) throw new Error("이름 또는 단체명을 입력해 주세요.");
    if (message.length < 5) throw new Error("신청·상담 내용을 5자 이상 입력해 주세요.");
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replaceAll("-", "");
    const receipt = `SACWC-${date}-${randomBytes(3).toString("hex").toUpperCase()}`;
    const item = {
      id: randomBytes(12).toString("hex"),
      receipt,
      type,
      applicantKind,
      name,
      phone: normalizePhone(input.phone),
      preferredContact: clean(input.preferredContact, 50),
      participants: Math.max(1, Math.min(100, Number.parseInt(input.participants, 10) || 1)),
      message,
      status: "received",
      createdAt: now.toISOString()
    };
    const items = this.read();
    items.unshift(item);
    this.write(items.slice(0, 5000));
    return item;
  }

  list(adminKey, expectedAdminKey) {
    if (!adminKey || adminKey !== expectedAdminKey) throw new Error("관리자 권한이 필요합니다.");
    return this.read();
  }
}
