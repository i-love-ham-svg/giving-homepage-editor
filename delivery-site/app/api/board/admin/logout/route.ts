import { assertSameOrigin, clearAdminCookie, json } from "../../../../../lib/board-server";

export async function POST(request: Request) {
  assertSameOrigin(request);
  return json({ ok: true }, { headers: { "set-cookie": clearAdminCookie(new URL(request.url).protocol === "https:") } });
}
