import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const posts = sqliteTable("posts", {
  id: text("id").primaryKey(),
  category: text("category", { enum: ["notice", "welfare", "resident", "question"] }).notNull(),
  status: text("status", { enum: ["pending", "published", "rejected", "hidden", "deleted"] }).notNull().default("pending"),
  title: text("title").notNull(),
  body: text("body").notNull(),
  author: text("author").notNull(),
  contact: text("contact").notNull().default(""),
  passwordSalt: text("password_salt").notNull().default(""),
  passwordHash: text("password_hash").notNull().default(""),
  thumbnailMediaId: text("thumbnail_media_id"),
  pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
  official: integer("official", { mode: "boolean" }).notNull().default(false),
  views: integer("views").notNull().default(0),
  reportCount: integer("report_count").notNull().default(0),
  shareCount: integer("share_count").notNull().default(0),
  moderationNote: text("moderation_note").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  publishedAt: text("published_at"),
  deletedAt: text("deleted_at"),
}, (table) => [
  index("idx_posts_public_feed").on(table.status, table.pinned, table.publishedAt),
  index("idx_posts_category_status").on(table.category, table.status, table.publishedAt),
  index("idx_posts_moderation_queue").on(table.status, table.createdAt),
]);

export const media = sqliteTable("media", {
  id: text("id").primaryKey(),
  postId: text("post_id").references(() => posts.id),
  objectKey: text("object_key").notNull(),
  kind: text("kind", { enum: ["image", "video"] }).notNull(),
  contentType: text("content_type").notNull(),
  originalName: text("original_name").notNull(),
  byteSize: integer("byte_size").notNull(),
  altText: text("alt_text").notNull().default(""),
  ownerTokenHash: text("owner_token_hash").notNull(),
  status: text("status", { enum: ["temporary", "attached", "deleted"] }).notNull().default("temporary"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_media_object_key").on(table.objectKey),
  index("idx_media_post_id").on(table.postId),
  index("idx_media_temporary").on(table.status, table.createdAt),
]);

export const reports = sqliteTable("reports", {
  id: text("id").primaryKey(),
  postId: text("post_id").notNull().references(() => posts.id),
  reporterHash: text("reporter_hash").notNull(),
  reason: text("reason").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_reports_post_reporter").on(table.postId, table.reporterHash),
  index("idx_reports_post_id").on(table.postId),
]);

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  detail: text("detail").notNull().default(""),
  actorHash: text("actor_hash").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_audit_logs_target").on(table.targetType, table.targetId, table.createdAt),
  index("idx_audit_logs_created_at").on(table.createdAt),
]);

export const rateLimits = sqliteTable("rate_limits", {
  scope: text("scope").notNull(),
  actorHash: text("actor_hash").notNull(),
  bucket: integer("bucket").notNull(),
  count: integer("count").notNull().default(1),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  primaryKey({ columns: [table.scope, table.actorHash, table.bucket] }),
  index("idx_rate_limits_updated_at").on(table.updatedAt),
]);

export const applications = sqliteTable("applications", {
  id: text("id").primaryKey(),
  receiptId: text("receipt_id").notNull(),
  type: text("type", { enum: ["program", "case", "volunteer", "donation", "facility", "general"] }).notNull(),
  applicantKind: text("applicant_kind", { enum: ["individual", "family", "group"] }).notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  preferredContact: text("preferred_contact").notNull().default(""),
  participants: integer("participants").notNull().default(1),
  message: text("message").notNull(),
  status: text("status", { enum: ["received", "contacted", "closed"] }).notNull().default("received"),
  actorHash: text("actor_hash").notNull(),
  consentedAt: text("consented_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_applications_receipt_id").on(table.receiptId),
  index("idx_applications_status_created").on(table.status, table.createdAt),
]);

export const siteDocuments = sqliteTable("site_documents", {
  key: text("key").primaryKey(),
  draftJson: text("draft_json").notNull().default("{}"),
  publishedJson: text("published_json"),
  revision: integer("revision").notNull().default(0),
  updatedBy: text("updated_by").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  publishedAt: text("published_at"),
});

export const siteVersions = sqliteTable("site_versions", {
  id: text("id").primaryKey(),
  documentKey: text("document_key").notNull().references(() => siteDocuments.key),
  revision: integer("revision").notNull(),
  kind: text("kind", { enum: ["draft", "published", "restored"] }).notNull(),
  contentJson: text("content_json").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_site_versions_document_revision").on(table.documentKey, table.revision),
  index("idx_site_versions_document_created").on(table.documentKey, table.createdAt),
]);
