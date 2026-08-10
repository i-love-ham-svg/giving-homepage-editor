"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BoardMedia, BoardPost, Category, PostStatus } from "../lib/board-types";
import { CATEGORIES } from "../lib/board-types";

type ListResult = { items: BoardPost[]; total: number; page: number; pageSize: number; totalPages: number; admin: boolean };
type Draft = {
  category: Category;
  author: string;
  contact: string;
  title: string;
  body: string;
  password: string;
  website: string;
  pinned: boolean;
};

const emptyDraft: Draft = {
  category: "resident",
  author: "",
  contact: "",
  title: "",
  body: "",
  password: "",
  website: "",
  pinned: false,
};

const statusLabels: Record<PostStatus, string> = {
  pending: "승인 대기",
  published: "공개",
  rejected: "반려",
  hidden: "숨김",
  deleted: "삭제",
};

async function requestJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin", ...init });
  const data = await response.json().catch(() => ({ error: "응답을 확인할 수 없습니다." })) as { error?: string };
  if (!response.ok) throw new Error(data.error || "요청을 처리하지 못했습니다.");
  return data as T;
}

function formatDate(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function categoryLabel(id: Category): string {
  return CATEGORIES.find((entry) => entry.id === id)?.label || "게시글";
}

function mediaUrl(media: BoardMedia): string {
  if (media.claimToken) return `${media.url}?claim=${encodeURIComponent(media.claimToken)}`;
  return media.url;
}

function DialogHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="dialog-head">
      <h2>{title}</h2>
      <button className="icon-btn" type="button" onClick={onClose} aria-label="닫기">×</button>
    </div>
  );
}

function PostThumbnail({ post }: { post: BoardPost }) {
  const selected = post.media.find((item) => item.id === post.thumbnailMediaId) || post.media[0];
  if (selected?.kind === "image") {
    return <div className="thumbnail"><img src={mediaUrl(selected)} alt={selected.alt || ""} loading="lazy" /></div>;
  }
  return (
    <div className={`thumbnail thumbnail-${post.category}`} aria-hidden="true">
      <span className="thumbnail-letter">{post.category === "notice" ? "알" : post.category === "question" ? "문" : "송"}</span>
      {selected?.kind === "video" && <span className="video-badge">▶ 영상</span>}
    </div>
  );
}

export function BoardApp() {
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sort, setSort] = useState("latest");
  const [view, setView] = useState("card");
  const [status, setStatus] = useState("pending");
  const [admin, setAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activePost, setActivePost] = useState<BoardPost | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [draftMedia, setDraftMedia] = useState<BoardMedia[]>([]);
  const [thumbnailMediaId, setThumbnailMediaId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState("");
  const [moderationNote, setModerationNote] = useState("");
  const [reportReason, setReportReason] = useState("");
  const [deletePassword, setDeletePassword] = useState("");

  const writeDialog = useRef<HTMLDialogElement>(null);
  const detailDialog = useRef<HTMLDialogElement>(null);
  const adminDialog = useRef<HTMLDialogElement>(null);
  const reportDialog = useRef<HTMLDialogElement>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const adminPassword = useRef<HTMLInputElement>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  }, []);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "9", category, search, sort, status: admin ? status : "published" });
      const result = await requestJson<ListResult>(`/api/board/posts?${params}`);
      setPosts(result.items);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "게시글을 불러오지 못했습니다.");
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [admin, category, page, search, sort, status, showToast]);

  useEffect(() => {
    requestJson<{ admin: boolean }>("/api/board/admin/session")
      .then((result) => setAdmin(result.admin))
      .catch(() => setAdmin(false));
  }, []);

  useEffect(() => { void loadPosts(); }, [loadPosts]);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("post");
    if (id) void openPost(id, false);
    // URL 진입 시 한 번만 실행합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const availableCategories = useMemo(() => admin ? CATEGORIES : CATEGORIES.filter((entry) => !entry.adminOnly), [admin]);

  async function openPost(id: string, countView = true) {
    try {
      const result = await requestJson<{ item: BoardPost }>(`/api/board/posts/${encodeURIComponent(id)}${countView ? "?view=1" : ""}`);
      setActivePost(result.item);
      setModerationNote(result.item.moderationNote || "");
      detailDialog.current?.showModal();
      const url = new URL(window.location.href);
      url.searchParams.set("post", id);
      history.replaceState(null, "", url);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "게시글을 열지 못했습니다.");
    }
  }

  function closeDetail() {
    detailDialog.current?.close();
    setActivePost(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("post");
    history.replaceState(null, "", url);
  }

  function resetWrite() {
    let restored = emptyDraft;
    if (!admin) {
      try {
        const saved = JSON.parse(localStorage.getItem("songak-board-draft-v2") || "null") as Partial<Draft> | null;
        if (saved) restored = { ...emptyDraft, ...saved, password: "", website: "" };
      } catch { /* 손상된 임시저장은 무시합니다. */ }
    }
    setDraft({ ...restored, category: admin ? "welfare" : restored.category });
    setDraftMedia([]);
    setThumbnailMediaId(null);
    setEditingId("");
  }

  function openWrite(post?: BoardPost) {
    if (post) {
      setDraft({
        category: post.category,
        author: post.author,
        contact: post.contact || "",
        title: post.title,
        body: post.body,
        password: "",
        website: "",
        pinned: post.pinned,
      });
      setDraftMedia(post.media);
      setThumbnailMediaId(post.thumbnailMediaId || post.media[0]?.id || null);
      setEditingId(post.id);
    } else resetWrite();
    writeDialog.current?.showModal();
  }

  function saveDraft() {
    if (admin) return;
    const { password: _password, website: _website, ...safeDraft } = draft;
    localStorage.setItem("songak-board-draft-v2", JSON.stringify(safeDraft));
    showToast("작성 중인 글을 이 기기에 임시저장했습니다.");
  }

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    if (draftMedia.length + files.length > 12) return showToast("사진과 영상은 합계 12개까지 등록할 수 있습니다.");
    setUploading(true);
    try {
      const added: BoardMedia[] = [];
      for (const file of Array.from(files)) {
        const result = await requestJson<{ item: BoardMedia }>("/api/board/media", {
          method: "POST",
          headers: { "content-type": file.type, "x-file-name": encodeURIComponent(file.name) },
          body: file,
        });
        added.push(result.item);
      }
      setDraftMedia((current) => [...current, ...added]);
      setThumbnailMediaId((current) => current || added[0]?.id || null);
      showToast(`${added.length}개 파일을 추가했습니다.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "파일을 올리지 못했습니다.");
    } finally {
      setUploading(false);
    }
  }

  async function submitPost(event: FormEvent) {
    event.preventDefault();
    if (uploading || submitting) return;
    setSubmitting(true);
    try {
      const payload = {
        ...draft,
        media: draftMedia.map((item) => ({ id: item.id, claimToken: item.claimToken, alt: item.alt })),
        thumbnailMediaId,
      };
      if (editingId) {
        await requestJson(`/api/board/posts/${encodeURIComponent(editingId)}`, {
          method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
        });
        showToast(admin ? "게시글을 수정했습니다." : "수정 내용을 다시 검수 요청했습니다.");
      } else {
        await requestJson("/api/board/posts", {
          method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
        });
        if (!admin) localStorage.removeItem("songak-board-draft-v2");
        showToast(admin ? "복지관 소식을 게시했습니다." : "접수되었습니다. 관리자 확인 후 공개됩니다.");
      }
      writeDialog.current?.close();
      closeDetail();
      await loadPosts();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "게시글을 저장하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function loginAdmin(event: FormEvent) {
    event.preventDefault();
    try {
      await requestJson("/api/board/admin/login", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: adminPassword.current?.value || "" }),
      });
      setAdmin(true);
      setStatus("pending");
      setPage(1);
      adminDialog.current?.close();
      if (adminPassword.current) adminPassword.current.value = "";
      showToast("관리자 검수 화면을 열었습니다.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "관리자 로그인을 확인해 주세요.");
    }
  }

  async function logoutAdmin() {
    await requestJson("/api/board/admin/logout", { method: "POST" }).catch(() => null);
    setAdmin(false);
    setCategory("all");
    setPage(1);
    showToast("관리자 화면을 종료했습니다.");
  }

  async function moderate(nextStatus: PostStatus) {
    if (!activePost) return;
    try {
      const result = await requestJson<{ item: BoardPost }>(`/api/board/posts/${activePost.id}/moderate`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: nextStatus, note: moderationNote }),
      });
      setActivePost(result.item);
      showToast(nextStatus === "published" ? "게시글을 공개했습니다." : nextStatus === "rejected" ? "게시글을 반려했습니다." : "게시글을 숨겼습니다.");
      await loadPosts();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "검수 상태를 변경하지 못했습니다.");
    }
  }

  async function sharePost() {
    if (!activePost) return;
    const url = new URL(window.location.href);
    url.searchParams.set("post", activePost.id);
    try {
      if (navigator.share) await navigator.share({ title: activePost.title, text: activePost.body.slice(0, 90), url: url.toString() });
      else { await navigator.clipboard.writeText(url.toString()); showToast("게시글 주소를 복사했습니다."); }
      void requestJson(`/api/board/posts/${activePost.id}/share`, { method: "POST" });
    } catch (error) {
      if ((error as DOMException)?.name !== "AbortError") showToast("공유를 완료하지 못했습니다.");
    }
  }

  async function submitReport(event: FormEvent) {
    event.preventDefault();
    if (!activePost) return;
    try {
      await requestJson(`/api/board/posts/${activePost.id}/report`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: reportReason }),
      });
      setReportReason("");
      reportDialog.current?.close();
      showToast("신고를 접수했습니다. 관리자가 확인하겠습니다.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "신고를 접수하지 못했습니다.");
    }
  }

  async function deleteActivePost(event: FormEvent) {
    event.preventDefault();
    if (!activePost) return;
    try {
      await requestJson(`/api/board/posts/${activePost.id}`, {
        method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: deletePassword }),
      });
      setDeletePassword("");
      deleteDialog.current?.close();
      closeDetail();
      showToast("게시글을 삭제했습니다.");
      await loadPosts();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "게시글을 삭제하지 못했습니다.");
    }
  }

  function applySearch(event: FormEvent) {
    event.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }

  return (
    <>
      <a className="skip-link" href="#board-list">게시글 목록으로 이동</a>
      <header className="site-header">
        <a className="brand" href="/" aria-label="송악사회복지관 소통게시판 홈">
          <span className="brand-mark">송</span><span><b>송악사회복지관</b><small>소통게시판</small></span>
        </a>
        <nav className="header-nav" aria-label="게시판 주요 메뉴">
          <button type="button" onClick={() => { setCategory("notice"); setPage(1); }}>공지</button>
          <button type="button" onClick={() => { setCategory("welfare"); setPage(1); }}>복지관 소식</button>
          <button type="button" onClick={() => { setCategory("resident"); setPage(1); }}>주민 이야기</button>
        </nav>
        <span className="header-spacer" />
        <a className="home-link" href="https://www.sacwc.kr/">복지관 홈페이지</a>
        <button className="secondary-btn admin-entry" type="button" onClick={() => admin ? logoutAdmin() : adminDialog.current?.showModal()}>
          {admin ? "관리 종료" : "관리자"}
        </button>
        <button className="primary-btn header-write" type="button" onClick={() => openWrite()}>{admin ? "복지관 소식 등록" : "글쓰기"}</button>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy-wrap">
            <p className="eyebrow">SONGAK COMMUNITY</p>
            <h1>복지관과 주민이<br />함께 전하는 이야기</h1>
            <p className="hero-copy">복지관 소식은 빠르게 확인하고, 우리 동네 이야기는 사진과 영상으로 편하게 남겨주세요.</p>
            <div className="hero-actions">
              <button className="primary-btn" type="button" onClick={() => openWrite()}>{admin ? "공식 소식 등록" : "주민 글쓰기"}</button>
              <a className="secondary-btn button-link" href="#board-list">소식 둘러보기</a>
            </div>
          </div>
          <aside className="hero-guide" aria-label="게시판 이용 안내">
            <p className="guide-label">누구나 안심하고 참여해요</p>
            <ol>
              <li><span>1</span><div><b>간편하게 작성</b><small>PC와 모바일에서 사진·영상 첨부</small></div></li>
              <li><span>2</span><div><b>안전하게 확인</b><small>주민 글은 관리자 검수 후 공개</small></div></li>
              <li><span>3</span><div><b>쉽게 공유</b><small>카카오톡·문자·링크로 소식 전달</small></div></li>
            </ol>
          </aside>
        </section>

        <section className="board-shell" id="board-list" aria-label="게시글 목록">
          {admin && (
            <div className="admin-console">
              <div><span className="admin-dot" /><b>관리자 검수 화면</b><small>주민 게시글을 확인하고 공개·반려·숨김 처리할 수 있습니다.</small></div>
              <label>표시 상태
                <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
                  <option value="pending">승인 대기</option><option value="published">공개</option><option value="rejected">반려</option><option value="hidden">숨김</option><option value="all">전체</option>
                </select>
              </label>
              <button className="admin-write" type="button" onClick={() => openWrite()}>＋ 공식 소식 등록</button>
            </div>
          )}

          <div className="board-toolbar">
            <form className="search-box" onSubmit={applySearch} role="search">
              <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} maxLength={100} placeholder="제목, 내용, 작성자 검색" aria-label="게시글 검색" />
              <button type="submit" aria-label="검색">검색</button>
            </form>
            <select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }} aria-label="게시글 정렬">
              <option value="latest">최신순</option><option value="views">조회순</option>
            </select>
            <div className="view-toggle" aria-label="보기 방식">
              <button className={view === "card" ? "active" : ""} type="button" onClick={() => setView("card")} aria-label="카드형 보기">▦</button>
              <button className={view === "list" ? "active" : ""} type="button" onClick={() => setView("list")} aria-label="목록형 보기">☷</button>
            </div>
          </div>

          <nav className="category-tabs" aria-label="게시글 분류">
            {[{ id: "all", label: "전체" }, ...CATEGORIES].map((entry) => (
              <button key={entry.id} className={category === entry.id ? "active" : ""} type="button" onClick={() => { setCategory(entry.id); setPage(1); }} aria-pressed={category === entry.id}>{entry.label}</button>
            ))}
          </nav>

          <div className="section-heading"><div><p className="eyebrow">COMMUNITY NEWS</p><h2>{admin ? statusLabels[status as PostStatus] || "전체 게시글" : "함께 나누는 소식"}</h2></div><span>{loading ? "불러오는 중" : `총 ${total}건`}</span></div>

          {loading ? (
            <div className="loading-grid" aria-label="게시글 불러오는 중">{[1,2,3].map((item) => <div key={item} className="loading-card" />)}</div>
          ) : posts.length ? (
            <div className={`post-grid ${view === "list" ? "list-view" : ""}`}>
              {posts.map((post) => (
                <article className="post-card" key={post.id}>
                  <button className="post-card-button" type="button" onClick={() => void openPost(post.id)} aria-label={`${post.title} 게시글 보기`}>
                    <PostThumbnail post={post} />
                    <div className="post-card-body">
                      <div className="post-meta"><span className="category-badge">{categoryLabel(post.category)}</span><time>{formatDate(post.publishedAt || post.createdAt)}</time>{admin && post.status !== "published" && <span className={`status-pill status-${post.status}`}>{statusLabels[post.status]}</span>}</div>
                      <h3>{post.title}</h3><p>{post.body}</p>
                      <div className="post-stats"><span>{post.author}</span><span>조회 {post.views}</span>{post.media.length > 0 && <span>첨부 {post.media.length}</span>}</div>
                    </div>
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state"><span>송</span><h3>조건에 맞는 소식이 없습니다.</h3><p>검색어를 바꾸거나 첫 번째 이야기를 남겨보세요.</p><button className="primary-btn" type="button" onClick={() => openWrite()}>글쓰기</button></div>
          )}

          {totalPages > 1 && <div className="pagination"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>이전</button><span><b>{page}</b> / {totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>다음</button></div>}
        </section>
      </main>

      <footer className="site-footer"><div><b>송악사회복지관</b><span>(31728) 충남 당진시 송악읍 송악로 656</span><span>041-353-5077</span></div><p>주민과 함께 행복한 지역공동체를 만들어갑니다.</p></footer>
      <button className="mobile-write" type="button" onClick={() => openWrite()} aria-label="게시글 작성">＋</button>

      <dialog ref={writeDialog} className="write-dialog" onCancel={(event) => { event.preventDefault(); writeDialog.current?.close(); }}>
        <form onSubmit={submitPost}>
          <DialogHeader title={editingId ? "게시글 수정" : admin ? "복지관 소식 등록" : "주민 글쓰기"} onClose={() => writeDialog.current?.close()} />
          <div className="dialog-body">
            {!admin && !editingId && <div className="notice-box"><b>작성한 글은 관리자 확인 후 공개됩니다.</b><span>연락처는 검수 목적으로만 사용되며 게시판에 표시되지 않습니다.</span></div>}
            <div className="field-grid">
              <label className="field"><span>분류 <em>필수</em></span><select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as Category })}>{availableCategories.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select></label>
              <label className="field"><span>작성자 <em>필수</em></span><input required maxLength={40} value={draft.author} onChange={(event) => setDraft({ ...draft, author: event.target.value })} placeholder="이름 또는 별명" /></label>
              <label className="field full"><span>제목 <em>필수</em></span><input required minLength={2} maxLength={160} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="어떤 소식인지 한눈에 알 수 있게 적어주세요" /></label>
              <label className="field full"><span>내용 <em>필수</em></span><textarea required minLength={10} maxLength={20000} value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} placeholder="개인정보가 포함되지 않도록 확인해 주세요" /></label>
              <label className="field honeypot" aria-hidden="true"><span>웹사이트</span><input tabIndex={-1} autoComplete="off" value={draft.website} onChange={(event) => setDraft({ ...draft, website: event.target.value })} /></label>
              <div className="field full"><span>사진·영상 <small>최대 12개 · 사진 15MB · 영상 100MB</small></span><label className={`upload-zone ${uploading ? "uploading" : ""}`}><input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" multiple disabled={uploading} onChange={(event) => { void uploadFiles(event.target.files); event.currentTarget.value = ""; }} /><b>{uploading ? "안전하게 올리는 중…" : "＋ 사진·영상 추가"}</b><span>파일을 선택하거나 모바일에서 바로 촬영해 올릴 수 있습니다.</span></label></div>
              {draftMedia.length > 0 && <div className="media-preview full">{draftMedia.map((item) => <div className="media-tile" key={item.id}>{item.kind === "image" ? <img src={mediaUrl(item)} alt="" /> : <video src={mediaUrl(item)} muted preload="metadata" />}<div className="media-controls"><button className={thumbnailMediaId === item.id ? "selected" : ""} type="button" onClick={() => setThumbnailMediaId(item.id)}>{thumbnailMediaId === item.id ? "대표" : "대표 선택"}</button>{item.claimToken && <button type="button" onClick={() => { setDraftMedia((current) => current.filter((entry) => entry.id !== item.id)); if (thumbnailMediaId === item.id) setThumbnailMediaId(null); }}>삭제</button>}</div><input aria-label={`${item.name} 설명`} value={item.alt} onChange={(event) => setDraftMedia((current) => current.map((entry) => entry.id === item.id ? { ...entry, alt: event.target.value } : entry))} placeholder="사진 설명(선택)" /></div>)}</div>}
              <label className="field"><span>연락처 <small>비공개</small></span><input maxLength={120} value={draft.contact} onChange={(event) => setDraft({ ...draft, contact: event.target.value })} placeholder="전화 또는 이메일" /></label>
              {!admin && <label className="field"><span>수정·삭제 비밀번호 <em>필수</em></span><input required minLength={6} maxLength={32} type="password" value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} placeholder="6~32자" /></label>}
              {admin && <label className="check-field full"><input type="checkbox" checked={draft.pinned} onChange={(event) => setDraft({ ...draft, pinned: event.target.checked })} />상단 중요 공지로 고정</label>}
            </div>
          </div>
          <div className="dialog-actions">{!admin && !editingId && <button className="ghost-btn" type="button" onClick={saveDraft}>임시저장</button>}<button className="secondary-btn" type="button" onClick={() => writeDialog.current?.close()}>취소</button><button className="primary-btn" type="submit" disabled={submitting || uploading}>{submitting ? "저장 중…" : admin ? "바로 게시" : editingId ? "수정 검수 요청" : "검수 요청"}</button></div>
        </form>
      </dialog>

      <dialog ref={detailDialog} className="detail-dialog" onClose={() => setActivePost(null)}>
        {activePost && <><DialogHeader title="게시글" onClose={closeDetail} /><article className="dialog-body detail-body"><div className="detail-meta"><span>{categoryLabel(activePost.category)}</span><time>{formatDate(activePost.publishedAt || activePost.createdAt)}</time><span>작성자 {activePost.author}</span><span>조회 {activePost.views}</span>{admin && <span className={`status-pill status-${activePost.status}`}>{statusLabels[activePost.status]}</span>}</div><h2>{activePost.title}</h2><div className="detail-content">{activePost.body}</div>{activePost.media.length > 0 && <div className="detail-media">{activePost.media.map((item) => <figure key={item.id}>{item.kind === "image" ? <img src={mediaUrl(item)} alt={item.alt || ""} /> : <video src={mediaUrl(item)} controls preload="metadata" />}{item.alt && <figcaption>{item.alt}</figcaption>}</figure>)}</div>}<div className="detail-tools"><button className="secondary-btn" type="button" onClick={() => void sharePost()}>공유하기</button><button className="ghost-btn" type="button" onClick={() => reportDialog.current?.showModal()}>신고</button><button className="ghost-btn" type="button" onClick={() => openWrite(activePost)}>수정</button><button className="ghost-btn danger-text" type="button" onClick={() => deleteDialog.current?.showModal()}>삭제</button></div>{admin && <section className="moderation-panel"><div><b>관리자 검수</b><span>개인정보·비방·광고·저작권 침해 여부를 확인하세요.</span></div>{activePost.contact && <p><b>작성자 연락처</b> {activePost.contact}</p>}<textarea value={moderationNote} onChange={(event) => setModerationNote(event.target.value)} maxLength={500} placeholder="반려 사유 또는 내부 메모(작성자에게 공개하지 않음)" /><div><button className="approve-btn" type="button" onClick={() => void moderate("published")}>공개 승인</button><button className="reject-btn" type="button" onClick={() => void moderate("rejected")}>반려</button><button className="hide-btn" type="button" onClick={() => void moderate("hidden")}>숨김</button></div></section>}</article></>}
      </dialog>

      <dialog ref={adminDialog} className="small-dialog"><form onSubmit={loginAdmin}><DialogHeader title="관리자 로그인" onClose={() => adminDialog.current?.close()} /><div className="dialog-body"><p className="dialog-copy">복지관 담당자만 이용하는 검수 화면입니다.</p><label className="field"><span>관리자 비밀번호</span><input ref={adminPassword} required type="password" autoComplete="current-password" /></label></div><div className="dialog-actions"><button className="secondary-btn" type="button" onClick={() => adminDialog.current?.close()}>취소</button><button className="primary-btn" type="submit">로그인</button></div></form></dialog>
      <dialog ref={reportDialog} className="small-dialog"><form onSubmit={submitReport}><DialogHeader title="게시글 신고" onClose={() => reportDialog.current?.close()} /><div className="dialog-body"><p className="dialog-copy">개인정보 노출, 비방, 광고, 저작권 침해 등 확인이 필요한 이유를 알려주세요.</p><label className="field"><span>신고 사유</span><textarea required minLength={2} maxLength={300} value={reportReason} onChange={(event) => setReportReason(event.target.value)} /></label></div><div className="dialog-actions"><button className="secondary-btn" type="button" onClick={() => reportDialog.current?.close()}>취소</button><button className="danger-btn" type="submit">신고 접수</button></div></form></dialog>
      <dialog ref={deleteDialog} className="small-dialog"><form onSubmit={deleteActivePost}><DialogHeader title="게시글 삭제" onClose={() => deleteDialog.current?.close()} /><div className="dialog-body"><p className="dialog-copy">삭제한 게시글은 일반 화면에서 즉시 보이지 않습니다.</p>{!admin && <label className="field"><span>작성 시 입력한 비밀번호</span><input required type="password" minLength={6} maxLength={32} value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} /></label>}</div><div className="dialog-actions"><button className="secondary-btn" type="button" onClick={() => deleteDialog.current?.close()}>취소</button><button className="danger-btn" type="submit">삭제</button></div></form></dialog>

      <div className={`toast ${toast ? "show" : ""}`} role="status" aria-live="polite">{toast}</div>
    </>
  );
}
