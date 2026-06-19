import { createBranch } from "./branches";
import { getBranch, listBranches } from "./branches";
import { readProjectMeta, updateProjectMeta } from "./git-storage/project-meta-store";
import { touchProjectRepo } from "./git-storage/git-store";

// ---------------------------------------------------------------------------
// WorkspaceRow 是桥接类型 — workspaceId === branchId
// 所有 RPC/UI/AI 层继续传 workspaceId，域内映射到 branchId。
// ---------------------------------------------------------------------------
export interface WorkspaceRow {
  id: string;
  projectId: string;
  branchId: string;
  name: string;
}

function branchToWorkspaceRow(
  projectId: string,
  branch: { id: string; name: string },
): WorkspaceRow {
  return {
    id: branch.id,
    projectId,
    branchId: branch.id,
    name: branch.name,
  };
}

// ---------------------------------------------------------------------------
// 对外桥接 API（保持与 RPC / UI / AI 层的兼容）
// ---------------------------------------------------------------------------

export async function getWorkspace(projectId: string, workspaceId: string): Promise<WorkspaceRow> {
  const branch = await getBranch(projectId, workspaceId);
  return branchToWorkspaceRow(projectId, branch);
}

export async function getWorkspaceForBranchId(
  projectId: string,
  branchId: string,
): Promise<WorkspaceRow | null> {
  try {
    return await getWorkspace(projectId, branchId);
  } catch {
    return null;
  }
}

export async function listWorkspaces(projectId: string): Promise<WorkspaceRow[]> {
  const branches = await listBranches(projectId);
  return branches.map((b) => branchToWorkspaceRow(projectId, b));
}

export async function getDefaultWorkspace(projectId: string): Promise<WorkspaceRow | undefined> {
  const project = (await readProjectMeta(projectId)).project;
  if (!project.defaultBranchId) return undefined;
  return (await getWorkspaceForBranchId(projectId, project.defaultBranchId)) ?? undefined;
}

export async function createDefaultWorkspace(projectId: string, name = "main") {
  const branch = await createBranch({ projectId, name });
  await updateProjectMeta(
    projectId,
    (payload) => ({
      ...payload,
      project: {
        ...payload.project,
        defaultBranchId: branch.id,
      },
    }),
    "Create default branch",
  );
  return await getWorkspace(projectId, branch.id);
}

export async function createBranchWorkspace(input: {
  projectId: string;
  name: string;
  fromCommitId?: string | null;
}) {
  const branch = await createBranch(input);
  return await getWorkspace(input.projectId, branch.id);
}

export async function touchWorkspaceMeta(projectId: string, _workspaceId: string) {
  await touchProjectMeta(projectId);
}

export async function touchProjectMeta(projectId: string) {
  await touchProjectRepo(projectId);
}
