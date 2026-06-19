export interface BranchLike {
  id: string;
  updatedAt: number;
}

export interface BranchHeadLike {
  branchId: string;
  headCommitId: string | null;
}

export interface WorkspaceRouteLike {
  projectId: string;
  workspaceId: string;
}

export interface WorkspaceLike {
  id: string;
  projectId: string;
}

export function sortProjectBranches<TBranch extends BranchLike>(
  branches: readonly TBranch[],
  defaultBranchId: string | null,
) {
  return [...branches].sort((a, b) => {
    const aDefault = a.id === defaultBranchId;
    const bDefault = b.id === defaultBranchId;
    if (aDefault !== bDefault) {
      return aDefault ? -1 : 1;
    }
    return b.updatedAt - a.updatedAt;
  });
}

export function resolveSelectedBranchId<TBranch extends BranchLike>(
  branches: readonly TBranch[],
  rememberedBranchId: string | null,
  defaultBranchId: string | null,
) {
  if (rememberedBranchId && branches.some((branch) => branch.id === rememberedBranchId)) {
    return rememberedBranchId;
  }

  const sorted = sortProjectBranches(branches, defaultBranchId);
  return sorted[0]?.id ?? null;
}

export function resolveNewBranchSourceCommitId<TBranchHead extends BranchHeadLike>(
  branchHeads: readonly TBranchHead[],
  defaultBranchId: string | null,
) {
  const defaultBranch = branchHeads.find((branch) => branch.branchId === defaultBranchId);
  return defaultBranch?.headCommitId ?? null;
}

export function resolveWorkspaceRouteAfterBranchDelete<TWorkspace extends WorkspaceLike>(
  currentRoute: WorkspaceRouteLike | null,
  deletedWorkspace: TWorkspace | null,
) {
  if (
    currentRoute &&
    deletedWorkspace &&
    currentRoute.projectId === deletedWorkspace.projectId &&
    currentRoute.workspaceId === deletedWorkspace.id
  ) {
    return null;
  }

  return currentRoute;
}

export function resolveSelectedBranchIdAfterDelete<TBranch extends BranchLike>(
  branches: readonly TBranch[],
  deletedBranchId: string,
  selectedBranchId: string | null,
  defaultBranchId: string | null,
) {
  const remainingBranches = branches.filter((branch) => branch.id !== deletedBranchId);
  return resolveSelectedBranchId(
    remainingBranches,
    selectedBranchId === deletedBranchId ? null : selectedBranchId,
    defaultBranchId,
  );
}
