import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";

const supportedMedia = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
  ["image/avif", ".avif"],
  ["video/mp4", ".mp4"],
  ["video/webm", ".webm"],
  ["video/quicktime", ".mov"],
  ["application/pdf", ".pdf"],
  ["application/x-hwp", ".hwp"],
  ["application/haansofthwp", ".hwp"],
  ["application/vnd.hancom.hwpx", ".hwpx"],
  ["application/haansofthwpx", ".hwpx"],
  ["application/msword", ".doc"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".docx"],
  ["application/vnd.ms-excel", ".xls"],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".xlsx"],
  ["application/vnd.ms-powerpoint", ".ppt"],
  ["application/vnd.openxmlformats-officedocument.presentationml.presentation", ".pptx"],
  ["application/zip", ".zip"],
  ["text/plain", ".txt"]
]);

function mediaKind(type) {
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("image/")) return "image";
  return "attachment";
}

function mediaLimit(type) {
  if (type.startsWith("video/")) return 100 * 1024 * 1024;
  if (type.startsWith("image/")) return 15 * 1024 * 1024;
  return 30 * 1024 * 1024;
}

const categoryIds = new Set(["notice", "welfare", "resident", "question"]);
const adminCategories = new Set(["notice", "welfare"]);
const statusIds = new Set(["pending", "published", "rejected", "hidden"]);

function cleanText(value, maxLength = 10_000) {
  return String(value ?? "").replace(/\u0000/g, "").replace(/\r\n?/g, "\n").trim().slice(0, maxLength);
}

function createPasswordHash(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(String(password), salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, expectedHex] = String(stored ?? "").split(":");
  if (!salt || !expectedHex) return false;
  const actual = scryptSync(String(password), salt, 32);
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function seedPosts() {
  const base = Date.now();
  return [
    {
      id: "welcome-notice",
      category: "notice",
      status: "published",
      title: "송악사회복지관 소통게시판을 시작합니다",
      body: "복지관의 새로운 소식과 주민 여러분의 따뜻한 이야기를 한곳에서 나눌 수 있습니다. 주민 게시글은 안전한 운영을 위해 관리자 확인 후 공개됩니다.",
      author: "송악사회복지관",
      contact: "",
      passwordHash: "",
      media: [],
      thumbnailIndex: 0,
      pinned: true,
      official: true,
      views: 28,
      reports: 0,
      shareCount: 0,
      createdAt: new Date(base - 2 * 86400000).toISOString(),
      updatedAt: new Date(base - 2 * 86400000).toISOString(),
      publishedAt: new Date(base - 2 * 86400000).toISOString()
    },
    {
      id: "resident-example",
      category: "resident",
      status: "published",
      title: "우리 동네에 따뜻한 여름 프로그램이 열렸어요",
      body: "아이와 함께 참여하기 좋은 활동이 많아 즐거운 시간을 보냈습니다. 다음 행사 소식도 게시판에서 빠르게 확인하고 싶어요.",
      author: "송악 주민",
      contact: "",
      passwordHash: "",
      media: [],
      thumbnailIndex: 0,
      pinned: false,
      official: false,
      views: 16,
      reports: 0,
      shareCount: 0,
      createdAt: new Date(base - 86400000).toISOString(),
      updatedAt: new Date(base - 86400000).toISOString(),
      publishedAt: new Date(base - 86400000).toISOString()
    }
  ];
}

function expose(post, isAdmin = false) {
  const { passwordHash, contact, ...publicPost } = post;
  if (isAdmin) publicPost.contact = contact;
  return publicPost;
}

export class BoardStore {
  constructor({ dataDir, adminKey = "" }) {
    this.dataDir = resolve(dataDir);
    this.mediaDir = join(this.dataDir, "media");
    this.postsFile = join(this.dataDir, "posts.json");
    this.adminKey = String(adminKey);
    mkdirSync(this.mediaDir, { recursive: true });
  }

  isAdmin(key) {
    if (!this.adminKey || !key) return false;
    const expected = createHash("sha256").update(this.adminKey).digest();
    const actual = createHash("sha256").update(String(key)).digest();
    return timingSafeEqual(actual, expected);
  }

  readPosts() {
    if (!existsSync(this.postsFile)) return seedPosts();
    try {
      const parsed = JSON.parse(readFileSync(this.postsFile, "utf8"));
      return Array.isArray(parsed) ? parsed : seedPosts();
    } catch {
      return seedPosts();
    }
  }

  writePosts(posts) {
    const tempFile = `${this.postsFile}.tmp`;
    writeFileSync(tempFile, JSON.stringify(posts, null, 2), "utf8");
    renameSync(tempFile, this.postsFile);
  }

  list(query = {}, adminKey = "") {
    const isAdmin = this.isAdmin(adminKey);
    const search = cleanText(query.search, 100).toLocaleLowerCase("ko-KR");
    const category = categoryIds.has(query.category) ? query.category : "all";
    const requestedStatus = statusIds.has(query.status) ? query.status : query.status === "all" ? "all" : "published";
    const status = isAdmin ? requestedStatus : "published";
    const sort = query.sort === "views" ? "views" : "latest";
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(24, Math.max(1, Number(query.pageSize) || 9));
    const filtered = this.readPosts()
      .filter((post) => status === "all" || post.status === status)
      .filter((post) => category === "all" || post.category === category)
      .filter((post) => !search || `${post.title}\n${post.body}\n${post.author}`.toLocaleLowerCase("ko-KR").includes(search))
      .sort((a, b) => {
        if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
        if (sort === "views") return (b.views || 0) - (a.views || 0);
        return new Date(b.publishedAt || b.createdAt) - new Date(a.publishedAt || a.createdAt);
      });
    const start = (page - 1) * pageSize;
    return {
      items: filtered.slice(start, start + pageSize).map((post) => expose(post, isAdmin)),
      total: filtered.length,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
      admin: isAdmin
    };
  }

  get(id, adminKey = "", incrementView = false) {
    const isAdmin = this.isAdmin(adminKey);
    const posts = this.readPosts();
    const post = posts.find((entry) => entry.id === id);
    if (!post || (!isAdmin && post.status !== "published")) return null;
    if (incrementView) {
      post.views = Math.max(0, Number(post.views) || 0) + 1;
      this.writePosts(posts);
    }
    return expose(post, isAdmin);
  }

  create(input, adminKey = "") {
    const isAdmin = this.isAdmin(adminKey);
    const category = categoryIds.has(input.category) ? input.category : "resident";
    if (adminCategories.has(category) && !isAdmin) throw new Error("공식 소식은 관리자만 작성할 수 있습니다.");
    const title = cleanText(input.title, 160);
    const body = cleanText(input.body, 20_000);
    const author = cleanText(input.author, 40);
    const password = String(input.password ?? "");
    if (title.length < 2 || body.length < 10 || !author) throw new Error("제목, 내용, 작성자를 확인해 주세요.");
    if (!isAdmin && (password.length < 4 || password.length > 32)) throw new Error("수정·삭제 비밀번호는 4~32자로 입력해 주세요.");
    const now = new Date().toISOString();
    const post = {
      id: randomUUID(),
      category,
      status: isAdmin ? "published" : "pending",
      title,
      body,
      author,
      contact: cleanText(input.contact, 120),
      passwordHash: isAdmin ? "" : createPasswordHash(password),
      media: Array.isArray(input.media) ? input.media.slice(0, 12) : [],
      thumbnailIndex: Math.max(0, Number(input.thumbnailIndex) || 0),
      pinned: isAdmin && Boolean(input.pinned),
      official: isAdmin,
      views: 0,
      reports: 0,
      shareCount: 0,
      createdAt: now,
      updatedAt: now,
      publishedAt: isAdmin ? now : ""
    };
    const posts = this.readPosts();
    posts.push(post);
    this.writePosts(posts);
    return expose(post, isAdmin);
  }

  update(id, input, credentials = {}) {
    const posts = this.readPosts();
    const post = posts.find((entry) => entry.id === id);
    if (!post) return null;
    const isAdmin = this.isAdmin(credentials.adminKey);
    if (!isAdmin && !verifyPassword(credentials.password, post.passwordHash)) throw new Error("게시글 비밀번호가 올바르지 않습니다.");
    if (input.title != null) post.title = cleanText(input.title, 160);
    if (input.body != null) post.body = cleanText(input.body, 20_000);
    if (input.author != null) post.author = cleanText(input.author, 40);
    if (input.contact != null) post.contact = cleanText(input.contact, 120);
    if (Array.isArray(input.media)) post.media = input.media.slice(0, 12);
    if (input.thumbnailIndex != null) post.thumbnailIndex = Math.max(0, Number(input.thumbnailIndex) || 0);
    if (isAdmin && input.category && categoryIds.has(input.category)) post.category = input.category;
    if (!isAdmin) {
      post.status = "pending";
      post.publishedAt = "";
    }
    post.updatedAt = new Date().toISOString();
    this.writePosts(posts);
    return expose(post, isAdmin);
  }

  remove(id, credentials = {}) {
    const posts = this.readPosts();
    const index = posts.findIndex((entry) => entry.id === id);
    if (index < 0) return false;
    const isAdmin = this.isAdmin(credentials.adminKey);
    if (!isAdmin && !verifyPassword(credentials.password, posts[index].passwordHash)) throw new Error("게시글 비밀번호가 올바르지 않습니다.");
    posts.splice(index, 1);
    this.writePosts(posts);
    return true;
  }

  moderate(id, status, adminKey) {
    if (!this.isAdmin(adminKey)) throw new Error("관리자 확인이 필요합니다.");
    if (!statusIds.has(status)) throw new Error("처리 상태가 올바르지 않습니다.");
    const posts = this.readPosts();
    const post = posts.find((entry) => entry.id === id);
    if (!post) return null;
    post.status = status;
    post.publishedAt = status === "published" ? new Date().toISOString() : "";
    post.updatedAt = new Date().toISOString();
    this.writePosts(posts);
    return expose(post, true);
  }

  report(id) {
    const posts = this.readPosts();
    const post = posts.find((entry) => entry.id === id);
    if (!post) return null;
    post.reports = Math.max(0, Number(post.reports) || 0) + 1;
    this.writePosts(posts);
    return { reports: post.reports };
  }

  saveMedia(buffer, { type, name }) {
    const normalizedType = cleanText(type, 80).toLowerCase();
    const extension = supportedMedia.get(normalizedType);
    if (!extension) throw new Error("지원하지 않는 첨부 파일 형식입니다.");
    const maxBytes = mediaLimit(normalizedType);
    if (!buffer?.length || buffer.length > maxBytes) throw new Error(`파일은 ${Math.round(maxBytes / 1024 / 1024)}MB 이하만 등록할 수 있습니다.`);
    const id = `${randomUUID()}${extension}`;
    writeFileSync(join(this.mediaDir, id), buffer);
    return {
      id,
      kind: mediaKind(normalizedType),
      type: normalizedType,
      name: basename(cleanText(name, 180)) || id,
      size: buffer.length,
      url: `/board-media/${id}`,
      thumbnailUrl: "",
      alt: ""
    };
  }

  resolveMedia(id) {
    const safeName = basename(String(id ?? ""));
    if (!safeName || safeName !== id) return null;
    const filePath = resolve(this.mediaDir, safeName);
    if (!existsSync(filePath)) return null;
    return { filePath, extension: extname(filePath).toLowerCase() };
  }
}

export const boardMediaTypes = supportedMedia;
