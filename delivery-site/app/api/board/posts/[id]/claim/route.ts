import { assertSameOrigin, claimVisitorPost, json, routeError } from "../../../../../../lib/board-server";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;
    const item = await claimVisitorPost(request, id);
    return item ? json({ item }) : json({ error: "게시글 번호 또는 비밀번호가 올바르지 않습니다." }, { status: 404 });
  } catch (error) {
    return routeError(error);
  }
}
