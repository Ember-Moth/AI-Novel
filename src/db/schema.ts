import { sql } from "drizzle-orm";
import {
  blob,
  check,
  foreignKey,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const objectKinds = {
  content: 1,
  tree: 2,
  commit: 3,
} as const;

export const worktreeStates = ["ready", "merging", "conflicted"] as const;
export const conflictKinds = [
  "add_add",
  "delete_modify",
  "modify_delete",
  "content",
  "public_flag",
  "subtree",
  "structural",
] as const;

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: integer("created_at", { mode: "number" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "number" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    check("projects_name_nonempty", sql`length(${table.name}) > 0`),
    index("projects_updated_at_idx").on(table.updatedAt),
  ],
);

export const objects = sqliteTable(
  "objects",
  {
    hash: blob("hash", { mode: "buffer" }).primaryKey(),
    kind: integer("kind").notNull(),
    encodingVersion: integer("encoding_version").notNull().default(1),
    compression: integer("compression").notNull().default(0),
    payload: blob("payload", { mode: "buffer" }).notNull(),
    createdAt: integer("created_at", { mode: "number" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    check("objects_hash_length", sql`length(${table.hash}) = 32`),
    check("objects_kind_valid", sql`${table.kind} in (1, 2, 3)`),
    check("objects_payload_nonempty", sql`length(${table.payload}) > 0`),
    index("objects_kind_idx").on(table.kind),
    index("objects_created_at_idx").on(table.createdAt),
  ],
);

export const branches = sqliteTable(
  "branches",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade", onUpdate: "cascade" }),
    name: text("name").notNull(),
    headCommitHash: blob("head_commit_hash", { mode: "buffer" }),
    createdAt: integer("created_at", { mode: "number" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "number" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    check("branches_name_nonempty", sql`length(${table.name}) > 0`),
    check(
      "branches_name_no_slash",
      sql`instr(${table.name}, '/') = 0 and instr(${table.name}, char(0)) = 0`,
    ),
    check(
      "branches_head_commit_hash_length",
      sql`${table.headCommitHash} is null or length(${table.headCommitHash}) = 32`,
    ),
    uniqueIndex("branches_project_name_uq").on(table.projectId, table.name),
    index("branches_project_idx").on(table.projectId),
  ],
);

export const worktrees = sqliteTable(
  "worktrees",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    branchId: integer("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade", onUpdate: "cascade" }),
    state: text("state", { enum: worktreeStates }).notNull().default("ready"),
    checkoutCommitHash: blob("checkout_commit_hash", { mode: "buffer" }),
    mergeBaseCommitHash: blob("merge_base_commit_hash", { mode: "buffer" }),
    mergeOursCommitHash: blob("merge_ours_commit_hash", { mode: "buffer" }),
    mergeTheirsCommitHash: blob("merge_theirs_commit_hash", { mode: "buffer" }),
    createdAt: integer("created_at", { mode: "number" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "number" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    check("worktrees_state_valid", sql`${table.state} in ('ready', 'merging', 'conflicted')`),
    check(
      "worktrees_checkout_commit_hash_length",
      sql`${table.checkoutCommitHash} is null or length(${table.checkoutCommitHash}) = 32`,
    ),
    check(
      "worktrees_merge_base_commit_hash_length",
      sql`${table.mergeBaseCommitHash} is null or length(${table.mergeBaseCommitHash}) = 32`,
    ),
    check(
      "worktrees_merge_ours_commit_hash_length",
      sql`${table.mergeOursCommitHash} is null or length(${table.mergeOursCommitHash}) = 32`,
    ),
    check(
      "worktrees_merge_theirs_commit_hash_length",
      sql`${table.mergeTheirsCommitHash} is null or length(${table.mergeTheirsCommitHash}) = 32`,
    ),
    check(
      "worktrees_merge_context_consistent",
      sql`(
        ${table.state} = 'ready'
        and ${table.mergeBaseCommitHash} is null
        and ${table.mergeOursCommitHash} is null
        and ${table.mergeTheirsCommitHash} is null
      ) or (
        ${table.state} in ('merging', 'conflicted')
        and ${table.mergeBaseCommitHash} is not null
        and ${table.mergeOursCommitHash} is not null
        and ${table.mergeTheirsCommitHash} is not null
      )`,
    ),
    uniqueIndex("worktrees_branch_uq").on(table.branchId),
    index("worktrees_state_idx").on(table.state),
  ],
);

export const worktreeNodes = sqliteTable(
  "worktree_nodes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    worktreeId: integer("worktree_id").notNull(),
    parentId: integer("parent_id"),
    name: text("name").notNull(),
    isPublic: integer("is_public", { mode: "boolean" }).notNull().default(false),
    content: blob("content", { mode: "buffer" }),
    contentHash: blob("content_hash", { mode: "buffer" }),
    createdAt: integer("created_at", { mode: "number" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "number" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    foreignKey({
      columns: [table.worktreeId],
      foreignColumns: [worktrees.id],
      name: "worktree_nodes_worktree_fk",
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
      name: "worktree_nodes_parent_fk",
    }).onDelete("cascade"),
    check("worktree_nodes_name_nonempty", sql`length(${table.name}) > 0`),
    check(
      "worktree_nodes_name_no_slash",
      sql`instr(${table.name}, '/') = 0 and instr(${table.name}, char(0)) = 0`,
    ),
    check(
      "worktree_nodes_content_pair",
      sql`(
        ${table.content} is null and ${table.contentHash} is null
      ) or (
        ${table.content} is not null and ${table.contentHash} is not null
      )`,
    ),
    check(
      "worktree_nodes_content_hash_length",
      sql`${table.contentHash} is null or length(${table.contentHash}) = 32`,
    ),
    uniqueIndex("worktree_nodes_root_name_uq")
      .on(table.worktreeId, table.name)
      .where(sql`${table.parentId} is null`),
    uniqueIndex("worktree_nodes_sibling_name_uq")
      .on(table.worktreeId, table.parentId, table.name)
      .where(sql`${table.parentId} is not null`),
    index("worktree_nodes_parent_idx").on(table.worktreeId, table.parentId, table.name),
    index("worktree_nodes_public_idx").on(table.worktreeId, table.isPublic),
  ],
);

export const worktreeConflicts = sqliteTable(
  "worktree_conflicts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    worktreeId: integer("worktree_id")
      .notNull()
      .references(() => worktrees.id, { onDelete: "cascade", onUpdate: "cascade" }),
    path: text("path").notNull(),
    kind: text("kind", { enum: conflictKinds }).notNull(),
    baseExists: integer("base_exists", { mode: "boolean" }).notNull().default(false),
    oursExists: integer("ours_exists", { mode: "boolean" }).notNull().default(false),
    theirsExists: integer("theirs_exists", { mode: "boolean" }).notNull().default(false),
    basePublic: integer("base_public", { mode: "boolean" }),
    oursPublic: integer("ours_public", { mode: "boolean" }),
    theirsPublic: integer("theirs_public", { mode: "boolean" }),
    baseContent: blob("base_content", { mode: "buffer" }),
    baseContentHash: blob("base_content_hash", { mode: "buffer" }),
    oursContent: blob("ours_content", { mode: "buffer" }),
    oursContentHash: blob("ours_content_hash", { mode: "buffer" }),
    theirsContent: blob("theirs_content", { mode: "buffer" }),
    theirsContentHash: blob("theirs_content_hash", { mode: "buffer" }),
    baseSubtreeHash: blob("base_subtree_hash", { mode: "buffer" }),
    oursSubtreeHash: blob("ours_subtree_hash", { mode: "buffer" }),
    theirsSubtreeHash: blob("theirs_subtree_hash", { mode: "buffer" }),
    resolvedAt: integer("resolved_at", { mode: "number" }),
    createdAt: integer("created_at", { mode: "number" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    check(
      "worktree_conflicts_kind_valid",
      sql`${table.kind} in (
        'add_add',
        'delete_modify',
        'modify_delete',
        'content',
        'public_flag',
        'subtree',
        'structural'
      )`,
    ),
    check("worktree_conflicts_path_nonempty", sql`length(${table.path}) > 0`),
    check(
      "worktree_conflicts_base_content_pair",
      sql`(
        ${table.baseContent} is null and ${table.baseContentHash} is null
      ) or (
        ${table.baseContent} is not null and ${table.baseContentHash} is not null
      )`,
    ),
    check(
      "worktree_conflicts_ours_content_pair",
      sql`(
        ${table.oursContent} is null and ${table.oursContentHash} is null
      ) or (
        ${table.oursContent} is not null and ${table.oursContentHash} is not null
      )`,
    ),
    check(
      "worktree_conflicts_theirs_content_pair",
      sql`(
        ${table.theirsContent} is null and ${table.theirsContentHash} is null
      ) or (
        ${table.theirsContent} is not null and ${table.theirsContentHash} is not null
      )`,
    ),
    check(
      "worktree_conflicts_base_content_hash_length",
      sql`${table.baseContentHash} is null or length(${table.baseContentHash}) = 32`,
    ),
    check(
      "worktree_conflicts_ours_content_hash_length",
      sql`${table.oursContentHash} is null or length(${table.oursContentHash}) = 32`,
    ),
    check(
      "worktree_conflicts_theirs_content_hash_length",
      sql`${table.theirsContentHash} is null or length(${table.theirsContentHash}) = 32`,
    ),
    check(
      "worktree_conflicts_base_subtree_hash_length",
      sql`${table.baseSubtreeHash} is null or length(${table.baseSubtreeHash}) = 32`,
    ),
    check(
      "worktree_conflicts_ours_subtree_hash_length",
      sql`${table.oursSubtreeHash} is null or length(${table.oursSubtreeHash}) = 32`,
    ),
    check(
      "worktree_conflicts_theirs_subtree_hash_length",
      sql`${table.theirsSubtreeHash} is null or length(${table.theirsSubtreeHash}) = 32`,
    ),
    uniqueIndex("worktree_conflicts_path_uq").on(table.worktreeId, table.path),
    index("worktree_conflicts_kind_idx").on(table.worktreeId, table.kind),
    index("worktree_conflicts_resolved_idx").on(table.worktreeId, table.resolvedAt),
  ],
);
