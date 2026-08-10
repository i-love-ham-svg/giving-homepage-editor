"use client";

import { useEffect, useState } from "react";

type Session = {
  authenticated: boolean;
  admin: boolean;
  email: string | null;
  signOutPath: string;
};

export default function EditorAccess() {
  const [session, setSession] = useState<Session | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/board/admin/session", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("session");
        return response.json() as Promise<Session>;
      })
      .then((value) => active && setSession(value))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, []);

  if (failed) {
    return (
      <main className="editor-access-message">
        <h1>로그인 정보를 확인하지 못했습니다.</h1>
        <a href="/">방문자 화면으로 돌아가기</a>
      </main>
    );
  }

  if (!session) {
    return <main className="editor-access-message" aria-live="polite">담당자 권한을 확인하고 있습니다.</main>;
  }

  if (!session.admin) {
    return (
      <main className="editor-access-message">
        <h1>등록된 복지관 담당자만 편집할 수 있습니다.</h1>
        <p>{session.email ?? "현재 계정"}은 편집 담당자로 등록되어 있지 않습니다.</p>
        <div className="editor-access-actions">
          <a href="/">방문자 화면</a>
          <a href={session.signOutPath}>다른 계정으로 로그인</a>
        </div>
      </main>
    );
  }

  return (
    <main className="editor-shell">
      <iframe
        className="editor-frame"
        src="/songak/representative-greeting-editor.html?mode=edit&editorRole=staff&v=20260810-staff"
        title="송악사회복지관 담당자 편집 화면"
      />
    </main>
  );
}
