import { ensureBoardSchema, getBoardEnv, json, routeError } from "../../../../lib/board-server";

export async function GET() {
  try {
    await ensureBoardSchema();
    const row = await getBoardEnv().DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
    return json({ ok: row?.ok === 1, storage: "connected" });
  } catch (error) {
    return routeError(error);
  }
}
