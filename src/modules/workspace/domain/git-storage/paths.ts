import { join } from "node:path";

import { ensureProjectStorageRoot } from "@/shared/lib/storage-paths";

export function ensureStorageRoot() {
  return ensureProjectStorageRoot();
}

export function getProjectRepoGitDir(projectId: string) {
  return join(ensureStorageRoot(), "repos", `${projectId}.git`);
}

/** @deprecated 仅保留给 aux.ts 物理操作迁移过渡期使用 */
export function getProjectWorktreeDir(projectId: string, branchId: string) {
  return join(ensureStorageRoot(), "worktrees", projectId, branchId);
}
