PRAGMA foreign_keys=OFF;--> statement-breakpoint
ALTER TABLE `agent_runs` RENAME TO `agent_runs_old`;--> statement-breakpoint
CREATE TABLE `agent_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`parent_run_id` text,
	`parent_event_id` text,
	`trigger_node_id` text,
	`base_tip_node_id` text,
	`run_mode` text NOT NULL,
	`status` text NOT NULL,
	`agent_profile` text NOT NULL,
	`error_artifact_id` text,
	`selection_snapshot_json` text DEFAULT '{}' NOT NULL,
	`context_snapshot_json` text,
	`input_refs_snapshot_json` text,
	`active_tools_json` text,
	`step_count` integer DEFAULT 0 NOT NULL,
	`total_tokens` integer,
	`last_finish_reason` text,
	`error_summary` text,
	`trace_updated_at` integer,
	`started_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`completed_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `agent_threads`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "agent_runs_mode_valid" CHECK("agent_runs"."run_mode" IN ('send', 'retry', 'regenerate', 'edit_regenerate', 'continue', 'subagent')),
	CONSTRAINT "agent_runs_status_valid" CHECK("agent_runs"."status" IN ('queued', 'running', 'waiting_for_input', 'succeeded', 'failed', 'cancelled')),
	CONSTRAINT "agent_runs_profile_nonempty" CHECK(length("agent_runs"."agent_profile") > 0)
);
--> statement-breakpoint
INSERT INTO `agent_runs` (
	`id`,
	`thread_id`,
	`parent_run_id`,
	`parent_event_id`,
	`trigger_node_id`,
	`base_tip_node_id`,
	`run_mode`,
	`status`,
	`agent_profile`,
	`error_artifact_id`,
	`selection_snapshot_json`,
	`context_snapshot_json`,
	`input_refs_snapshot_json`,
	`active_tools_json`,
	`step_count`,
	`total_tokens`,
	`last_finish_reason`,
	`error_summary`,
	`trace_updated_at`,
	`started_at`,
	`completed_at`,
	`created_at`,
	`updated_at`
)
SELECT
	`id`,
	`thread_id`,
	`parent_run_id`,
	`parent_event_id`,
	`trigger_node_id`,
	`base_tip_node_id`,
	`run_mode`,
	`status`,
	`agent_profile`,
	`error_artifact_id`,
	`selection_snapshot_json`,
	`context_snapshot_json`,
	`input_refs_snapshot_json`,
	`active_tools_json`,
	`step_count`,
	`total_tokens`,
	`last_finish_reason`,
	`error_summary`,
	`trace_updated_at`,
	`started_at`,
	`completed_at`,
	`created_at`,
	`updated_at`
FROM `agent_runs_old`;--> statement-breakpoint
DROP TABLE `agent_runs_old`;--> statement-breakpoint
CREATE INDEX `agent_runs_thread_idx` ON `agent_runs` (`thread_id`);--> statement-breakpoint
CREATE INDEX `agent_runs_parent_run_idx` ON `agent_runs` (`parent_run_id`);--> statement-breakpoint
CREATE INDEX `agent_runs_thread_status_idx` ON `agent_runs` (`thread_id`,`status`);--> statement-breakpoint
CREATE INDEX `agent_runs_thread_created_idx` ON `agent_runs` (`thread_id`,`created_at`);--> statement-breakpoint
PRAGMA foreign_keys=ON;
