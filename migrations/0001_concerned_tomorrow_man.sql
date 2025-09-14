PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_system_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'super_admin' NOT NULL,
	`avatar` text
);
--> statement-breakpoint
INSERT INTO `__new_system_users`("id", "name", "email", "role", "avatar") SELECT "id", "name", "email", "role", "avatar" FROM `system_users`;--> statement-breakpoint
DROP TABLE `system_users`;--> statement-breakpoint
ALTER TABLE `__new_system_users` RENAME TO `system_users`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `system_users_email_unique` ON `system_users` (`email`);