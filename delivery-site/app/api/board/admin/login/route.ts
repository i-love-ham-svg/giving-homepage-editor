import {
  adminCookie,
  assertSameOrigin,
  createAdminSession,
  enforceRateLimit,
  json,
  readJson,
  routeError,
} from "../../../../../lib/board-server";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await enforceRateLimit(request, "temporary-editor-login", 10, 10 * 60 * 1000);
    const input = await readJson<{ id?: unknown; password?: unknown }>(request, 4_096);
    const token = await createAdminSession(String(input.id || ""), String(input.password || ""));
    return json(
      { ok: true, redirectTo: "/editor" },
      { headers: { "set-cookie": adminCookie(token, new URL(request.url).protocol === "https:") } },
    );
  } catch (error) {
    if (error instanceof Error && /아이디 또는 비밀번호/.test(error.message)) {
      return json({ error: "아이디 또는 비밀번호를 확인해 주세요." }, { status: 401 });
    }
    return routeError(error);
  }
}
