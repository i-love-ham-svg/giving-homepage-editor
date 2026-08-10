import { assertSameOrigin, json, moderatePost, routeError } from "../../../../../../lib/board-server";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;
    const item = await moderatePost(request, id);
    return item ? json({ item }) : json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
  } catch (error) {
    return routeError(error);
  }
}
