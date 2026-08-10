import { assertSameOrigin, json, registerShare, routeError } from "../../../../../../lib/board-server";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;
    await registerShare(request, id);
    return json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
