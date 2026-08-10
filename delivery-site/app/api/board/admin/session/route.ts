import { getEditorSession, json, routeError } from "../../../../../lib/board-server";

export async function GET(request: Request) {
  try {
    const session = await getEditorSession(request);
    return json({
      admin: session.authorized,
      authenticated: session.authenticated,
      email: session.email,
      signInPath: "/signin-with-chatgpt?return_to=%2F",
      signOutPath: "/signout-with-chatgpt?return_to=%2F",
    });
  } catch (error) {
    return routeError(error);
  }
}
