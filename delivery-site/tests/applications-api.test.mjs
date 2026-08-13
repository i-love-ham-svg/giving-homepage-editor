import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = new URL("../", import.meta.url);
const endpoint = "https://songak.example/api/applications";

const plain = (value) => JSON.parse(JSON.stringify(value));

function json(data, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  return new Response(JSON.stringify(data), { ...init, headers });
}

class FakeStatement {
  constructor(database, sql) {
    this.database = database;
    this.sql = sql.replace(/\s+/g, " ").trim();
    this.values = [];
  }

  bind(...values) {
    this.values = values;
    return this;
  }

  async first() {
    if (this.sql.includes("INSERT INTO rate_limits")) {
      const [actorHash, bucket] = this.values;
      const key = `create-application|${actorHash}|${bucket}`;
      const count = (this.database.rateLimits.get(key) || 0) + 1;
      this.database.rateLimits.set(key, count);
      return { count };
    }
    return null;
  }

  async run() {
    if (this.sql.includes("INSERT INTO applications")) {
      const [
        id, receiptId, type, applicantKind, name, phone, preferredContact,
        participants, message, actorHash, consentedAt, createdAt, updatedAt,
      ] = this.values;
      this.database.applications.unshift({
        id,
        receipt_id: receiptId,
        type,
        applicant_kind: applicantKind,
        name,
        phone,
        preferred_contact: preferredContact,
        participants,
        message,
        status: "received",
        actor_hash: actorHash,
        consented_at: consentedAt,
        created_at: createdAt,
        updated_at: updatedAt,
      });
    }
    return { success: true };
  }

  async all() {
    let rows = [...this.database.applications];
    let limit;
    if (this.sql.includes("WHERE status = ?")) {
      const [status, requestedLimit] = this.values;
      rows = rows.filter((row) => row.status === status);
      limit = requestedLimit;
    } else {
      [limit] = this.values;
    }
    return { results: rows.slice(0, Number(limit) || rows.length) };
  }
}

class FakeD1Database {
  constructor() {
    this.applications = [];
    this.rateLimits = new Map();
  }

  prepare(sql) {
    return new FakeStatement(this, sql);
  }

  async batch(statements) {
    return Promise.all(statements.map((statement) => statement.run()));
  }
}

async function loadApplicationModule() {
  const source = await readFile(new URL("lib/application-server.ts", root), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
  }).outputText;
  const database = new FakeD1Database();
  const loadedModule = { exports: {} };
  const sandbox = {
    module: loadedModule,
    exports: loadedModule.exports,
    require(specifier) {
      if (specifier === "cloudflare:workers") {
        return {
          env: {
            DB: database,
            APPLICATION_HASH_PEPPER: "test-application-pepper",
          },
        };
      }
      if (specifier === "./board-server") {
        return {
          assertSameOrigin(request) {
            const origin = request.headers.get("origin");
            if (origin && origin !== new URL(request.url).origin) throw new Error("cross origin");
          },
          isAdminRequest: async (request) => request.headers.get("cookie")?.includes("songak_admin=valid") === true,
          json,
          async readJson(request, maxBytes) {
            const text = await request.text();
            if (new TextEncoder().encode(text).byteLength > maxBytes) throw new Error("요청 용량이 너무 큽니다.");
            return text ? JSON.parse(text) : {};
          },
        };
      }
      throw new Error(`Unexpected import: ${specifier}`);
    },
    Buffer,
    URL,
    Request,
    Response,
    Headers,
    TextEncoder,
    crypto,
    console,
  };
  vm.runInNewContext(output, sandbox, { filename: "lib/application-server.ts" });
  return { api: loadedModule.exports, database };
}

function validPayload(overrides = {}) {
  return {
    type: "program",
    applicantKind: "individual",
    name: "테스트 신청자",
    phone: "010-1234-5678",
    preferredContact: "평일 오후",
    participants: "2",
    message: "프로그램 참여를 신청합니다.",
    consent: "on",
    website: "",
    ...overrides,
  };
}

function postRequest(payload, options = {}) {
  return new Request(endpoint, {
    method: "POST",
    headers: {
      origin: "https://songak.example",
      "content-type": "application/json",
      "cf-connecting-ip": options.ip || "192.0.2.1",
      "user-agent": options.userAgent || "application-api-test",
      ...options.headers,
    },
    body: typeof payload === "string" ? payload : JSON.stringify(payload),
  });
}

async function invoke(api, operation, request) {
  try {
    return await api[operation](request);
  } catch (error) {
    return api.applicationRouteError(error);
  }
}

test("application route, schema, migration, and output form expose one integrated contract", async () => {
  const [route, applicationServer, schema, migration, editor, staticServer] = await Promise.all([
    readFile(new URL("app/api/applications/route.ts", root), "utf8"),
    readFile(new URL("lib/application-server.ts", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("drizzle/0002_applications.sql", root), "utf8"),
    readFile(new URL("../outputs/representative-greeting-editor.html", root), "utf8"),
    readFile(new URL("../tools/serve-editor.mjs", root), "utf8"),
  ]);

  assert.match(route, /submitApplication/);
  assert.match(route, /listApplications/);
  assert.match(schema, /sqliteTable\("applications"/);
  assert.match(migration, /CREATE TABLE `applications`/);
  assert.match(editor, /name="consent"/);
  assert.match(editor, /name="website"[^>]*tabindex="-1"[^>]*autocomplete="off"/);
  const expectedFormFields = ["type", "applicantKind", "name", "phone", "preferredContact", "participants", "message"];
  for (const fieldName of expectedFormFields) {
    assert.match(editor, new RegExp(`"application-field-[1-7]": "${fieldName}"`));
  }
  const mappingSource = editor.match(/const applicationFieldNameById = \{[\s\S]*?\n          \};/)?.[0] || "";
  const renderedFieldNames = [...mappingSource.matchAll(/"application-field-\d+": "([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(renderedFieldNames, expectedFormFields);
  const apiKeysSource = applicationServer.match(/const APPLICATION_KEYS = new Set\(\[[\s\S]*?\]\);/)?.[0] || "";
  const apiKeys = [...apiKeysSource.matchAll(/"([A-Za-z]+)"/g)].map((match) => match[1]);
  assert.deepEqual(apiKeys, [...expectedFormFields, "consent", "website"]);
  assert.match(editor, /const payload = Object\.fromEntries\(new FormData\(form\)\.entries\(\)\)/);
  assert.doesNotMatch(editor, /name="privacy-consent"/);
  assert.doesNotMatch(staticServer, /ApplicationStore|handleApplicationRequest|applicationStore/);
  assert.match(staticServer, /canonicalPath: "\/api\/applications"/);
});

test("valid public POST stores PII in D1 but returns only an opaque receiptId", async () => {
  const { api, database } = await loadApplicationModule();
  const response = await invoke(api, "submitApplication", postRequest(validPayload()));
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.deepEqual(Object.keys(body), ["receiptId"]);
  assert.match(body.receiptId, /^SACWC-\d{8}-[A-F0-9]{8}$/);
  assert.equal(JSON.stringify(body).includes("테스트 신청자"), false);
  assert.equal(JSON.stringify(body).includes("010-1234-5678"), false);
  assert.equal(database.applications.length, 1);
  assert.equal(database.applications[0].receipt_id, body.receiptId);
  assert.equal(database.applications[0].name, "테스트 신청자");
  assert.equal(database.applications[0].phone, "010-1234-5678");
  assert.equal(database.applications[0].message, "프로그램 참여를 신청합니다.");
  assert.equal(database.applications[0].status, "received");
  assert.notEqual(database.applications[0].actor_hash, "192.0.2.1");
});

test("POST requires same-origin JSON and rejects honeypot, consent, enum, PII, and range failures", async () => {
  {
    const { api, database } = await loadApplicationModule();
    const missingOrigin = postRequest(validPayload(), { headers: { origin: "" } });
    assert.equal((await invoke(api, "submitApplication", missingOrigin)).status, 403);
    const foreignOrigin = postRequest(validPayload(), { headers: { origin: "https://attacker.example" } });
    assert.equal((await invoke(api, "submitApplication", foreignOrigin)).status, 403);
    const wrongContentType = postRequest(validPayload(), { headers: { "content-type": "text/plain" } });
    assert.equal((await invoke(api, "submitApplication", wrongContentType)).status, 415);
    assert.equal(database.applications.length, 0);
  }

  const invalidPayloads = [
    validPayload({ website: "bot.example" }),
    validPayload({ consent: false }),
    validPayload({ type: "unknown" }),
    validPayload({ applicantKind: "company" }),
    validPayload({ name: "김" }),
    validPayload({ name: "김\n홍길동" }),
    validPayload({ phone: "not-a-phone" }),
    validPayload({ phone: "010-1234\n-5678" }),
    validPayload({ preferredContact: "평일\n오후" }),
    validPayload({ message: "짧음" }),
    validPayload({ participants: 0 }),
    validPayload({ participants: 101 }),
    validPayload({ participants: 1.5 }),
    validPayload({ participants: "two" }),
    validPayload({ unexpected: "field" }),
  ];

  for (const payload of invalidPayloads) {
    const { api, database } = await loadApplicationModule();
    const response = await invoke(api, "submitApplication", postRequest(payload));
    assert.equal(response.status, 400, `payload must fail validation: ${JSON.stringify(payload)}`);
    assert.equal(database.applications.length, 0);
  }
});

test("oversized application JSON is rejected with a payload-too-large response", async () => {
  const { api, database } = await loadApplicationModule();
  const response = await invoke(api, "submitApplication", postRequest(validPayload({ message: "가".repeat(21_000) })));
  assert.equal(response.status, 413);
  assert.equal(database.applications.length, 0);
});

test("rate limiter accepts four submissions per actor and rejects the fifth", async () => {
  const { api, database } = await loadApplicationModule();
  for (let index = 0; index < 4; index += 1) {
    const response = await invoke(api, "submitApplication", postRequest(validPayload()));
    assert.equal(response.status, 201);
  }
  const limited = await invoke(api, "submitApplication", postRequest(validPayload()));
  assert.equal(limited.status, 429);
  assert.equal(database.applications.length, 4);
});

test("application list exposes stored PII only after existing admin-cookie authorization", async () => {
  const { api } = await loadApplicationModule();
  assert.equal((await invoke(api, "submitApplication", postRequest(validPayload()))).status, 201);

  const unauthorized = await invoke(api, "listApplications", new Request(endpoint));
  assert.equal(unauthorized.status, 401);

  const authorized = await invoke(api, "listApplications", new Request(endpoint, {
    headers: { cookie: "songak_admin=valid" },
  }));
  assert.equal(authorized.status, 200);
  const body = await authorized.json();
  assert.equal(body.total, 1);
  assert.deepEqual(plain(body.items.map(({ name, phone, status }) => ({ name, phone, status }))), [{
    name: "테스트 신청자",
    phone: "010-1234-5678",
    status: "received",
  }]);
});
