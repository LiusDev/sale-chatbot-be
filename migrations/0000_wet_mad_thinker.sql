CREATE TABLE `system_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `system_users_email_unique` ON `system_users` (`email`);