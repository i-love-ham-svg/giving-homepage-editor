import { assertSameOrigin, clearAdminCookie, json, routeError } from "../../../../../lib/board-server";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    return json(
      { ok: true, redirectTo: "/" },
      { headers: { "set-cookie": clearAdminCookie(new URL(request.url).protocol === "https:") } },
    );
  } catch (error) {
    return routeError(error);
  }
}
