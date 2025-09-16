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
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`knowledge_source_group_id`) REFERENCES `product_groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `system_users`(`id`) ON UPDATE no action ON DELETE no action
);
