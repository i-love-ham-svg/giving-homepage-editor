import { isAdminRequest, json, routeError } from "../../../../../lib/board-server";

export async function GET(request: Request) {
  try {
    return json({ admin: await isAdminRequest(request) });
  } catch (error) {
    return routeError(error);
  }
}
