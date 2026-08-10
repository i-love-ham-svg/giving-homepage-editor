import type { Metadata } from "next";
import { BoardApp } from "./board-app";

export const metadata: Metadata = {
  title: "소통게시판 | 송악사회복지관",
  description: "송악사회복지관 소식과 주민 이야기를 사진·영상으로 나누는 소통게시판",
};

export default function Home() {
  return <BoardApp />;
}
