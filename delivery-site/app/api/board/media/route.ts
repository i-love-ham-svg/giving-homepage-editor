import { assertSameOrigin, json, routeError } from "../../../../lib/board-server";
import { uploadMedia } from "../../../../lib/media-server";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    return json({ item: await uploadMedia(request) }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
