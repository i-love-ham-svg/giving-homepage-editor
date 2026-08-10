import { adminCookie, assertSameOrigin, createAdminSession, json, readJson, routeError } from "../../../../../lib/board-server";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = await readJson<{ password?: string }>(request, 10_000);
    const token = await createAdminSession(String(input.password || ""));
    return json({ ok: true }, { headers: { "set-cookie": adminCookie(token, new URL(request.url).protocol === "https:") } });
  } catch (error) {
    return routeError(error);
  }
}
