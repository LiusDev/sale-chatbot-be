CREATE TABLE `ai_agents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '',
	`model` text NOT NULL,
	`system_prompt` text NOT NULL,
	`knowledge_source_group_id` integer,
	`top_k` integer DEFAULT 5 NOT NULL,
	`temperature` integer DEFAULT 70 NOT NULL,
	`max_tokens` integer DEFAULT 1000 NOT NULL,
	`created_by` integer,
	FOREIGN KEY (`knowledge_source_group_id`) REFERENCES `product_groups`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `system_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `common_app_info` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`isPrivate` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `meta_page_conversation_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`created_time` text NOT NULL,
	`message` text NOT NULL,
	`from` text NOT NULL,
	`attachments` text DEFAULT '',
	FOREIGN KEY (`conversation_id`) REFERENCES `meta_page_conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `meta_page_conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`page_id` text NOT NULL,
	`agentmode` text DEFAULT 'auto' NOT NULL,
	`recipientId` text,
	`recipientName` text,
	`isConfirmOrder` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`page_id`) REFERENCES `meta_pages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `meta_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`access_token` text,
	`category` text,
	`agent_id` integer,
	FOREIGN KEY (`agent_id`) REFERENCES `ai_agents`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `product_groups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE `product_images` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer,
	`image_url` text NOT NULL,
	`alt_text` text DEFAULT '',
	`index` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '',
	`price` integer NOT NULL,
	`metadata` text DEFAULT '',
	`product_group_id` integer,
	FOREIGN KEY (`product_group_id`) REFERENCES `product_groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `system_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'super_admin' NOT NULL,
	`avatar` text DEFAULT ''
);
--> statement-breakpoint
CREATE UNIQUE INDEX `system_users_email_unique` ON `system_users` (`email`);