CREATE TABLE `ai_models` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`model_id` text NOT NULL,
	`display_name` text NOT NULL,
	`context_window` integer,
	`max_output_tokens` integer,
	`supports_vision` integer DEFAULT false NOT NULL,
	`supports_tool_use` integer DEFAULT false NOT NULL,
	`input_price_per_1m` real,
	`output_price_per_1m` real,
	`is_default` integer DEFAULT false NOT NULL,
	`is_enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `ai_providers`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ai_models_display_name_nonempty" CHECK(length("ai_models"."display_name") > 0),
	CONSTRAINT "ai_models_model_id_nonempty" CHECK(length("ai_models"."model_id") > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_models_provider_model_idx` ON `ai_models` (`provider_id`,`model_id`);--> statement-breakpoint
CREATE INDEX `ai_models_provider_idx` ON `ai_models` (`provider_id`);--> statement-breakpoint
CREATE TABLE `ai_providers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`provider_type` text NOT NULL,
	`base_url` text,
	`api_key` text,
	`is_enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "ai_providers_name_nonempty" CHECK(length("ai_providers"."name") > 0),
	CONSTRAINT "ai_providers_type_valid" CHECK("ai_providers"."provider_type" IN ('openai', 'anthropic', 'google', 'ollama', 'custom'))
);
