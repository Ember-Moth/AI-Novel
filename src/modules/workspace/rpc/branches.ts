import { mutation, query } from "@codehz/rpc/core";

import {
  createBranch,
  createBranchWorkspace,
  deleteBranch,
  getBranch,
  listBranches,
} from "@/modules/workspace/domain";
import { rpcTags, type RpcTagList } from "@/rpc/tags";

export const list = query<{ projectId: string }, ReturnType<typeof listBranches>, RpcTagList>({
  watch: ({ projectId }) => [rpcTags.branchesByProject(projectId)],
  handler: ({ projectId }) => listBranches(projectId),
});

export const get = query<{ branchId: string }, ReturnType<typeof getBranch>, RpcTagList>({
  watch: ({ branchId }) => [rpcTags.branch(branchId)],
  handler: ({ branchId }) => getBranch(branchId),
});

export const create = mutation<
  { projectId: string; name: string; fromCommitId?: string | null },
  ReturnType<typeof createBranch>,
  RpcTagList
>({
  invalidate: (input) => [rpcTags.branchesByProject(input.projectId)],
  handler: (input) => createBranch(input),
});

export const createWithWorkspace = mutation<
  { projectId: string; name: string; fromCommitId?: string | null; workspaceName?: string },
  ReturnType<typeof createBranchWorkspace>,
  RpcTagList
>({
  invalidate: (input) => [
    rpcTags.branchesByProject(input.projectId),
    rpcTags.workspacesByProject(input.projectId),
  ],
  handler: (input) => createBranchWorkspace(input),
});

export const deleteMutation = mutation<{ projectId: string; branchId: string }, void, RpcTagList>({
  invalidate: (input) => [
    rpcTags.branchesByProject(input.projectId),
    rpcTags.branch(input.branchId),
  ],
  handler: ({ branchId }) => deleteBranch(branchId),
});
