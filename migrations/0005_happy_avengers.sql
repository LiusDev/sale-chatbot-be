CREATE TABLE `meta_pages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`page_id` text NOT NULL,
	`name` text NOT NULL,
	`access_token` text,
	`category` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP'
);
