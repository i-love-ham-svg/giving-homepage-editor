import { json } from "../../../../../lib/board-server";

export async function POST() {
  return json(
    { error: "담당자 로그인은 사이트의 ChatGPT 로그인을 이용해 주세요.", signInPath: "/signin-with-chatgpt?return_to=%2F" },
    { status: 410 },
  );
}
