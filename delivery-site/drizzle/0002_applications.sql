CREATE TABLE `applications` (
	`id` text PRIMARY KEY NOT NULL,
	`receipt_id` text NOT NULL,
	`type` text NOT NULL,
	`applicant_kind` text NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`preferred_contact` text DEFAULT '' NOT NULL,
	`participants` integer DEFAULT 1 NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'received' NOT NULL,
	`actor_hash` text NOT NULL,
	`consented_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_applications_receipt_id` ON `applications` (`receipt_id`);
--> statement-breakpoint
CREATE INDEX `idx_applications_status_created` ON `applications` (`status`,`created_at`);
--> statement-breakpoint
PRAGMA optimize;
