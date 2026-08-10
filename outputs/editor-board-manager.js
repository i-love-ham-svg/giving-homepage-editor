(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SongakBoardManager = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CATEGORIES = Object.freeze([
    Object.freeze({ id: "notice", label: "공지", adminOnly: true }),
    Object.freeze({ id: "welfare", label: "복지관 소식", adminOnly: true }),
    Object.freeze({ id: "resident", label: "주민 이야기", adminOnly: false }),
    Object.freeze({ id: "question", label: "질문·제안", adminOnly: false })
  ]);
  const STATUSES = Object.freeze(["pending", "published", "rejected", "hidden"]);
  const IMAGE_TYPES = Object.freeze(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
  const VIDEO_TYPES = Object.freeze(["video/mp4", "video/webm", "video/quicktime"]);

  function cleanText(value, maxLength = 10_000) {
    return String(value ?? "")
      .replace(/\u0000/g, "")
      .replace(/\r\n?/g, "\n")
      .trim()
      .slice(0, maxLength);
  }

  function normalizeMedia(media, index = 0) {
    const type = cleanText(media?.type, 80).toLowerCase();
    const kind = type.startsWith("video/") ? "video" : "image";
    return {
      id: cleanText(media?.id, 100) || `media-${index + 1}`,
      kind,
      type,
      name: cleanText(media?.name, 180) || `${kind}-${index + 1}`,
      url: cleanText(media?.url, 2_000),
      thumbnailUrl: cleanText(media?.thumbnailUrl, 2_000),
      alt: cleanText(media?.alt, 240),
      size: Math.max(0, Number(media?.size) || 0)
    };
  }

  function normalizePost(post, index = 0) {
    const category = CATEGORIES.some((entry) => entry.id === post?.category) ? post.category : "resident";
    const status = STATUSES.includes(post?.status) ? post.status : "pending";
    const media = Array.isArray(post?.media) ? post.media.slice(0, 12).map(normalizeMedia) : [];
    const thumbnailIndex = Math.min(Math.max(0, Number(post?.thumbnailIndex) || 0), Math.max(0, media.length - 1));
    return {
      id: cleanText(post?.id, 100) || `post-${index + 1}`,
      category,
      status,
      title: cleanText(post?.title, 160),
      body: cleanText(post?.body, 20_000),
      author: cleanText(post?.author, 40) || "익명 주민",
      createdAt: cleanText(post?.createdAt, 60) || new Date().toISOString(),
      updatedAt: cleanText(post?.updatedAt, 60) || cleanText(post?.createdAt, 60) || new Date().toISOString(),
      publishedAt: cleanText(post?.publishedAt, 60),
      media,
      thumbnailIndex,
      pinned: Boolean(post?.pinned),
      views: Math.max(0, Number(post?.views) || 0),
      reports: Math.max(0, Number(post?.reports) || 0),
      shareCount: Math.max(0, Number(post?.shareCount) || 0),
      official: Boolean(post?.official) || category === "notice" || category === "welfare"
    };
  }

  function validateDraft(draft, options = {}) {
    const isAdmin = Boolean(options.isAdmin);
    const title = cleanText(draft?.title, 160);
    const body = cleanText(draft?.body, 20_000);
    const author = cleanText(draft?.author, 40);
    const password = String(draft?.password ?? "");
    const category = CATEGORIES.find((entry) => entry.id === draft?.category);
    if (!category) return { ok: false, error: "게시글 분류를 선택해 주세요." };
    if (category.adminOnly && !isAdmin) return { ok: false, error: "공식 소식은 관리자만 작성할 수 있습니다." };
    if (title.length < 2) return { ok: false, error: "제목을 2자 이상 입력해 주세요." };
    if (body.length < 10) return { ok: false, error: "내용을 10자 이상 입력해 주세요." };
    if (!author) return { ok: false, error: "작성자 이름 또는 닉네임을 입력해 주세요." };
    if (!isAdmin && (password.length < 4 || password.length > 32)) {
      return { ok: false, error: "수정·삭제 비밀번호를 4~32자로 입력해 주세요." };
    }
    const media = Array.isArray(draft?.media) ? draft.media : [];
    if (media.length > 12) return { ok: false, error: "사진과 영상은 합쳐서 최대 12개까지 등록할 수 있습니다." };
    return { ok: true, error: "" };
  }

  function getCategory(categoryId) {
    return CATEGORIES.find((entry) => entry.id === categoryId) ?? CATEGORIES[2];
  }

  function getThumbnail(post) {
    const normalized = normalizePost(post);
    const selected = normalized.media[normalized.thumbnailIndex] ?? normalized.media[0];
    if (!selected) return { url: "", kind: "none", alt: "" };
    if (selected.kind === "video") {
      return { url: selected.thumbnailUrl, kind: selected.thumbnailUrl ? "image" : "video", alt: selected.alt || normalized.title };
    }
    return { url: selected.url, kind: "image", alt: selected.alt || normalized.title };
  }

  function filterPosts(posts, query = {}) {
    const search = cleanText(query.search, 100).toLocaleLowerCase("ko-KR");
    return (Array.isArray(posts) ? posts : [])
      .map(normalizePost)
      .filter((post) => !query.status || query.status === "all" || post.status === query.status)
      .filter((post) => !query.category || query.category === "all" || post.category === query.category)
      .filter((post) => !search || `${post.title}\n${post.body}\n${post.author}`.toLocaleLowerCase("ko-KR").includes(search));
  }

  function sortPosts(posts, sort = "latest") {
    return [...(Array.isArray(posts) ? posts : [])].sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
      if (sort === "views") return (Number(b.views) || 0) - (Number(a.views) || 0);
      return new Date(b.publishedAt || b.createdAt || 0) - new Date(a.publishedAt || a.createdAt || 0);
    });
  }

  function createShareUrl(baseUrl, postId) {
    const url = new URL(String(baseUrl || "http://localhost/"));
    url.searchParams.set("post", cleanText(postId, 100));
    return url.toString();
  }

  return Object.freeze({
    CATEGORIES,
    STATUSES,
    IMAGE_TYPES,
    VIDEO_TYPES,
    cleanText,
    normalizeMedia,
    normalizePost,
    validateDraft,
    getCategory,
    getThumbnail,
    filterPosts,
    sortPosts,
    createShareUrl
  });
});
