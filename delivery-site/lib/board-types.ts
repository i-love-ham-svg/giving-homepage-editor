export const CATEGORIES = [
  { id: "notice", label: "공지", adminOnly: true },
  { id: "welfare", label: "복지관 소식", adminOnly: true },
  { id: "resident", label: "주민 이야기", adminOnly: false },
  { id: "question", label: "질문·제안", adminOnly: false },
] as const;

export const STATUSES = ["pending", "published", "rejected", "hidden", "deleted"] as const;
export type Category = typeof CATEGORIES[number]["id"];
export type PostStatus = typeof STATUSES[number];

export type BoardMedia = {
  id: string;
  kind: "image" | "video";
  type: string;
  name: string;
  size: number;
  url: string;
  alt: string;
  claimToken?: string;
};

export type BoardPost = {
  id: string;
  category: Category;
  status: PostStatus;
  title: string;
  body: string;
  author: string;
  contact?: string;
  media: BoardMedia[];
  thumbnailMediaId?: string | null;
  pinned: boolean;
  official: boolean;
  views: number;
  reportCount: number;
  shareCount: number;
  moderationNote?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
};
