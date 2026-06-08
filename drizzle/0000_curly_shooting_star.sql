CREATE TABLE `ai_catalog_models` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`model_id` text NOT NULL,
	`display_name` text NOT NULL,
	`family` text,
	`input_modalities_json` text DEFAULT '[]' NOT NULL,
	`output_modalities_json` text DEFAULT '[]' NOT NULL,
	`context_window` integer,
	`max_output_tokens` integer,
	`supports_vision` integer DEFAULT false NOT NULL,
	`supports_tool_use` integer DEFAULT false NOT NULL,
	`supports_reasoning` integer DEFAULT false NOT NULL,
	`supports_temperature` integer DEFAULT false NOT NULL,
	`input_price_per_1m` real,
	`output_price_per_1m` real,
	`cost_json` text,
	`raw_json` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`last_seen_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `ai_catalog_providers`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ai_models_display_name_nonempty" CHECK(length("ai_catalog_models"."display_name") > 0),
	CONSTRAINT "ai_models_model_id_nonempty" CHECK(length("ai_catalog_models"."model_id") > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_models_provider_model_idx` ON `ai_catalog_models` (`provider_id`,`model_id`);--> statement-breakpoint
CREATE INDEX `ai_models_provider_idx` ON `ai_catalog_models` (`provider_id`);--> statement-breakpoint
CREATE INDEX `ai_models_active_idx` ON `ai_catalog_models` (`is_active`);--> statement-breakpoint
CREATE TABLE `ai_catalog_providers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sdk_package` text,
	`api_url` text,
	`docs_url` text,
	`env_keys_json` text DEFAULT '[]' NOT NULL,
	`raw_json` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`last_seen_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "ai_providers_name_nonempty" CHECK(length("ai_catalog_providers"."name") > 0)
);
--> statement-breakpoint
CREATE INDEX `ai_providers_active_idx` ON `ai_catalog_providers` (`is_active`);--> statement-breakpoint
CREATE TABLE `ai_connection_catalog_overrides` (
	`id` text PRIMARY KEY NOT NULL,
	`connection_id` text NOT NULL,
	`catalog_model_id` text NOT NULL,
	`is_enabled` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`connection_id`) REFERENCES `ai_connections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`catalog_model_id`) REFERENCES `ai_catalog_models`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_connection_catalog_override_idx` ON `ai_connection_catalog_overrides` (`connection_id`,`catalog_model_id`);--> statement-breakpoint
CREATE INDEX `ai_connection_catalog_model_idx` ON `ai_connection_catalog_overrides` (`catalog_model_id`);--> statement-breakpoint
CREATE TABLE `ai_connection_custom_models` (
	`id` text PRIMARY KEY NOT NULL,
	`connection_id` text NOT NULL,
	`model_id` text NOT NULL,
	`display_name` text NOT NULL,
	`context_window` integer,
	`max_output_tokens` integer,
	`supports_vision` integer DEFAULT false NOT NULL,
	`supports_tool_use` integer DEFAULT false NOT NULL,
	`supports_reasoning` integer DEFAULT false NOT NULL,
	`supports_temperature` integer DEFAULT false NOT NULL,
	`input_price_per_1m` real,
	`output_price_per_1m` real,
	`is_enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`connection_id`) REFERENCES `ai_connections`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ai_connection_custom_models_model_nonempty" CHECK(length("ai_connection_custom_models"."model_id") > 0),
	CONSTRAINT "ai_connection_custom_models_name_nonempty" CHECK(length("ai_connection_custom_models"."display_name") > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_connection_custom_models_unique_idx` ON `ai_connection_custom_models` (`connection_id`,`model_id`);--> statement-breakpoint
CREATE INDEX `ai_connection_custom_models_connection_idx` ON `ai_connection_custom_models` (`connection_id`);--> statement-breakpoint
CREATE TABLE `ai_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`sdk_package` text NOT NULL,
	`catalog_provider_id` text,
	`base_url` text,
	`api_key` text,
	`config_json` text DEFAULT '{}' NOT NULL,
	`is_enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`catalog_provider_id`) REFERENCES `ai_catalog_providers`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "ai_connections_name_nonempty" CHECK(length("ai_connections"."name") > 0),
	CONSTRAINT "ai_connections_package_nonempty" CHECK(length("ai_connections"."sdk_package") > 0),
	CONSTRAINT "ai_connections_kind_valid" CHECK("ai_connections"."kind" IN ('registry', 'custom')),
	CONSTRAINT "ai_connections_registry_requires_provider" CHECK("ai_connections"."kind" <> 'registry' OR "ai_connections"."catalog_provider_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX `ai_connections_kind_idx` ON `ai_connections` (`kind`);--> statement-breakpoint
CREATE INDEX `ai_connections_provider_idx` ON `ai_connections` (`catalog_provider_id`);--> statement-breakpoint
CREATE TABLE `ai_registry_state` (
	`id` text PRIMARY KEY NOT NULL,
	`last_attempt_at` integer,
	`last_success_at` integer,
	`last_error` text,
	`content_hash` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "ai_registry_state_id_nonempty" CHECK(length("ai_registry_state"."id") > 0)
);
--> statement-breakpoint
CREATE TABLE `aux_node_layers` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`timeline_point_id` text,
	`aux_node_id` text NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`parent_aux_node_id` text,
	`name` text,
	`content` text,
	`symlink_target_aux_node_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`timeline_point_id`) REFERENCES `timeline_points`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`aux_node_id`) REFERENCES `aux_nodes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_aux_node_id`) REFERENCES `aux_nodes`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`symlink_target_aux_node_id`) REFERENCES `aux_nodes`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "aux_node_layers_not_deleted_or_has_payload" CHECK("aux_node_layers"."is_deleted" = 1 OR "aux_node_layers"."parent_aux_node_id" IS NOT NULL OR "aux_node_layers"."name" IS NOT NULL OR "aux_node_layers"."content" IS NOT NULL OR "aux_node_layers"."symlink_target_aux_node_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `aux_node_layers_origin_aux_idx` ON `aux_node_layers` (`workspace_id`,`aux_node_id`) WHERE "aux_node_layers"."timeline_point_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `aux_node_layers_timeline_aux_idx` ON `aux_node_layers` (`workspace_id`,`timeline_point_id`,`aux_node_id`) WHERE "aux_node_layers"."timeline_point_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `aux_node_layers_workspace_aux_idx` ON `aux_node_layers` (`workspace_id`,`aux_node_id`);--> statement-breakpoint
CREATE INDEX `aux_node_layers_timeline_point_idx` ON `aux_node_layers` (`timeline_point_id`);--> statement-breakpoint
CREATE TABLE `aux_nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`node_type` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "aux_nodes_node_type_valid" CHECK("aux_nodes"."node_type" IN ('root', 'dir', 'file', 'symlink'))
);
--> statement-breakpoint
CREATE INDEX `aux_nodes_workspace_idx` ON `aux_nodes` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `content_nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`parent_id` text,
	`next_sibling_id` text,
	`anchor_timeline_point_id` text,
	`kind` text,
	`title` text,
	`body` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `content_nodes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`next_sibling_id`) REFERENCES `content_nodes`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`anchor_timeline_point_id`) REFERENCES `timeline_points`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "content_nodes_parent_not_self" CHECK("content_nodes"."parent_id" IS NULL OR "content_nodes"."parent_id" <> "content_nodes"."id"),
	CONSTRAINT "content_nodes_next_sibling_not_self" CHECK("content_nodes"."next_sibling_id" IS NULL OR "content_nodes"."next_sibling_id" <> "content_nodes"."id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_nodes_next_sibling_idx` ON `content_nodes` (`next_sibling_id`);--> statement-breakpoint
CREATE INDEX `content_nodes_workspace_idx` ON `content_nodes` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `content_nodes_parent_idx` ON `content_nodes` (`parent_id`);--> statement-breakpoint
CREATE INDEX `content_nodes_anchor_timeline_point_idx` ON `content_nodes` (`anchor_timeline_point_id`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "projects_name_nonempty" CHECK(length("projects"."name") > 0)
);
--> statement-breakpoint
CREATE INDEX `projects_updated_at_idx` ON `projects` (`updated_at`);--> statement-breakpoint
CREATE TABLE `timeline_points` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`key` text NOT NULL,
	`label` text NOT NULL,
	`description` text,
	`prev_point_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`prev_point_id`) REFERENCES `timeline_points`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "timeline_points_key_nonempty" CHECK(length("timeline_points"."key") > 0),
	CONSTRAINT "timeline_points_label_nonempty" CHECK(length("timeline_points"."label") > 0),
	CONSTRAINT "timeline_points_prev_not_self" CHECK("timeline_points"."prev_point_id" IS NULL OR "timeline_points"."prev_point_id" <> "timeline_points"."id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `timeline_points_workspace_key_idx` ON `timeline_points` (`workspace_id`,`key`);--> statement-breakpoint
CREATE UNIQUE INDEX `timeline_points_prev_point_idx` ON `timeline_points` (`prev_point_id`);--> statement-breakpoint
CREATE INDEX `timeline_points_workspace_idx` ON `timeline_points` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`content_root_id` text,
	`aux_root_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "workspaces_name_nonempty" CHECK(length("workspaces"."name") > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspaces_project_name_idx` ON `workspaces` (`project_id`,`name`);--> statement-breakpoint
CREATE INDEX `workspaces_project_idx` ON `workspaces` (`project_id`);