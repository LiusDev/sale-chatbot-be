CREATE TABLE `meta_page_conversation_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`created_time` text NOT NULL,
	`message_id` text NOT NULL,
	`message` text NOT NULL,
	`from` text NOT NULL,
	`attachments` text DEFAULT '',
	FOREIGN KEY (`conversation_id`) REFERENCES `meta_page_conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `meta_page_conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`page_id` text NOT NULL,
	`agentMode` text DEFAULT 'auto' NOT NULL,
	`isConfirmOrder` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`page_id`) REFERENCES `meta_pages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `meta_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`access_token` text,
	`category` text
);
--> statement-breakpoint
ALTER TABLE `ai_agents` DROP COLUMN `created_at`;--> statement-breakpoint
ALTER TABLE `ai_agents` DROP COLUMN `updated_at`;