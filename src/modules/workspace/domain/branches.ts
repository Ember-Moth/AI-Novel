import fs from "node:fs";

import { createId, invariant, now } from "@/shared/lib/domain";

import { toBranchRef } from "./git-storage/git-store";
import type { BranchIndexRow, ProjectIndexRow } from "./git-storage/types";
import {
  findProjectMetaByBranchIdSync,
  readProjectMetaSync,
  updateProjectMetaSync,
} from "./git-storage/project-meta-store";
import { getWorkspaceForBranchId } from "./lifecycle";

export type BranchRow = BranchIndexRow;

function getProject(projectId: string): ProjectIndexRow {
  return readProjectMetaSync(projectId).project;
}

export function createBranch(input: {
  projectId: string;
  name: string;
  fromCommitId?: string | null;
}) {
  const project = getProject(input.projectId);
  const name = input.name.trim();
  invariant(name, "无法创建分支：分支名称不能为空。");
  const payload = readProjectMetaSync(project.id);
  const existing = payload.branches.find((branch) => branch.name === name);
  invariant(!existing, `无法创建分支：已存在名为「${name}」的分支。`);

  const branchId = createId("branch");
  const timestamp = now();
  const ref = toBranchRef(name);
  const headCommitId = input.fromCommitId ?? null;
  updateProjectMetaSync(
    project.id,
    (current) => ({
      ...current,
      project: {
        ...current.project,
        updatedAt: timestamp,
      },
      branches: [
        ...current.branches,
        {
          id: branchId,
          projectId: project.id,
          name,
          ref,
          headCommitId,
          forkedFromCommitId: input.fromCommitId ?? null,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
    }),
    "Create branch metadata",
  );
  return getBranch(branchId);
}

export function listBranches(projectId: string) {
  return readProjectMetaSync(projectId).branches;
}

export function getBranch(branchId: string) {
  const payload = findProjectMetaByBranchIdSync(branchId);
  const branch = payload?.branches.find((item) => item.id === branchId);
  invariant(branch, "未找到分支。");
  return branch;
}

export async function deleteBranch(branchId: string) {
  const branch = getBranch(branchId);
  const project = getProject(branch.projectId);
  invariant(
    project.defaultBranchId !== branch.id,
    "无法删除：这是项目的默认分支。请先切换默认分支。",
  );
  const workspace = getWorkspaceForBranchId(branch.id);
  if (workspace) {
    await fs.promises.rm(workspace.worktreePath, { recursive: true, force: true });
  }
  updateProjectMetaSync(
    project.id,
    (payload) => {
      const timestamp = now();
      return {
        ...payload,
        project: {
          ...payload.project,
          updatedAt: timestamp,
        },
        branches: payload.branches.filter((item) => item.id !== branch.id),
        workspaces: payload.workspaces.filter((item) => item.branchId !== branch.id),
      };
    },
    "Delete branch metadata",
  );
}
