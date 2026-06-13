CREATE TABLE `global_prompts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`content` text NOT NULL,
	`is_enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "global_prompts_name_nonempty" CHECK(length("global_prompts"."name") > 0),
	CONSTRAINT "global_prompts_content_nonempty" CHECK(length("global_prompts"."content") > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `global_prompts_name_idx` ON `global_prompts` (`name`);