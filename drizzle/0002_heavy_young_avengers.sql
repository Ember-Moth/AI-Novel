CREATE TABLE `ai_project_generation_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`head_id` text,
	`trigger_message_id` text,
	`assistant_message_id` text,
	`status` text NOT NULL,
	`request_json` text NOT NULL,
	`usage_json` text,
	`error_json` text,
	`snapshot_connection_name` text,
	`snapshot_sdk_package` text,
	`snapshot_base_url` text,
	`snapshot_model_origin` text,
	`snapshot_model_id` text,
	`snapshot_model_display_name` text,
	`snapshot_model_family` text,
	`snapshot_capabilities_json` text,
	`snapshot_pricing_json` text,
	`connection_id` text,
	`catalog_model_id` text,
	`custom_model_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`head_id`) REFERENCES `ai_project_heads`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`trigger_message_id`) REFERENCES `ai_project_messages`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`assistant_message_id`) REFERENCES `ai_project_messages`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`connection_id`) REFERENCES `ai_connections`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`catalog_model_id`) REFERENCES `ai_catalog_models`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`custom_model_id`) REFERENCES `ai_connection_custom_models`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "ai_project_generation_attempts_status_valid" CHECK("ai_project_generation_attempts"."status" IN ('pending', 'success', 'error')),
	CONSTRAINT "ai_project_generation_attempts_model_origin_valid" CHECK("ai_project_generation_attempts"."snapshot_model_origin" IS NULL OR "ai_project_generation_attempts"."snapshot_model_origin" IN ('catalog', 'custom')),
	CONSTRAINT "ai_project_generation_attempts_model_reference_exclusive" CHECK(NOT ("ai_project_generation_attempts"."catalog_model_id" IS NOT NULL AND "ai_project_generation_attempts"."custom_model_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `ai_project_generation_attempts_project_idx` ON `ai_project_generation_attempts` (`project_id`);--> statement-breakpoint
CREATE INDEX `ai_project_generation_attempts_head_idx` ON `ai_project_generation_attempts` (`head_id`);--> statement-breakpoint
CREATE INDEX `ai_project_generation_attempts_trigger_message_idx` ON `ai_project_generation_attempts` (`trigger_message_id`);--> statement-breakpoint
CREATE INDEX `ai_project_generation_attempts_assistant_message_idx` ON `ai_project_generation_attempts` (`assistant_message_id`);--> statement-breakpoint
CREATE INDEX `ai_project_generation_attempts_connection_idx` ON `ai_project_generation_attempts` (`connection_id`);--> statement-breakpoint
CREATE TABLE `ai_project_heads` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`current_message_id` text,
	`forked_from_head_id` text,
	`forked_from_message_id` text,
	`is_archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`current_message_id`) REFERENCES `ai_project_messages`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`forked_from_head_id`) REFERENCES `ai_project_heads`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`forked_from_message_id`) REFERENCES `ai_project_messages`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "ai_project_heads_name_nonempty" CHECK(length("ai_project_heads"."name") > 0)
);
--> statement-breakpoint
CREATE INDEX `ai_project_heads_project_idx` ON `ai_project_heads` (`project_id`);--> statement-breakpoint
CREATE INDEX `ai_project_heads_project_archived_idx` ON `ai_project_heads` (`project_id`,`is_archived`);--> statement-breakpoint
CREATE INDEX `ai_project_heads_current_message_idx` ON `ai_project_heads` (`current_message_id`);--> statement-breakpoint
CREATE TABLE `ai_project_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`prev_message_id` text,
	`role` text NOT NULL,
	`content_json` text NOT NULL,
	`summary_text` text,
	`snapshot_connection_name` text,
	`snapshot_sdk_package` text,
	`snapshot_base_url` text,
	`snapshot_model_origin` text,
	`snapshot_model_id` text,
	`snapshot_model_display_name` text,
	`snapshot_model_family` text,
	`snapshot_capabilities_json` text,
	`snapshot_pricing_json` text,
	`connection_id` text,
	`catalog_model_id` text,
	`custom_model_id` text,
	`metadata_json` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`prev_message_id`) REFERENCES `ai_project_messages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`connection_id`) REFERENCES `ai_connections`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`catalog_model_id`) REFERENCES `ai_catalog_models`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`custom_model_id`) REFERENCES `ai_connection_custom_models`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "ai_project_messages_prev_not_self" CHECK("ai_project_messages"."prev_message_id" IS NULL OR "ai_project_messages"."prev_message_id" <> "ai_project_messages"."id"),
	CONSTRAINT "ai_project_messages_role_valid" CHECK("ai_project_messages"."role" IN ('system', 'user', 'assistant', 'tool')),
	CONSTRAINT "ai_project_messages_model_origin_valid" CHECK("ai_project_messages"."snapshot_model_origin" IS NULL OR "ai_project_messages"."snapshot_model_origin" IN ('catalog', 'custom')),
	CONSTRAINT "ai_project_messages_model_reference_exclusive" CHECK(NOT ("ai_project_messages"."catalog_model_id" IS NOT NULL AND "ai_project_messages"."custom_model_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `ai_project_messages_project_idx` ON `ai_project_messages` (`project_id`);--> statement-breakpoint
CREATE INDEX `ai_project_messages_prev_idx` ON `ai_project_messages` (`prev_message_id`);--> statement-breakpoint
CREATE INDEX `ai_project_messages_connection_idx` ON `ai_project_messages` (`connection_id`);--> statement-breakpoint
CREATE INDEX `ai_project_messages_catalog_model_idx` ON `ai_project_messages` (`catalog_model_id`);--> statement-breakpoint
CREATE INDEX `ai_project_messages_custom_model_idx` ON `ai_project_messages` (`custom_model_id`);
