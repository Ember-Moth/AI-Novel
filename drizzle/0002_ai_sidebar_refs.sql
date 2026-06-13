ALTER TABLE `agent_runs` ADD `input_refs_snapshot_json` text;
--> statement-breakpoint
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_agent_thread_node_parts` (
	`id` text PRIMARY KEY NOT NULL,
	`node_id` text NOT NULL,
	`part_index` integer NOT NULL,
	`part_kind` text NOT NULL,
	`visibility` text DEFAULT 'public' NOT NULL,
	`state` text DEFAULT 'done' NOT NULL,
	`provider_options_json` text,
	`provider_metadata_json` text,
	`payload_json` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`node_id`) REFERENCES `agent_thread_nodes`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "agent_thread_node_parts_kind_valid" CHECK("__new_agent_thread_node_parts"."part_kind" IN ('text', 'data-assistant-ref', 'reasoning', 'tool-call', 'tool-result', 'tool-error', 'file', 'source-url', 'source-document', 'data', 'step-start')),
	CONSTRAINT "agent_thread_node_parts_visibility_valid" CHECK("__new_agent_thread_node_parts"."visibility" IN ('public', 'hidden', 'internal')),
	CONSTRAINT "agent_thread_node_parts_state_valid" CHECK("__new_agent_thread_node_parts"."state" IN ('streaming', 'done'))
);
--> statement-breakpoint
INSERT INTO `__new_agent_thread_node_parts` (`id`, `node_id`, `part_index`, `part_kind`, `visibility`, `state`, `provider_options_json`, `provider_metadata_json`, `payload_json`, `created_at`)
SELECT `id`, `node_id`, `part_index`, `part_kind`, `visibility`, `state`, `provider_options_json`, `provider_metadata_json`, `payload_json`, `created_at`
FROM `agent_thread_node_parts`;
--> statement-breakpoint
DROP TABLE `agent_thread_node_parts`;
--> statement-breakpoint
ALTER TABLE `__new_agent_thread_node_parts` RENAME TO `agent_thread_node_parts`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
--> statement-breakpoint
CREATE UNIQUE INDEX `agent_thread_node_parts_node_idx` ON `agent_thread_node_parts` (`node_id`,`part_index`);
--> statement-breakpoint
CREATE INDEX `agent_thread_node_parts_kind_idx` ON `agent_thread_node_parts` (`part_kind`);
