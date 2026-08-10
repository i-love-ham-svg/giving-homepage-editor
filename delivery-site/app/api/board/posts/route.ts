import { assertSameOrigin, createPost, json, listPosts, routeError } from "../../../../lib/board-server";

export async function GET(request: Request) {
  try {
    return json(await listPosts(request));
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    return json({ item: await createPost(request) }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
