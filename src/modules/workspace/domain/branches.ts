import { and, eq } from "drizzle-orm";

import { type DatabaseExecutor, db, schema } from "@/db";

import {
  getBranchOrThrow,
  getCommitOrThrow,
  getProjectOrThrow,
  getWorkspaceForBranch,
  touchProject,
} from "./internal/access";
import { restoreWorkspaceFromTree } from "./snapshot";
import { createId, invariant, now } from "@/shared/lib/domain";

export function createBranchWithExecutor(
  executor: DatabaseExecutor,
  input: { projectId: string; name: string; fromCommitId?: string | null },
) {
  const project = getProjectOrThrow(executor, input.projectId);
  const name = input.name.trim();
  invariant(name, "无法创建分支：分支名称不能为空。");

  const existing = executor
    .select({ id: schema.branches.id })
    .from(schema.branches)
    .where(and(eq(schema.branches.projectId, project.id), eq(schema.branches.name, name)))
    .get();
  invariant(!existing, `无法创建分支：已存在名为「${name}」的分支。`);

  const fromCommit = input.fromCommitId
    ? getCommitOrThrow(executor, project.id, input.fromCommitId)
    : null;

  const branchId = createId("branch");
  const timestamp = now();
  executor
    .insert(schema.branches)
    .values({
      id: branchId,
      projectId: project.id,
      name,
      headCommitId: fromCommit?.id ?? null,
      forkedFromCommitId: fromCommit?.id ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .run();

  touchProject(executor, project.id);
  return getBranchOrThrow(executor, branchId);
}

export function createBranch(input: {
  projectId: string;
  name: string;
  fromCommitId?: string | null;
}) {
  return db.transaction((tx) => createBranchWithExecutor(tx, input));
}

export function listBranches(projectId: string) {
  getProjectOrThrow(db, projectId);
  return db.select().from(schema.branches).where(eq(schema.branches.projectId, projectId)).all();
}

export function getBranch(branchId: string) {
  return getBranchOrThrow(db, branchId);
}

export function deleteBranch(branchId: string) {
  return db.transaction((tx) => {
    const branch = getBranchOrThrow(tx, branchId);
    const project = getProjectOrThrow(tx, branch.projectId);
    invariant(
      project.defaultBranchId !== branch.id,
      "无法删除：这是项目的默认分支。请先切换默认分支。",
    );

    const workspace = getWorkspaceForBranch(tx, branch.id);
    if (workspace) {
      tx.delete(schema.workspaces).where(eq(schema.workspaces.id, workspace.id)).run();
    }

    tx.delete(schema.branches).where(eq(schema.branches.id, branch.id)).run();
    touchProject(tx, project.id);
  });
}

export function checkoutBranchIntoWorkspace(
  executor: DatabaseExecutor,
  workspaceId: string,
  branchId: string,
) {
  const branch = getBranchOrThrow(executor, branchId);
  if (!branch.headCommitId) {
    return;
  }
  const commit = getCommitOrThrow(executor, branch.projectId, branch.headCommitId);
  restoreWorkspaceFromTree(executor, workspaceId, commit.treeId);
}
