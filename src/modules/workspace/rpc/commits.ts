import { mutation, query } from "@codehz/rpc/core";

import {
  checkoutCommit,
  createCommit,
  getBranch,
  getCommit,
  getWorkspace,
  listCommits,
} from "@/modules/workspace/domain";
import { rpcTags, type RpcTagList } from "@/rpc/tags";

export const history = query<{ branchId: string }, ReturnType<typeof listCommits>, RpcTagList>({
  watch: ({ branchId }) => [rpcTags.commitHistory(branchId)],
  handler: ({ branchId }) => listCommits(branchId),
});

export const get = query<
  { commitId: string; projectId: string },
  ReturnType<typeof getCommit>,
  RpcTagList
>({
  watch: ({ commitId }) => [rpcTags.commit(commitId)],
  handler: ({ commitId, projectId }) => getCommit(commitId, projectId),
});

export const create = mutation<
  {
    branchId: string;
    message: string;
    author?: string | null;
    extraParents?: Array<{ parentId: string; mergeRole?: "normal" | "mainline" | "merged" }>;
  },
  ReturnType<typeof createCommit>,
  RpcTagList
>((input, ctx) => {
  const commit = createCommit(input);
  const branch = getBranch(input.branchId);
  ctx.invalidate(
    rpcTags.commitHistory(input.branchId),
    rpcTags.branch(input.branchId),
    rpcTags.branchesByProject(branch.projectId),
  );
  return commit;
});

export const checkout = mutation<
  { workspaceId: string; commitId: string },
  ReturnType<typeof checkoutCommit>,
  RpcTagList
>((input, ctx) => {
  const commit = checkoutCommit(input);
  const workspace = getWorkspace(input.workspaceId);
  ctx.invalidate(
    rpcTags.workspace(workspace.id),
    rpcTags.contentTree(workspace.id),
    rpcTags.timelineList(workspace.id),
    rpcTags.auxWorkspace(workspace.id),
  );
  return commit;
});
