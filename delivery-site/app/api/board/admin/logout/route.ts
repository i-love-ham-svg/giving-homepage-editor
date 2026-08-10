import { json } from "../../../../../lib/board-server";

export async function POST() {
  return json({ ok: true, signOutPath: "/signout-with-chatgpt?return_to=%2F" });
}
