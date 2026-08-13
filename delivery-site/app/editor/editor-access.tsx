"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Session = {
  authenticated: boolean;
  admin: boolean;
  email: string | null;
  signInPath: string;
};

export default function EditorAccess() {
  const [session, setSession] = useState<Session | null>(null);
  const [failed, setFailed] = useState(false);
  const [editorSrc, setEditorSrc] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const surface = new URLSearchParams(window.location.search).get("surface") === "community"
      ? "community"
      : "";
    const returnTo = surface ? "/editor?surface=community" : "/editor";
    const editorParams = new URLSearchParams({
      mode: "edit",
      editorRole: "staff",
      v: "20260812-community-surface",
    });
    if (surface) editorParams.set("surface", surface);
    const nextEditorSrc = `/songak/representative-greeting-editor.html?${editorParams}`;

    fetch(`/api/board/admin/session?returnTo=${encodeURIComponent(returnTo)}`, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("session");
        return response.json() as Promise<Session>;
      })
      .then((value) => {
        if (!active) return;
        if (!value.authenticated) {
          window.location.replace(value.signInPath || `/staff-login?returnTo=${encodeURIComponent(returnTo)}`);
          return;
        }
        // The authenticated session is the first render that needs the iframe,
        // so commit the derived URL with the async session result.
        setEditorSrc(nextEditorSrc);
        setSession(value);
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, []);

  if (failed) {
    return (
      <main className="editor-access-message">
        <h1>로그인 정보를 확인하지 못했습니다.</h1>
        <Link href="/">방문자 화면으로 돌아가기</Link>
      </main>
    );
  }

  if (!session || !editorSrc) {
    return <main className="editor-access-message" aria-live="polite">담당자 권한을 확인하고 있습니다.</main>;
  }

  if (!session.admin) {
    return (
      <main className="editor-access-message">
        <h1>등록된 복지관 담당자만 편집할 수 있습니다.</h1>
        <p>{session.email ?? "현재 계정"}은 편집 담당자로 등록되어 있지 않습니다.</p>
        <div className="editor-access-actions">
          <Link href="/">방문자 화면</Link>
          <Link href={session.signInPath}>담당자 로그인</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="editor-shell">
      <iframe
        className="editor-frame"
        src={editorSrc}
        title="송악사회복지관 담당자 편집 화면"
      />
    </main>
  );
}
