CREATE TABLE `branches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`head_commit_hash` blob,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE cascade ON DELETE cascade,
	CONSTRAINT "branches_name_nonempty" CHECK(length("branches"."name") > 0),
	CONSTRAINT "branches_name_no_slash" CHECK(instr("branches"."name", '/') = 0 and instr("branches"."name", char(0)) = 0),
	CONSTRAINT "branches_head_commit_hash_length" CHECK("branches"."head_commit_hash" is null or length("branches"."head_commit_hash") = 32)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `branches_project_name_uq` ON `branches` (`project_id`,`name`);--> statement-breakpoint
CREATE INDEX `branches_project_idx` ON `branches` (`project_id`);--> statement-breakpoint
CREATE TABLE `objects` (
	`hash` blob PRIMARY KEY NOT NULL,
	`kind` integer NOT NULL,
	`encoding_version` integer DEFAULT 1 NOT NULL,
	`compression` integer DEFAULT 0 NOT NULL,
	`payload` blob NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "objects_hash_length" CHECK(length("objects"."hash") = 32),
	CONSTRAINT "objects_kind_valid" CHECK("objects"."kind" in (1, 2, 3)),
	CONSTRAINT "objects_payload_nonempty" CHECK(length("objects"."payload") > 0)
);
--> statement-breakpoint
CREATE INDEX `objects_kind_idx` ON `objects` (`kind`);--> statement-breakpoint
CREATE INDEX `objects_created_at_idx` ON `objects` (`created_at`);--> statement-breakpoint
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
CREATE TABLE `worktree_conflicts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`worktree_id` integer NOT NULL,
	`path` text NOT NULL,
	`kind` text NOT NULL,
	`base_exists` integer DEFAULT false NOT NULL,
	`ours_exists` integer DEFAULT false NOT NULL,
	`theirs_exists` integer DEFAULT false NOT NULL,
	`base_public` integer,
	`ours_public` integer,
	`theirs_public` integer,
	`base_content` blob,
	`base_content_hash` blob,
	`ours_content` blob,
	`ours_content_hash` blob,
	`theirs_content` blob,
	`theirs_content_hash` blob,
	`base_subtree_hash` blob,
	`ours_subtree_hash` blob,
	`theirs_subtree_hash` blob,
	`resolved_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`worktree_id`) REFERENCES `worktrees`(`id`) ON UPDATE cascade ON DELETE cascade,
	CONSTRAINT "worktree_conflicts_kind_valid" CHECK("worktree_conflicts"."kind" in (
        'add_add',
        'delete_modify',
        'modify_delete',
        'content',
        'public_flag',
        'subtree',
        'structural'
      )),
	CONSTRAINT "worktree_conflicts_path_nonempty" CHECK(length("worktree_conflicts"."path") > 0),
	CONSTRAINT "worktree_conflicts_base_content_pair" CHECK((
        "worktree_conflicts"."base_content" is null and "worktree_conflicts"."base_content_hash" is null
      ) or (
        "worktree_conflicts"."base_content" is not null and "worktree_conflicts"."base_content_hash" is not null
      )),
	CONSTRAINT "worktree_conflicts_ours_content_pair" CHECK((
        "worktree_conflicts"."ours_content" is null and "worktree_conflicts"."ours_content_hash" is null
      ) or (
        "worktree_conflicts"."ours_content" is not null and "worktree_conflicts"."ours_content_hash" is not null
      )),
	CONSTRAINT "worktree_conflicts_theirs_content_pair" CHECK((
        "worktree_conflicts"."theirs_content" is null and "worktree_conflicts"."theirs_content_hash" is null
      ) or (
        "worktree_conflicts"."theirs_content" is not null and "worktree_conflicts"."theirs_content_hash" is not null
      )),
	CONSTRAINT "worktree_conflicts_base_content_hash_length" CHECK("worktree_conflicts"."base_content_hash" is null or length("worktree_conflicts"."base_content_hash") = 32),
	CONSTRAINT "worktree_conflicts_ours_content_hash_length" CHECK("worktree_conflicts"."ours_content_hash" is null or length("worktree_conflicts"."ours_content_hash") = 32),
	CONSTRAINT "worktree_conflicts_theirs_content_hash_length" CHECK("worktree_conflicts"."theirs_content_hash" is null or length("worktree_conflicts"."theirs_content_hash") = 32),
	CONSTRAINT "worktree_conflicts_base_subtree_hash_length" CHECK("worktree_conflicts"."base_subtree_hash" is null or length("worktree_conflicts"."base_subtree_hash") = 32),
	CONSTRAINT "worktree_conflicts_ours_subtree_hash_length" CHECK("worktree_conflicts"."ours_subtree_hash" is null or length("worktree_conflicts"."ours_subtree_hash") = 32),
	CONSTRAINT "worktree_conflicts_theirs_subtree_hash_length" CHECK("worktree_conflicts"."theirs_subtree_hash" is null or length("worktree_conflicts"."theirs_subtree_hash") = 32)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `worktree_conflicts_path_uq` ON `worktree_conflicts` (`worktree_id`,`path`);--> statement-breakpoint
CREATE INDEX `worktree_conflicts_kind_idx` ON `worktree_conflicts` (`worktree_id`,`kind`);--> statement-breakpoint
CREATE INDEX `worktree_conflicts_resolved_idx` ON `worktree_conflicts` (`worktree_id`,`resolved_at`);--> statement-breakpoint
CREATE TABLE `worktree_nodes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`worktree_id` integer NOT NULL,
	`parent_id` integer,
	`name` text NOT NULL,
	`is_public` integer DEFAULT false NOT NULL,
	`content` blob,
	`content_hash` blob,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`worktree_id`) REFERENCES `worktrees`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `worktree_nodes`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "worktree_nodes_name_nonempty" CHECK(length("worktree_nodes"."name") > 0),
	CONSTRAINT "worktree_nodes_name_no_slash" CHECK(instr("worktree_nodes"."name", '/') = 0 and instr("worktree_nodes"."name", char(0)) = 0),
	CONSTRAINT "worktree_nodes_content_pair" CHECK((
        "worktree_nodes"."content" is null and "worktree_nodes"."content_hash" is null
      ) or (
        "worktree_nodes"."content" is not null and "worktree_nodes"."content_hash" is not null
      )),
	CONSTRAINT "worktree_nodes_content_hash_length" CHECK("worktree_nodes"."content_hash" is null or length("worktree_nodes"."content_hash") = 32)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `worktree_nodes_root_name_uq` ON `worktree_nodes` (`worktree_id`,`name`) WHERE "worktree_nodes"."parent_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX `worktree_nodes_sibling_name_uq` ON `worktree_nodes` (`worktree_id`,`parent_id`,`name`) WHERE "worktree_nodes"."parent_id" is not null;--> statement-breakpoint
CREATE INDEX `worktree_nodes_parent_idx` ON `worktree_nodes` (`worktree_id`,`parent_id`,`name`);--> statement-breakpoint
CREATE INDEX `worktree_nodes_public_idx` ON `worktree_nodes` (`worktree_id`,`is_public`);--> statement-breakpoint
CREATE TABLE `worktrees` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`branch_id` integer NOT NULL,
	`state` text DEFAULT 'ready' NOT NULL,
	`checkout_commit_hash` blob,
	`merge_base_commit_hash` blob,
	`merge_ours_commit_hash` blob,
	`merge_theirs_commit_hash` blob,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE cascade ON DELETE cascade,
	CONSTRAINT "worktrees_state_valid" CHECK("worktrees"."state" in ('ready', 'merging', 'conflicted')),
	CONSTRAINT "worktrees_checkout_commit_hash_length" CHECK("worktrees"."checkout_commit_hash" is null or length("worktrees"."checkout_commit_hash") = 32),
	CONSTRAINT "worktrees_merge_base_commit_hash_length" CHECK("worktrees"."merge_base_commit_hash" is null or length("worktrees"."merge_base_commit_hash") = 32),
	CONSTRAINT "worktrees_merge_ours_commit_hash_length" CHECK("worktrees"."merge_ours_commit_hash" is null or length("worktrees"."merge_ours_commit_hash") = 32),
	CONSTRAINT "worktrees_merge_theirs_commit_hash_length" CHECK("worktrees"."merge_theirs_commit_hash" is null or length("worktrees"."merge_theirs_commit_hash") = 32),
	CONSTRAINT "worktrees_merge_context_consistent" CHECK((
        "worktrees"."state" = 'ready'
        and "worktrees"."merge_base_commit_hash" is null
        and "worktrees"."merge_ours_commit_hash" is null
        and "worktrees"."merge_theirs_commit_hash" is null
      ) or (
        "worktrees"."state" in ('merging', 'conflicted')
        and "worktrees"."merge_base_commit_hash" is not null
        and "worktrees"."merge_ours_commit_hash" is not null
        and "worktrees"."merge_theirs_commit_hash" is not null
      ))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `worktrees_branch_uq` ON `worktrees` (`branch_id`);--> statement-breakpoint
CREATE INDEX `worktrees_state_idx` ON `worktrees` (`state`);