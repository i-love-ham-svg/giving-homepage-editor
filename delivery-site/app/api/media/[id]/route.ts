import { routeError } from "../../../../lib/board-server";
import { serveMedia } from "../../../../lib/media-server";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    return serveMedia(request, id);
  } catch (error) {
    return routeError(error);
  }
}
