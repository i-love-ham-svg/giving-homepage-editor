import { requireChatGPTUser } from "../chatgpt-auth";
import EditorAccess from "./editor-access";

export const dynamic = "force-dynamic";

export default async function EditorPage() {
  await requireChatGPTUser("/editor");
  return <EditorAccess />;
}
