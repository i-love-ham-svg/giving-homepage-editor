const PUBLIC_SITE_URL =
  "/songak/representative-greeting-editor.html?mode=view&editorRole=visitor&v=20260810-public-delivery";

export default function Home() {
  return (
    <main className="editor-shell">
      <a className="staff-login-link" href="/editor">복지관 담당자 로그인</a>
      <iframe className="editor-frame" src={PUBLIC_SITE_URL} title="송악사회복지관 홈페이지" />
    </main>
  );
}
