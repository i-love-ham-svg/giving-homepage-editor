import { assertSameOrigin, json, reportPost, routeError } from "../../../../../../lib/board-server";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;
    return json({ reportCount: await reportPost(request, id) });
  } catch (error) {
    return routeError(error);
  }
}
