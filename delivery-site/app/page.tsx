const PUBLIC_SITE_URL =
  "/songak/representative-greeting-editor.html?mode=view&editorRole=visitor&v=20260810-public-delivery";

export default function Home() {
  return (
    <main className="editor-shell">
      <iframe className="editor-frame" src={PUBLIC_SITE_URL} title="송악사회복지관 홈페이지" />
    </main>
  );
}
