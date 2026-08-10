CREATE TABLE `site_documents` (
	`key` text PRIMARY KEY NOT NULL,
	`draft_json` text DEFAULT '{}' NOT NULL,
	`published_json` text,
	`revision` integer DEFAULT 0 NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`published_at` text
);
--> statement-breakpoint
CREATE TABLE `site_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`document_key` text NOT NULL,
	`revision` integer NOT NULL,
	`kind` text NOT NULL,
	`content_json` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`document_key`) REFERENCES `site_documents`(`key`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_site_versions_document_revision` ON `site_versions` (`document_key`,`revision`);
--> statement-breakpoint
CREATE INDEX `idx_site_versions_document_created` ON `site_versions` (`document_key`,`created_at`);
--> statement-breakpoint
PRAGMA optimize;
