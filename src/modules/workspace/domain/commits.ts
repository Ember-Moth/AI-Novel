import { asc, eq } from "drizzle-orm";

import { type DatabaseExecutor, db, schema } from "@/db";

import {
  getBranchOrThrow,
  getCommitOrThrow,
  getWorkspaceForBranch,
  touchProject,
} from "./internal/access";
import { hashCommit } from "./hash";
import { restoreWorkspaceFromTree, snapshotWorkspaceState } from "./snapshot";
import { invariant, now } from "@/shared/lib/domain";

interface ParentSpec {
  parentId: string;
  mergeRole?: "normal" | "mainline" | "merged";
}

function insertCommit(
  executor: DatabaseExecutor,
  input: {
    projectId: string;
    treeId: string;
    message: string;
    author: string | null;
    committedAt: number;
    parents: ParentSpec[];
  },
) {
  const commitId = hashCommit({
    treeId: input.treeId,
    message: input.message,
    author: input.author,
    committedAt: input.committedAt,
    parentIds: input.parents.map((parent) => parent.parentId),
  });

  const existing = executor
    .select({ id: schema.commits.id })
    .from(schema.commits)
    .where(eq(schema.commits.id, commitId))
    .get();
  if (existing) {
    return commitId;
  }

  executor
    .insert(schema.commits)
    .values({
      id: commitId,
      projectId: input.projectId,
      treeId: input.treeId,
      message: input.message,
      author: input.author,
      committedAt: input.committedAt,
      createdAt: now(),
    })
    .run();

  input.parents.forEach((parent, index) => {
    executor
      .insert(schema.commitParents)
      .values({
        commitId,
        parentId: parent.parentId,
        parentIndex: index,
        mergeRole: parent.mergeRole ?? (index === 0 ? "mainline" : "merged"),
        createdAt: now(),
      })
      .run();
  });

  return commitId;
}

export function createCommit(input: {
  branchId: string;
  message: string;
  author?: string | null;
  extraParents?: ParentSpec[];
}) {
  return db.transaction((tx) => {
    const branch = getBranchOrThrow(tx, input.branchId);
    const message = input.message.trim();
    invariant(message, "无法提交：提交信息不能为空。");

    const workspace = getWorkspaceForBranch(tx, branch.id);
    invariant(workspace, "无法提交：该分支没有关联的工作区。");

    const treeId = snapshotWorkspaceState(tx, workspace.id);
    const committedAt = now();

    const parents: ParentSpec[] = [];
    if (branch.headCommitId) {
      parents.push({ parentId: branch.headCommitId, mergeRole: "mainline" });
    }
    for (const extra of input.extraParents ?? []) {
      getCommitOrThrow(tx, branch.projectId, extra.parentId);
      parents.push({ parentId: extra.parentId, mergeRole: extra.mergeRole ?? "merged" });
    }

    const commitId = insertCommit(tx, {
      projectId: branch.projectId,
      treeId,
      message,
      author: input.author ?? null,
      committedAt,
      parents,
    });

    tx.update(schema.branches)
      .set({ headCommitId: commitId, updatedAt: committedAt })
      .where(eq(schema.branches.id, branch.id))
      .run();
    touchProject(tx, branch.projectId);

    return getCommitOrThrow(tx, branch.projectId, commitId);
  });
}

export function checkoutCommit(input: { workspaceId: string; commitId: string }) {
  return db.transaction((tx) => {
    const workspace = tx
      .select()
      .from(schema.workspaces)
      .where(eq(schema.workspaces.id, input.workspaceId))
      .get();
    invariant(workspace, "未找到工作区。");
    const commit = getCommitOrThrow(tx, workspace.projectId, input.commitId);
    restoreWorkspaceFromTree(tx, workspace.id, commit.treeId);
    return commit;
  });
}

export function getCommitParents(executor: DatabaseExecutor, commitId: string) {
  return executor
    .select()
    .from(schema.commitParents)
    .where(eq(schema.commitParents.commitId, commitId))
    .orderBy(asc(schema.commitParents.parentIndex))
    .all();
}

export function getCommit(commitId: string, projectId: string) {
  const commit = getCommitOrThrow(db, projectId, commitId);
  return { ...commit, parents: getCommitParents(db, commit.id) };
}

export function listCommits(branchId: string) {
  const branch = getBranchOrThrow(db, branchId);
  const ordered: Array<
    typeof schema.commits.$inferSelect & { parents: ReturnType<typeof getCommitParents> }
  > = [];
  const visited = new Set<string>();
  let currentId = branch.headCommitId;

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const commit = getCommitOrThrow(db, branch.projectId, currentId);
    const parents = getCommitParents(db, commit.id);
    ordered.push({ ...commit, parents });
    currentId = parents[0]?.parentId ?? null;
  }

  return ordered;
}
