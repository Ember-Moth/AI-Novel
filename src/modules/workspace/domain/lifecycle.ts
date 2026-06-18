import { mkdirSync } from "node:fs";

import { createId, invariant, now } from "@/shared/lib/domain";

import { createBranch } from "./branches";
import { branchRef, checkoutCommitToWorktree, resolveRef } from "./git-storage/git-store";
import { getProjectWorktreeDir } from "./git-storage/paths";
import type { BranchIndexRow, ProjectIndexRow, WorkspaceIndexRow } from "./git-storage/types";
import {
  findProjectMetaByWorkspaceIdSync,
  listProjectMetaSync,
  readProjectMetaSync,
  updateProjectMetaSync,
  writeProjectMetaSync as persistProjectMetaSync,
} from "./git-storage/project-meta-store";
import { seedEmptyWorktree } from "./git-storage/worktree-state";

export type WorkspaceRow = WorkspaceIndexRow;

function getProjectRow(projectId: string): ProjectIndexRow {
  return readProjectMetaSync(projectId).project;
}

function getBranchRow(branchId: string): BranchIndexRow {
  const branch = listAllBranches().find((item) => item.id === branchId);
  invariant(branch, "未找到分支。");
  return branch;
}

function listAllBranches() {
  return listProjectMetaSync().flatMap((payload) => payload.branches);
}

export function listWorkspaces(projectId: string): WorkspaceRow[] {
  return readProjectMetaSync(projectId).workspaces;
}

export function getWorkspace(workspaceId: string): WorkspaceRow {
  const payload = findProjectMetaByWorkspaceIdSync(workspaceId);
  const workspace = payload?.workspaces.find((item) => item.id === workspaceId);
  invariant(workspace, "未找到工作区。");
  return workspace;
}

export function getWorkspaceForBranchId(branchId: string): WorkspaceRow | null {
  return listAllWorkspaces().find((workspace) => workspace.branchId === branchId) ?? null;
}

function listAllWorkspaces() {
  return listProjectMetaSync().flatMap((payload) => payload.workspaces);
}

export function getDefaultWorkspace(projectId: string) {
  const project = getProjectRow(projectId);
  return project.defaultBranchId
    ? (getWorkspaceForBranchId(project.defaultBranchId) ?? undefined)
    : undefined;
}

export async function writeProjectMeta(projectId: string) {
  const payload = readProjectMetaSync(projectId);
  persistProjectMetaSync(payload);
}

export function writeProjectMetaSync(projectId: string) {
  persistProjectMetaSync(readProjectMetaSync(projectId));
}

export function touchWorkspaceMeta(workspaceId: string, timestamp = now()) {
  const workspace = getWorkspace(workspaceId);
  updateProjectMetaSync(
    workspace.projectId,
    (payload) => ({
      ...payload,
      project: {
        ...payload.project,
        updatedAt: timestamp,
      },
      workspaces: payload.workspaces.map((item) =>
        item.id === workspaceId ? { ...item, updatedAt: timestamp } : item,
      ),
    }),
    "Touch workspace metadata",
  );
}

export function touchProjectMeta(projectId: string, timestamp = now()) {
  updateProjectMetaSync(
    projectId,
    (payload) => ({
      ...payload,
      project: {
        ...payload.project,
        updatedAt: timestamp,
      },
    }),
    "Touch project metadata",
  );
}

export async function createWorkspaceForBranch(branchId: string, name?: string) {
  const branch = getBranchRow(branchId);
  invariant(!getWorkspaceForBranchId(branch.id), "无法创建工作区：该分支已存在工作区。");

  const timestamp = now();
  const workspaceId = createId("workspace");
  const worktreePath = getProjectWorktreeDir(branch.projectId, workspaceId);

  mkdirSync(worktreePath, { recursive: true });
  seedEmptyWorktree(worktreePath);
  const headCommitId = await resolveRef(branch.projectId, branchRef(branch.id));
  if (headCommitId) {
    await checkoutCommitToWorktree({
      projectId: branch.projectId,
      workspaceId,
      commitId: headCommitId,
    });
  }

  updateProjectMetaSync(
    branch.projectId,
    (payload) => ({
      ...payload,
      project: {
        ...payload.project,
        updatedAt: timestamp,
      },
      workspaces: [
        ...payload.workspaces,
        {
          id: workspaceId,
          projectId: branch.projectId,
          branchId: branch.id,
          name: name ?? branch.name,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
    }),
    "Create workspace metadata",
  );
  return getWorkspace(workspaceId);
}

export function createDefaultWorkspace(projectId: string, name = "main") {
  const branch = createBranch({ projectId, name });
  const workspaceId = createId("workspace");
  const worktreePath = getProjectWorktreeDir(projectId, workspaceId);
  mkdirSync(worktreePath, { recursive: true });
  seedEmptyWorktree(worktreePath);
  const timestamp = now();
  updateProjectMetaSync(
    projectId,
    (payload) => ({
      ...payload,
      project: {
        ...payload.project,
        defaultBranchId: branch.id,
        updatedAt: timestamp,
      },
      workspaces: [
        ...payload.workspaces,
        {
          id: workspaceId,
          projectId,
          branchId: branch.id,
          name,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
    }),
    "Create default workspace metadata",
  );
  const workspace = getWorkspace(workspaceId);
  writeProjectMetaSync(projectId);
  return workspace;
}

export async function createBranchWorkspace(input: {
  projectId: string;
  name: string;
  fromCommitId?: string | null;
  workspaceName?: string;
}) {
  const branch = createBranch({
    projectId: input.projectId,
    name: input.name,
    fromCommitId: input.fromCommitId,
  });
  return await createWorkspaceForBranch(branch.id, input.workspaceName ?? input.name);
}
