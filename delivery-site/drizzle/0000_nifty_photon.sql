CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`actor_hash` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_logs_target` ON `audit_logs` (`target_type`,`target_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_logs_created_at` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text,
	`object_key` text NOT NULL,
	`kind` text NOT NULL,
	`content_type` text NOT NULL,
	`original_name` text NOT NULL,
	`byte_size` integer NOT NULL,
	`alt_text` text DEFAULT '' NOT NULL,
	`owner_token_hash` text NOT NULL,
	`status` text DEFAULT 'temporary' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_media_object_key` ON `media` (`object_key`);--> statement-breakpoint
CREATE INDEX `idx_media_post_id` ON `media` (`post_id`);--> statement-breakpoint
CREATE INDEX `idx_media_temporary` ON `media` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`author` text NOT NULL,
	`contact` text DEFAULT '' NOT NULL,
	`password_salt` text DEFAULT '' NOT NULL,
	`password_hash` text DEFAULT '' NOT NULL,
	`thumbnail_media_id` text,
	`pinned` integer DEFAULT false NOT NULL,
	`official` integer DEFAULT false NOT NULL,
	`views` integer DEFAULT 0 NOT NULL,
	`report_count` integer DEFAULT 0 NOT NULL,
	`share_count` integer DEFAULT 0 NOT NULL,
	`moderation_note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`published_at` text,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_posts_public_feed` ON `posts` (`status`,`pinned`,`published_at`);--> statement-breakpoint
CREATE INDEX `idx_posts_category_status` ON `posts` (`category`,`status`,`published_at`);--> statement-breakpoint
CREATE INDEX `idx_posts_moderation_queue` ON `posts` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`scope` text NOT NULL,
	`actor_hash` text NOT NULL,
	`bucket` integer NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`scope`, `actor_hash`, `bucket`)
);
--> statement-breakpoint
CREATE INDEX `idx_rate_limits_updated_at` ON `rate_limits` (`updated_at`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`reporter_hash` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_reports_post_reporter` ON `reports` (`post_id`,`reporter_hash`);--> statement-breakpoint
CREATE INDEX `idx_reports_post_id` ON `reports` (`post_id`);--> statement-breakpoint
INSERT INTO `posts` (
	`id`, `category`, `status`, `title`, `body`, `author`, `pinned`, `official`, `published_at`
) VALUES (
	'welcome-notice',
	'notice',
	'published',
	'송악사회복지관 소통게시판을 시작합니다',
	'복지관의 새로운 소식과 주민 여러분의 따뜻한 이야기를 한곳에서 나눌 수 있습니다. 주민 게시글은 안전한 운영을 위해 관리자 확인 후 공개됩니다.',
	'송악사회복지관',
	1,
	1,
	CURRENT_TIMESTAMP
);--> statement-breakpoint
PRAGMA optimize;
