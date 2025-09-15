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
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '',
	`price` integer NOT NULL,
	`metadata` text DEFAULT '',
	`product_group_id` integer,
	FOREIGN KEY (`product_group_id`) REFERENCES `product_groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_system_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'super_admin' NOT NULL,
	`avatar` text DEFAULT ''
);
--> statement-breakpoint
INSERT INTO `__new_system_users`("id", "name", "email", "role", "avatar") SELECT "id", "name", "email", "role", "avatar" FROM `system_users`;--> statement-breakpoint
DROP TABLE `system_users`;--> statement-breakpoint
ALTER TABLE `__new_system_users` RENAME TO `system_users`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `system_users_email_unique` ON `system_users` (`email`);