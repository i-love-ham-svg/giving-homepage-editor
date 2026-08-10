import { assertSameOrigin, deletePost, getPost, json, routeError, updatePost } from "../../../../../lib/board-server";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const item = await getPost(request, id, new URL(request.url).searchParams.get("view") === "1");
    return item ? json({ item }) : json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;
    const item = await updatePost(request, id);
    return item ? json({ item }) : json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;
    return (await deletePost(request, id)) ? json({ ok: true }) : json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
  } catch (error) {
    return routeError(error);
  }
}
