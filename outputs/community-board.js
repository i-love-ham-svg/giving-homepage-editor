(function () {
  "use strict";

  const board = window.SongakBoardManager;
  if (!board) throw new Error("게시판 관리 모듈을 불러오지 못했습니다.");

  const elements = Object.fromEntries([
    "adminBtn", "adminBar", "adminStatusSelect", "adminLogoutBtn", "writeHeaderBtn", "writeHeroBtn", "mobileWriteBtn",
    "guideBtn", "boardGuide", "searchForm", "searchInput", "sortSelect", "viewSelect", "categoryTabs", "resultCount",
    "postGrid", "emptyState", "pagination", "prevPageBtn", "nextPageBtn", "pageInfo", "writeDialog", "writeDialogTitle",
    "writeForm", "editingPostId", "postCategory", "postAuthor", "postTitle", "postBody", "postPassword", "postContact",
    "mediaInput", "mediaPreview", "uploadProgress", "postConsent", "saveDraftBtn", "deleteDraftBtn", "submitPostBtn", "detailDialog",
    "detailCategory", "detailTitle", "detailMeta", "detailBody", "detailMedia", "sharePostBtn", "editPostBtn",
    "deletePostBtn", "reportPostBtn", "moderationTools", "toast"
  ].map((id) => [id, document.getElementById(id)]));

  const state = {
    category: "all",
    search: "",
    sort: "latest",
    page: 1,
    totalPages: 1,
    adminKey: sessionStorage.getItem("songak-board-admin-key") || "",
    posts: [],
    activePost: null,
    mediaDraft: [],
    thumbnailIndex: 0,
    loading: false
  };

  let boardDraftExpiryTimer = null;

  function clearBoardDraftExpiryTimer() {
    if (boardDraftExpiryTimer !== null) window.clearTimeout(boardDraftExpiryTimer);
    boardDraftExpiryTimer = null;
  }

  function removeBoardDraft() {
    clearBoardDraftExpiryTimer();
    sessionStorage.removeItem("songak-board-draft");
  }

  function scheduleBoardDraftExpiry(expiresAt) {
    clearBoardDraftExpiryTimer();
    const remaining = Number(expiresAt) - Date.now();
    if (!Number.isFinite(remaining) || remaining <= 0) {
      removeBoardDraft();
      return;
    }
    boardDraftExpiryTimer = window.setTimeout(removeBoardDraft, remaining);
  }

  function scheduleStoredBoardDraftExpiry() {
    try {
      const draft = JSON.parse(sessionStorage.getItem("songak-board-draft") || "null");
      if (draft) scheduleBoardDraftExpiry(draft.expiresAt);
    } catch {
      removeBoardDraft();
    }
  }

  function showToast(message) {
    elements.toast.textContent = String(message || "");
    elements.toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => elements.toast.classList.remove("show"), 2600);
  }

  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (state.adminKey) headers.set("x-board-admin-key", state.adminKey);
    if (options.json !== undefined) {
      headers.set("content-type", "application/json");
      options.body = JSON.stringify(options.json);
    }
    const response = await fetch(path, { ...options, headers });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "요청을 처리하지 못했습니다.");
    return payload;
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  }

  function statusLabel(status) {
    return { pending: "승인 대기", published: "공개", rejected: "반려", hidden: "숨김" }[status] || status;
  }

  function createButton(label, className, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    if (onClick) button.addEventListener("click", onClick);
    return button;
  }

  function renderCategoryTabs() {
    const entries = [{ id: "all", label: "전체" }, ...board.CATEGORIES];
    elements.categoryTabs.replaceChildren(...entries.map((entry) => {
      const button = createButton(entry.label, `category-tab${state.category === entry.id ? " active" : ""}`, () => {
        state.category = entry.id;
        state.page = 1;
        renderCategoryTabs();
        loadPosts();
      });
      button.setAttribute("aria-pressed", String(state.category === entry.id));
      return button;
    }));
  }

  function createThumbnail(post) {
    const container = document.createElement("div");
    container.className = "thumbnail";
    const thumbnail = board.getThumbnail(post);
    if (thumbnail.url) {
      const image = document.createElement("img");
      image.src = thumbnail.url;
      image.alt = thumbnail.alt || "";
      image.loading = "lazy";
      container.append(image);
    } else {
      const letter = document.createElement("span");
      letter.className = "thumbnail-letter";
      letter.textContent = post.category === "notice" ? "알" : post.category === "question" ? "문" : "송";
      container.append(letter);
    }
    if (post.media.some((media) => media.kind === "video")) {
      const badge = document.createElement("span");
      badge.className = "video-badge";
      badge.textContent = "▶ 영상";
      container.append(badge);
    }
    if (post.pinned) {
      const pin = document.createElement("span");
      pin.className = "pin-badge";
      pin.textContent = "중요";
      container.append(pin);
    }
    return container;
  }

  function createPostCard(post) {
    const article = document.createElement("article");
    article.className = "post-card";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "post-card-button";
    button.setAttribute("aria-label", `${post.title} 게시글 보기`);
    button.addEventListener("click", () => openPost(post.id));
    button.append(createThumbnail(post));

    const body = document.createElement("div");
    body.className = "post-card-body";
    const meta = document.createElement("div");
    meta.className = "post-meta";
    const category = document.createElement("span");
    category.className = "category-badge";
    category.textContent = board.getCategory(post.category).label;
    const date = document.createElement("span");
    date.textContent = formatDate(post.publishedAt || post.createdAt);
    meta.append(category, date);
    if (state.adminKey && post.status !== "published") {
      const status = document.createElement("span");
      status.className = "status-badge";
      status.textContent = statusLabel(post.status);
      meta.append(status);
    }
    const title = document.createElement("h3");
    title.textContent = post.title;
    const excerpt = document.createElement("p");
    excerpt.className = "post-excerpt";
    excerpt.textContent = post.body;
    const stats = document.createElement("div");
    stats.className = "post-stats";
    stats.textContent = `${post.author} · 조회 ${post.views} · 첨부 ${post.media.length}`;
    body.append(meta, title, excerpt, stats);
    button.append(body);
    article.append(button);
    return article;
  }

  function renderPosts(result) {
    state.posts = result.items.map(board.normalizePost);
    state.totalPages = result.totalPages;
    elements.postGrid.replaceChildren(...state.posts.map(createPostCard));
    elements.emptyState.hidden = state.posts.length > 0;
    elements.resultCount.textContent = `총 ${result.total}건`;
    elements.pageInfo.textContent = `${result.page} / ${result.totalPages}`;
    elements.prevPageBtn.disabled = result.page <= 1;
    elements.nextPageBtn.disabled = result.page >= result.totalPages;
    elements.pagination.hidden = result.total <= result.pageSize;
  }

  async function loadPosts() {
    if (state.loading) return;
    state.loading = true;
    elements.resultCount.textContent = "불러오는 중";
    try {
      const params = new URLSearchParams({
        page: String(state.page),
        pageSize: "9",
        category: state.category,
        search: state.search,
        sort: state.sort,
        status: state.adminKey ? elements.adminStatusSelect.value : "published"
      });
      renderPosts(await api(`/api/board/posts?${params}`));
    } catch (error) {
      elements.postGrid.replaceChildren();
      elements.emptyState.hidden = false;
      elements.emptyState.querySelector("strong").textContent = "게시글을 불러오지 못했습니다.";
      showToast(error.message);
    } finally {
      state.loading = false;
    }
  }

  function setAdminMode(enabled) {
    elements.adminBar.hidden = !enabled;
    elements.adminBtn.textContent = enabled ? "관리 중" : "관리자";
    elements.moderationTools.hidden = !enabled || !state.activePost;
    const current = elements.postCategory.value;
    const options = enabled ? board.CATEGORIES : board.CATEGORIES.filter((entry) => !entry.adminOnly);
    elements.postCategory.replaceChildren(...options.map((entry) => {
      const option = document.createElement("option");
      option.value = entry.id;
      option.textContent = entry.label;
      return option;
    }));
    elements.postCategory.value = options.some((entry) => entry.id === current) ? current : options[0].id;
    elements.postPassword.required = !enabled;
    elements.submitPostBtn.textContent = enabled ? "바로 게시" : "검수 요청";
  }

  function resetWriteForm() {
    elements.writeForm.reset();
    elements.editingPostId.value = "";
    state.mediaDraft.forEach((entry) => entry.previewUrl && URL.revokeObjectURL(entry.previewUrl));
    state.mediaDraft = [];
    state.thumbnailIndex = 0;
    elements.mediaPreview.replaceChildren();
    elements.writeDialogTitle.textContent = state.adminKey ? "복지관 소식 작성" : "주민 글쓰기";
    setAdminMode(Boolean(state.adminKey));
  }

  function openWriteDialog(post = null) {
    resetWriteForm();
    if (post) {
      elements.writeDialogTitle.textContent = "게시글 수정";
      elements.editingPostId.value = post.id;
      elements.postCategory.value = post.category;
      elements.postAuthor.value = post.author;
      elements.postTitle.value = post.title;
      elements.postBody.value = post.body;
      elements.postContact.value = post.contact || "";
      state.mediaDraft = post.media.map((descriptor) => ({ descriptor }));
      state.thumbnailIndex = post.thumbnailIndex || 0;
      renderMediaPreview();
    } else {
      restoreDraft();
    }
    elements.writeDialog.showModal();
    setTimeout(() => elements.postTitle.focus(), 50);
  }

  function saveDraft() {
    if (!elements.postConsent.checked) {
      showToast("개인정보 처리 동의 후 임시저장할 수 있습니다.");
      elements.postConsent.focus();
      return;
    }
    const expiresAt = Date.now() + 30 * 60 * 1000;
    sessionStorage.setItem("songak-board-draft", JSON.stringify({
      category: elements.postCategory.value,
      author: elements.postAuthor.value,
      title: elements.postTitle.value,
      body: elements.postBody.value,
      contact: elements.postContact.value,
      savedAt: new Date().toISOString(),
      expiresAt
    }));
    scheduleBoardDraftExpiry(expiresAt);
    showToast("작성 중인 글을 이 탭에 30분간 임시저장했습니다.");
  }

  function restoreDraft() {
    try {
      localStorage.removeItem("songak-board-draft");
      const draft = JSON.parse(sessionStorage.getItem("songak-board-draft") || "null");
      if (!draft) return;
      if (!draft.expiresAt || draft.expiresAt <= Date.now()) {
        removeBoardDraft();
        return;
      }
      scheduleBoardDraftExpiry(draft.expiresAt);
      if (!window.confirm("이 탭에 임시저장된 글을 불러올까요? (30분 후 자동 삭제)")) return;
      if ([...elements.postCategory.options].some((option) => option.value === draft.category)) elements.postCategory.value = draft.category;
      elements.postAuthor.value = draft.author || "";
      elements.postTitle.value = draft.title || "";
      elements.postBody.value = draft.body || "";
      elements.postContact.value = draft.contact || "";
      showToast("이 탭의 임시저장 글을 불러왔습니다.");
    } catch {}
  }

  function deleteDraft() {
    if (!sessionStorage.getItem("songak-board-draft")) return showToast("삭제할 임시저장 글이 없습니다.");
    if (!window.confirm("임시저장 글과 현재 입력한 개인정보를 삭제할까요?")) return;
    removeBoardDraft();
    elements.postAuthor.value = "";
    elements.postTitle.value = "";
    elements.postBody.value = "";
    elements.postContact.value = "";
    showToast("임시저장 글과 입력 정보를 삭제했습니다.");
  }

  function validateFile(file) {
    const isImage = board.IMAGE_TYPES.includes(file.type);
    const isVideo = board.VIDEO_TYPES.includes(file.type);
    if (!isImage && !isVideo) return "JPG, PNG, WebP, GIF, AVIF, MP4, WebM, MOV 파일만 등록할 수 있습니다.";
    const limit = isVideo ? 100 * 1024 * 1024 : 15 * 1024 * 1024;
    if (file.size > limit) return `${isVideo ? "영상" : "사진"}은 ${Math.round(limit / 1024 / 1024)}MB 이하만 등록할 수 있습니다.`;
    return "";
  }

  async function captureVideoThumbnail(file) {
    const url = URL.createObjectURL(file);
    try {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.src = url;
      await new Promise((resolve, reject) => {
        video.addEventListener("loadedmetadata", resolve, { once: true });
        video.addEventListener("error", reject, { once: true });
      });
      video.currentTime = Math.min(1, Math.max(0, video.duration / 4));
      await new Promise((resolve) => video.addEventListener("seeked", resolve, { once: true }));
      const width = Math.min(960, video.videoWidth || 640);
      const height = Math.round(width * (video.videoHeight || 360) / (video.videoWidth || 640));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(video, 0, 0, width, height);
      return await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", .82));
    } catch {
      return null;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function addSelectedMedia(files) {
    const list = [...files];
    if (state.mediaDraft.length + list.length > 12) return showToast("사진과 영상은 합쳐서 최대 12개까지 등록할 수 있습니다.");
    for (const file of list) {
      const error = validateFile(file);
      if (error) { showToast(error); continue; }
      const entry = { file, previewUrl: URL.createObjectURL(file), descriptor: null, thumbnailFile: null };
      if (file.type.startsWith("video/")) entry.thumbnailFile = await captureVideoThumbnail(file);
      state.mediaDraft.push(entry);
    }
    renderMediaPreview();
  }

  function renderMediaPreview() {
    elements.mediaPreview.replaceChildren(...state.mediaDraft.map((entry, index) => {
      const tile = document.createElement("div");
      tile.className = "media-tile";
      const source = entry.previewUrl || entry.descriptor?.url;
      if ((entry.file?.type || entry.descriptor?.type || "").startsWith("video/")) {
        const video = document.createElement("video");
        video.src = source;
        video.muted = true;
        video.playsInline = true;
        tile.append(video);
      } else {
        const image = document.createElement("img");
        image.src = source;
        image.alt = entry.file?.name || entry.descriptor?.alt || "첨부 사진";
        tile.append(image);
      }
      const controls = document.createElement("div");
      controls.className = "media-tile-controls";
      const thumbnail = createButton(index === state.thumbnailIndex ? "대표" : "대표 선택", index === state.thumbnailIndex ? "selected-thumb" : "", () => {
        state.thumbnailIndex = index;
        renderMediaPreview();
      });
      const remove = createButton("삭제", "", () => {
        const [removed] = state.mediaDraft.splice(index, 1);
        if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
        state.thumbnailIndex = Math.min(state.thumbnailIndex, Math.max(0, state.mediaDraft.length - 1));
        renderMediaPreview();
      });
      controls.append(thumbnail, remove);
      tile.append(controls);
      return tile;
    }));
  }

  async function uploadFile(file) {
    const response = await api("/api/board/media", {
      method: "POST",
      headers: { "content-type": file.type, "x-file-name": encodeURIComponent(file.name) },
      body: file
    });
    return response.item;
  }

  async function uploadMediaDraft() {
    const descriptors = [];
    elements.uploadProgress.hidden = false;
    const progress = elements.uploadProgress.querySelector("span");
    for (let index = 0; index < state.mediaDraft.length; index += 1) {
      const entry = state.mediaDraft[index];
      let descriptor = entry.descriptor;
      if (!descriptor && entry.file) {
        descriptor = await uploadFile(entry.file);
        if (entry.thumbnailFile) {
          const thumbnail = await uploadFile(new File([entry.thumbnailFile], `${entry.file.name}-thumbnail.jpg`, { type: "image/jpeg" }));
          descriptor.thumbnailUrl = thumbnail.url;
        }
        descriptor.alt = elements.postTitle.value.trim();
        entry.descriptor = descriptor;
      }
      descriptors.push(descriptor);
      progress.style.width = `${Math.round((index + 1) / Math.max(1, state.mediaDraft.length) * 100)}%`;
    }
    setTimeout(() => { elements.uploadProgress.hidden = true; progress.style.width = "0"; }, 500);
    return descriptors.filter(Boolean);
  }

  async function submitPost(event) {
    event.preventDefault();
    if (!elements.postConsent.checked) return showToast("개인정보 처리와 관리자 검수에 동의해 주세요.");
    const draft = {
      category: elements.postCategory.value,
      author: elements.postAuthor.value,
      title: elements.postTitle.value,
      body: elements.postBody.value,
      password: elements.postPassword.value,
      contact: elements.postContact.value,
      media: state.mediaDraft.map((entry) => entry.descriptor).filter(Boolean),
      thumbnailIndex: state.thumbnailIndex
    };
    const validation = board.validateDraft(draft, { isAdmin: Boolean(state.adminKey) });
    if (!validation.ok) return showToast(validation.error);
    elements.submitPostBtn.disabled = true;
    try {
      draft.media = await uploadMediaDraft();
      const editingId = elements.editingPostId.value;
      await api(editingId ? `/api/board/posts/${editingId}` : "/api/board/posts", {
        method: editingId ? "PATCH" : "POST",
        json: draft
      });
      removeBoardDraft();
      elements.writeDialog.close();
      showToast(state.adminKey ? "게시글을 공개했습니다." : "게시글을 접수했습니다. 관리자 확인 후 공개됩니다.");
      state.page = 1;
      await loadPosts();
    } catch (error) {
      showToast(error.message);
    } finally {
      elements.submitPostBtn.disabled = false;
    }
  }

  async function openPost(id) {
    try {
      const { item } = await api(`/api/board/posts/${id}?view=1`);
      const post = board.normalizePost(item);
      state.activePost = post;
      elements.detailCategory.textContent = board.getCategory(post.category).label;
      elements.detailTitle.textContent = post.title;
      elements.detailMeta.textContent = `${post.author} · ${formatDate(post.publishedAt || post.createdAt)} · 조회 ${post.views}`;
      elements.detailBody.textContent = post.body;
      elements.detailMedia.replaceChildren(...post.media.map((media) => {
        if (media.kind === "video") {
          const video = document.createElement("video");
          video.src = media.url;
          video.controls = true;
          video.playsInline = true;
          if (media.thumbnailUrl) video.poster = media.thumbnailUrl;
          return video;
        }
        const image = document.createElement("img");
        image.src = media.url;
        image.alt = media.alt || post.title;
        image.loading = "lazy";
        return image;
      }));
      elements.editPostBtn.hidden = !state.adminKey && post.official;
      elements.deletePostBtn.hidden = !state.adminKey && post.official;
      elements.moderationTools.hidden = !state.adminKey;
      elements.detailDialog.showModal();
      const url = new URL(location.href);
      url.searchParams.set("post", id);
      history.replaceState(null, "", url);
    } catch (error) {
      showToast(error.message);
    }
  }

  async function shareActivePost() {
    const post = state.activePost;
    if (!post) return;
    const url = board.createShareUrl(location.href, post.id);
    try {
      if (navigator.share) await navigator.share({ title: post.title, text: post.body.slice(0, 120), url });
      else {
        await navigator.clipboard.writeText(url);
        showToast("게시글 주소를 복사했습니다.");
      }
    } catch (error) {
      if (error.name !== "AbortError") showToast("공유하지 못했습니다. 다시 시도해 주세요.");
    }
  }

  async function editActivePost() {
    if (!state.activePost) return;
    elements.detailDialog.close();
    openWriteDialog(state.activePost);
  }

  async function deleteActivePost() {
    const post = state.activePost;
    if (!post) return;
    const password = state.adminKey ? "" : window.prompt("게시글 비밀번호를 입력해 주세요.");
    if (!state.adminKey && !password) return;
    if (!window.confirm("게시글을 삭제할까요? 삭제 후에는 복구할 수 없습니다.")) return;
    try {
      await api(`/api/board/posts/${post.id}`, { method: "DELETE", json: { password } });
      elements.detailDialog.close();
      showToast("게시글을 삭제했습니다.");
      await loadPosts();
    } catch (error) { showToast(error.message); }
  }

  async function reportActivePost() {
    if (!state.activePost) return;
    if (!window.confirm("부적절한 게시글로 관리자에게 신고할까요?")) return;
    try {
      await api(`/api/board/posts/${state.activePost.id}/report`, { method: "POST", json: {} });
      showToast("신고를 접수했습니다.");
    } catch (error) { showToast(error.message); }
  }

  async function moderateActivePost(status) {
    if (!state.activePost || !state.adminKey) return;
    try {
      await api(`/api/board/posts/${state.activePost.id}/moderate`, { method: "POST", json: { status } });
      elements.detailDialog.close();
      showToast(status === "published" ? "게시글을 승인하고 공개했습니다." : "게시글 상태를 변경했습니다.");
      await loadPosts();
    } catch (error) { showToast(error.message); }
  }

  async function enterAdminMode() {
    if (state.adminKey) return;
    const localDefault = location.hostname === "127.0.0.1" || location.hostname === "localhost" ? "songak-local-admin" : "";
    const key = window.prompt("관리자 비밀번호를 입력해 주세요.", localDefault);
    if (!key) return;
    state.adminKey = key;
    try {
      const check = await api("/api/board/posts?status=pending&pageSize=1");
      if (!check.admin) throw new Error("관리자 비밀번호가 올바르지 않습니다.");
      sessionStorage.setItem("songak-board-admin-key", key);
      setAdminMode(true);
      state.page = 1;
      await loadPosts();
      showToast("관리자 검수 모드를 시작했습니다.");
    } catch (error) {
      state.adminKey = "";
      showToast(error.message);
    }
  }

  function exitAdminMode() {
    state.adminKey = "";
    sessionStorage.removeItem("songak-board-admin-key");
    setAdminMode(false);
    state.page = 1;
    loadPosts();
  }

  document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => {
    document.getElementById(button.dataset.closeDialog)?.close();
    if (button.dataset.closeDialog === "detailDialog") history.replaceState(null, "", location.pathname);
  }));
  [elements.writeHeaderBtn, elements.writeHeroBtn, elements.mobileWriteBtn].forEach((button) => button.addEventListener("click", () => openWriteDialog()));
  elements.guideBtn.addEventListener("click", () => elements.boardGuide.scrollIntoView({ behavior: "smooth", block: "center" }));
  elements.adminBtn.addEventListener("click", enterAdminMode);
  elements.adminLogoutBtn.addEventListener("click", exitAdminMode);
  elements.adminStatusSelect.addEventListener("change", () => { state.page = 1; loadPosts(); });
  elements.searchForm.addEventListener("submit", (event) => { event.preventDefault(); state.search = elements.searchInput.value; state.page = 1; loadPosts(); });
  elements.sortSelect.addEventListener("change", () => { state.sort = elements.sortSelect.value; state.page = 1; loadPosts(); });
  elements.viewSelect.addEventListener("change", () => elements.postGrid.classList.toggle("compact", elements.viewSelect.value === "compact"));
  elements.prevPageBtn.addEventListener("click", () => { if (state.page > 1) { state.page -= 1; loadPosts(); } });
  elements.nextPageBtn.addEventListener("click", () => { if (state.page < state.totalPages) { state.page += 1; loadPosts(); } });
  elements.mediaInput.addEventListener("change", () => { addSelectedMedia(elements.mediaInput.files); elements.mediaInput.value = ""; });
  elements.saveDraftBtn.addEventListener("click", saveDraft);
  elements.deleteDraftBtn.addEventListener("click", deleteDraft);
  elements.postConsent.addEventListener("change", () => {
    if (!elements.postConsent.checked) removeBoardDraft();
  });
  elements.writeForm.addEventListener("submit", submitPost);
  elements.sharePostBtn.addEventListener("click", shareActivePost);
  elements.editPostBtn.addEventListener("click", editActivePost);
  elements.deletePostBtn.addEventListener("click", deleteActivePost);
  elements.reportPostBtn.addEventListener("click", reportActivePost);
  elements.moderationTools.addEventListener("click", (event) => {
    const button = event.target.closest("[data-moderate]");
    if (button) moderateActivePost(button.dataset.moderate);
  });
  elements.detailDialog.addEventListener("close", () => {
    if (new URL(location.href).searchParams.has("post")) history.replaceState(null, "", location.pathname);
  });
  scheduleStoredBoardDraftExpiry();
  window.addEventListener("pagehide", clearBoardDraftExpiryTimer);
  window.addEventListener("pageshow", scheduleStoredBoardDraftExpiry);

  setAdminMode(Boolean(state.adminKey));
  renderCategoryTabs();
  loadPosts().then(() => {
    const postId = new URL(location.href).searchParams.get("post");
    if (postId) openPost(postId);
  });
})();
