CREATE TABLE `common_app_info` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`isPrivate` integer DEFAULT false NOT NULL
);
