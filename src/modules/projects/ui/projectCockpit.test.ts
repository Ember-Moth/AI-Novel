import { expect, test } from "bun:test";

import {
  resolveNewBranchSourceCommitId,
  resolveSelectedBranchId,
  resolveWorkspaceRouteAfterBranchDelete,
  sortProjectBranches,
} from "./projectCockpit";

const branches = [
  { id: "branch_old", updatedAt: 10 },
  { id: "branch_default", updatedAt: 20 },
  { id: "branch_new", updatedAt: 30 },
];

const branchHeads = [
  { branchId: "branch_old", headCommitId: "commit_old" },
  { branchId: "branch_default", headCommitId: "commit_default" },
  { branchId: "branch_new", headCommitId: "commit_new" },
];

test("sortProjectBranches keeps the default branch first, then sorts by updatedAt", () => {
  expect(sortProjectBranches(branches, "branch_default").map((branch) => branch.id)).toEqual([
    "branch_default",
    "branch_new",
    "branch_old",
  ]);
});

test("resolveSelectedBranchId prefers remembered branch, then default branch, then most recent branch", () => {
  expect(resolveSelectedBranchId(branches, null, "branch_default")).toBe("branch_default");
  expect(resolveSelectedBranchId(branches, "branch_new", "branch_default")).toBe("branch_new");
  expect(resolveSelectedBranchId(branches, "missing", null)).toBe("branch_new");
  expect(resolveSelectedBranchId([], null, "branch_default")).toBeNull();
});

test("resolveNewBranchSourceCommitId uses the default branch head when present", () => {
  expect(resolveNewBranchSourceCommitId(branchHeads, "branch_default")).toBe("commit_default");
  expect(
    resolveNewBranchSourceCommitId(
      [{ branchId: "branch_empty", headCommitId: null }],
      "branch_empty",
    ),
  ).toBeNull();
});

test("resolveWorkspaceRouteAfterBranchDelete closes only the deleted workspace", () => {
  const currentRoute = { projectId: "project_1", workspaceId: "workspace_1" };

  expect(
    resolveWorkspaceRouteAfterBranchDelete(currentRoute, {
      id: "workspace_1",
      projectId: "project_1",
    }),
  ).toBeNull();
  expect(
    resolveWorkspaceRouteAfterBranchDelete(currentRoute, {
      id: "workspace_2",
      projectId: "project_1",
    }),
  ).toEqual(currentRoute);
  expect(
    resolveWorkspaceRouteAfterBranchDelete(currentRoute, {
      id: "workspace_1",
      projectId: "project_2",
    }),
  ).toEqual(currentRoute);
  expect(resolveWorkspaceRouteAfterBranchDelete(currentRoute, null)).toEqual(currentRoute);
});
