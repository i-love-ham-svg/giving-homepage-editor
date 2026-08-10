import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "송악사회복지관 소통게시판",
    template: "%s | 송악사회복지관",
  },
  description: "복지관의 새로운 소식과 주민 이야기를 함께 나누는 안전한 소통 공간입니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
