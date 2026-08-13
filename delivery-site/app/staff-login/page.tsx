"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";

const providerLabels: Record<string, string> = {
  kakao: "카카오",
  naver: "네이버",
  google: "Google",
};

export default function StaffLoginPage() {
  const [provider, setProvider] = useState("");
  const returnToRef = useRef("/editor");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const key = params.get("provider") || "";
    const requestedReturn = params.get("returnTo") || "";
    window.setTimeout(() => setProvider(providerLabels[key] || ""), 0);
    if (requestedReturn) {
      try {
        const destination = new URL(requestedReturn, window.location.origin);
        const isBoardManager = destination.origin === window.location.origin
          && destination.pathname === "/community"
          && destination.searchParams.get("manage") === "1";
        const isCommunityEditor = destination.origin === window.location.origin
          && destination.pathname === "/editor"
          && destination.searchParams.get("surface") === "community";
        if (isBoardManager) returnToRef.current = "/community?manage=1";
        else if (isCommunityEditor) returnToRef.current = "/editor?surface=community";
      } catch {
        // 올바르지 않은 외부·손상 주소는 기본 편집기 경로로 되돌립니다.
      }
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");

    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/board/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: String(form.get("username") || ""),
          password: String(form.get("password") || ""),
        }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string; redirectTo?: string };
      if (!response.ok) throw new Error(result.error || "아이디 또는 비밀번호를 확인해 주세요.");
      window.location.assign(returnToRef.current || result.redirectTo || "/editor");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "로그인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setSubmitting(false);
    }
  }

  return (
    <main className="staff-login-page">
      <section className="staff-login-card" aria-labelledby="staff-login-title">
        <Link className="staff-login-back" href="/">← 홈페이지로 돌아가기</Link>
        <div className="staff-login-brand" aria-hidden="true">송</div>
        <p className="staff-login-eyebrow">SONGAK COMMUNITY WELFARE CENTER</p>
        <h1 id="staff-login-title">복지관 담당자 로그인</h1>
        <p className="staff-login-copy">
          {provider ? `${provider} 버튼을 통해 담당자 로그인 화면으로 이동했습니다.` : "전달받은 임시 아이디와 비밀번호를 입력해 주세요."}
        </p>
        <form className="staff-login-form" onSubmit={submit}>
          <label>
            <span>아이디</span>
            <input name="username" type="text" autoComplete="username" required maxLength={80} autoFocus />
          </label>
          <label>
            <span>비밀번호</span>
            <input name="password" type="password" autoComplete="current-password" required maxLength={128} />
          </label>
          {error ? <p className="staff-login-error" role="alert">{error}</p> : null}
          <button type="submit" disabled={submitting}>{submitting ? "확인 중…" : "로그인"}</button>
        </form>
        <p className="staff-login-notice">담당자 전용 화면입니다. 계정 정보는 외부에 공유하지 마세요.</p>
      </section>
    </main>
  );
}
