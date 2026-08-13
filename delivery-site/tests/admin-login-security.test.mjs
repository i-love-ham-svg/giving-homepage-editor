import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = new URL("../", import.meta.url);
const endpoint = "https://songak.example/api/board/admin/login";

function json(data, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
}

async function loadLoginRoute({ expectedId = "configured-editor", expectedPassword = "configured-password" } = {}) {
  const source = await readFile(new URL("app/api/board/admin/login/route.ts", root), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
  }).outputText;
  const calls = [];
  let attempts = 0;
  const loadedModule = { exports: {} };
  const sandbox = {
    module: loadedModule,
    exports: loadedModule.exports,
    require(specifier) {
      if (specifier !== "../../../../../lib/board-server") {
        throw new Error(`Unexpected import: ${specifier}`);
      }
      return {
        adminCookie: () => "songak_board_admin=opaque; Path=/; HttpOnly; SameSite=Lax",
        assertSameOrigin(request) {
          calls.push("same-origin");
          if (request.headers.get("origin") !== new URL(request.url).origin) throw new Error("허용되지 않은 요청입니다.");
        },
        async enforceRateLimit(_request, scope, limit, windowMs) {
          calls.push(`rate:${scope}:${limit}:${windowMs}`);
          attempts += 1;
          if (attempts > limit) throw new Error("요청이 너무 많습니다. 잠시 후 다시 이용해 주세요.");
        },
        async readJson(request) {
          calls.push("read-json");
          return JSON.parse(await request.text());
        },
        async createAdminSession(id, password) {
          calls.push("authenticate");
          if (id !== expectedId || password !== expectedPassword) {
            throw new Error("아이디 또는 비밀번호가 올바르지 않습니다.");
          }
          return "opaque-session";
        },
        json,
        routeError(error) {
          const message = error instanceof Error ? error.message : "요청을 처리하지 못했습니다.";
          const status = /너무 많/.test(message) ? 429 : 400;
          return json({ error: message }, { status });
        },
      };
    },
    Buffer,
    URL,
    Request,
    Response,
    Headers,
    TextEncoder,
    Error,
    crypto,
    console,
  };
  vm.runInNewContext(output, sandbox, { filename: "app/api/board/admin/login/route.ts" });
  return { POST: loadedModule.exports.POST, calls };
}

function loginRequest(payload, origin = "https://songak.example") {
  return new Request(endpoint, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

test("temporary editor login applies the existing scoped limiter before reading credentials", async () => {
  const { POST, calls } = await loadLoginRoute();
  const response = await POST(loginRequest({ id: "configured-editor", password: "configured-password" }));

  assert.equal(response.status, 200);
  assert.deepEqual(calls, [
    "same-origin",
    "rate:temporary-editor-login:10:600000",
    "read-json",
    "authenticate",
  ]);
  assert.match(response.headers.get("set-cookie") || "", /HttpOnly/);
});

test("temporary editor login returns a generic 401 without setting a session cookie", async () => {
  const { POST } = await loadLoginRoute();
  const response = await POST(loginRequest({ id: "wrong-editor", password: "wrong-password" }));
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.deepEqual(body, { error: "아이디 또는 비밀번호를 확인해 주세요." });
  assert.equal(response.headers.has("set-cookie"), false);
});

test("temporary editor login rejects the eleventh request in the ten-minute bucket before authentication", async () => {
  const { POST, calls } = await loadLoginRoute();
  for (let index = 0; index < 10; index += 1) {
    assert.equal((await POST(loginRequest({ id: "configured-editor", password: "configured-password" }))).status, 200);
  }
  const limited = await POST(loginRequest({ id: "configured-editor", password: "configured-password" }));

  assert.equal(limited.status, 429);
  assert.equal(calls.filter((entry) => entry === "authenticate").length, 10);
  assert.equal(calls.at(-1), "rate:temporary-editor-login:10:600000");
});
