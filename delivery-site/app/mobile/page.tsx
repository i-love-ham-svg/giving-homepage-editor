import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "모바일 보기 | 송악사회복지관",
  description: "송악사회복지관 홈페이지 모바일 화면 보기 전용 페이지",
};

export default function MobileViewPage() {
  return (
    <main className="mobile-view-only" aria-label="송악사회복지관 모바일 화면 보기">
      <iframe
        className="mobile-view-only-frame"
        src="/?viewport=phone"
        title="송악사회복지관 모바일 홈페이지"
      />
    </main>
  );
}
