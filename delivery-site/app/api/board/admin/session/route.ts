import { getEditorSession, json, routeError } from "../../../../../lib/board-server";

export async function GET(request: Request) {
  try {
    const session = await getEditorSession(request);
    const requestedReturnTo = new URL(request.url).searchParams.get("returnTo");
    // Keep login redirects on the two known staff surfaces instead of
    // reflecting an arbitrary return URL from the request.
    const safeEditorReturnTo = requestedReturnTo === "/editor?surface=community"
      ? "/editor?surface=community"
      : "/editor";
    const signInPath = requestedReturnTo === "/editor" || requestedReturnTo === "/editor?surface=community"
      ? `/staff-login?returnTo=${encodeURIComponent(safeEditorReturnTo)}`
      : "/staff-login?returnTo=%2Fcommunity%3Fmanage%3D1";
    return json({
      admin: session.authorized,
      authenticated: session.authenticated,
      email: session.email,
      signInPath,
    });
  } catch (error) {
    return routeError(error);
  }
}
