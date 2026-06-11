import { skipToken } from "@codehz/rpc/react";
import { useAtomValue, useSetAtom } from "jotai";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

import { AppShell, AppSidebar } from "@/app/shell/AppShell";
import { lastProjectIdAtom, lastWorkspaceRouteAtom } from "@/app/state/lastProject";
import { rpc } from "@/rpc/client";
import { createProjectId } from "@/shared/lib/domain";
import { cn } from "@/shared/lib/cn";
import { FullPageMessage } from "@/shared/ui/FullPageMessage";
import { LoadingBlock } from "@/shared/ui/Loading";
import { SidebarListRow } from "@/shared/ui/tree/SidebarListRow";

import {
  insertProjectOptimistically,
  removeProjectOptimistically,
  updateProjectOptimistically,
} from "./projectCache";
import {
  resolveNewBranchSourceCommitId,
  resolveSelectedBranchId,
  sortProjectBranches,
} from "./projectCockpit";

type ProjectList = NonNullable<ReturnType<typeof rpc.useQuery<"projects.list">>["data"]>;
type ProjectRow = NonNullable<ReturnType<typeof rpc.useQuery<"projects.get">>["data"]>;
type BranchList = NonNullable<ReturnType<typeof rpc.useQuery<"branches.list">>["data"]>;
type BranchRow = BranchList[number];
type WorkspaceList = NonNullable<ReturnType<typeof rpc.useQuery<"workspaces.list">>["data"]>;
type WorkspaceRow = WorkspaceList[number];
type CommitHistory = NonNullable<ReturnType<typeof rpc.useQuery<"commits.history">>["data"]>;
type CommitRow = CommitHistory[number];
type ProjectMutationContext = {
  previousProjects?: ProjectList;
};

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short",
});

const buttonBase =
  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButton = `${buttonBase} border border-border bg-sidebar-background text-foreground hover:bg-list-hover-background`;
const primaryButton = `${buttonBase} bg-accent-background text-foreground hover:brightness-110`;

export function ProjectsPage({
  projectId = null,
  section = "overview",
  branchId = null,
}: {
  projectId?: string | null;
  section?: "overview" | "branches";
  branchId?: string | null;
}) {
  const [, navigate] = useLocation();
  const lastProjectId = useAtomValue(lastProjectIdAtom);
  const setLastProjectId = useSetAtom(lastProjectIdAtom);
  const setLastWorkspaceRoute = useSetAtom(lastWorkspaceRouteAtom);

  const createProjectDialogRef = useRef<HTMLDialogElement>(null);
  const createBranchDialogRef = useRef<HTMLDialogElement>(null);
  const forkBranchDialogRef = useRef<HTMLDialogElement>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [detailName, setDetailName] = useState("");
  const [detailDescription, setDetailDescription] = useState("");
  const [detailError, setDetailError] = useState<string | null>(null);

  const [newBranchName, setNewBranchName] = useState("");
  const [newBranchError, setNewBranchError] = useState<string | null>(null);
  const [forkBranchName, setForkBranchName] = useState("");
  const [forkBranchError, setForkBranchError] = useState<string | null>(null);
  const [forkCommit, setForkCommit] = useState<CommitRow | null>(null);
  const [commitMessage, setCommitMessage] = useState("");
  const [commitError, setCommitError] = useState<string | null>(null);

  const projectsQuery = rpc.useQuery("projects.list", projectId ? skipToken : undefined, {
    refetchOnWindowFocus: true,
  });
  const projectQuery = rpc.useQuery("projects.get", projectId ? { projectId } : skipToken, {
    refetchOnWindowFocus: true,
  });
  const branchesQuery = rpc.useQuery("branches.list", projectId ? { projectId } : skipToken, {
    refetchOnWindowFocus: true,
  });
  const workspacesQuery = rpc.useQuery("workspaces.list", projectId ? { projectId } : skipToken, {
    refetchOnWindowFocus: true,
  });

  const project = projectQuery.data;
  const branches = branchesQuery.data ?? [];
  const workspaces = workspacesQuery.data ?? [];
  const sortedBranches = sortProjectBranches(branches, project?.defaultBranchId ?? null);
  const selectedBranchId = resolveSelectedBranchId(
    sortedBranches,
    branchId,
    project?.defaultBranchId ?? null,
  );
  const selectedBranch = sortedBranches.find((item) => item.id === selectedBranchId) ?? null;
  const commitHistoryQuery = rpc.useQuery(
    "commits.history",
    selectedBranchId ? { branchId: selectedBranchId } : skipToken,
    {
      refetchOnWindowFocus: true,
    },
  );
  const commitHistory = commitHistoryQuery.data ?? [];

  const workspaceMap = new Map(workspaces.map((workspace) => [workspace.branchId, workspace]));
  const selectedWorkspace = selectedBranch ? (workspaceMap.get(selectedBranch.id) ?? null) : null;
  const defaultWorkspace =
    project?.defaultBranchId != null ? (workspaceMap.get(project.defaultBranchId) ?? null) : null;

  const createProject = rpc.useMutation<"projects.create", ProjectMutationContext>(
    "projects.create",
    {
      onMutate: (input) => {
        const previousProjects = rpc.getQueryData("projects.list", undefined);
        if (previousProjects) {
          const timestamp = Date.now();
          rpc.setQueryData(
            "projects.list",
            undefined,
            insertProjectOptimistically(previousProjects, {
              id: input.id,
              name: input.name,
              description: input.description ?? null,
              defaultBranchId: null,
              createdAt: timestamp,
              updatedAt: timestamp,
            }),
          );
        }
        return { previousProjects };
      },
      onError: (_, __, context) => {
        if (context?.previousProjects) {
          rpc.setQueryData("projects.list", undefined, context.previousProjects);
        }
      },
    },
  );
  const updateProject = rpc.useMutation<"projects.update", ProjectMutationContext>(
    "projects.update",
    {
      onMutate: (input) => {
        const previousProjects = rpc.getQueryData("projects.list", undefined);
        if (previousProjects) {
          rpc.setQueryData(
            "projects.list",
            undefined,
            updateProjectOptimistically(previousProjects, {
              id: input.id,
              name: input.name,
              description: input.description ?? null,
            }),
          );
        }
        return { previousProjects };
      },
      onError: (_, __, context) => {
        if (context?.previousProjects) {
          rpc.setQueryData("projects.list", undefined, context.previousProjects);
        }
      },
    },
  );
  const deleteProject = rpc.useMutation<"projects.delete", ProjectMutationContext>(
    "projects.delete",
    {
      onMutate: (input) => {
        const previousProjects = rpc.getQueryData("projects.list", undefined);
        if (previousProjects) {
          rpc.setQueryData(
            "projects.list",
            undefined,
            removeProjectOptimistically(previousProjects, input.id),
          );
        }
        return { previousProjects };
      },
      onError: (_, __, context) => {
        if (context?.previousProjects) {
          rpc.setQueryData("projects.list", undefined, context.previousProjects);
        }
      },
    },
  );
  const setDefaultBranch = rpc.useMutation("projects.setDefaultBranch");
  const createBranchWithWorkspace = rpc.useMutation("branches.createWithWorkspace");
  const deleteBranch = rpc.useMutation("branches.delete");
  const createCommit = rpc.useMutation("commits.create");

  const projectList = [...(projectsQuery.data ?? [])].sort((a, b) => b.updatedAt - a.updatedAt);
  const defaultBranch = project
    ? (sortedBranches.find((item) => item.id === project.defaultBranchId) ?? null)
    : null;

  useEffect(() => {
    if (!project) {
      setDetailName("");
      setDetailDescription("");
      setDetailError(null);
      return;
    }

    setDetailName(project.name);
    setDetailDescription(project.description ?? "");
    setDetailError(null);
  }, [project]);

  useEffect(() => {
    setCommitMessage("");
    setCommitError(null);
  }, [selectedBranchId]);

  const openCreateProjectDialog = () => {
    setFormError(null);
    if (!createProjectDialogRef.current?.open) {
      createProjectDialogRef.current?.showModal();
    }
  };

  const closeCreateProjectDialog = () => {
    createProjectDialogRef.current?.close();
    setName("");
    setDescription("");
    setFormError(null);
  };

  const openCreateBranchDialog = () => {
    setNewBranchName("");
    setNewBranchError(null);
    if (!createBranchDialogRef.current?.open) {
      createBranchDialogRef.current?.showModal();
    }
  };

  const closeCreateBranchDialog = () => {
    createBranchDialogRef.current?.close();
    setNewBranchName("");
    setNewBranchError(null);
  };

  const openForkDialog = (commit: CommitRow) => {
    setForkCommit(commit);
    setForkBranchName("");
    setForkBranchError(null);
    if (!forkBranchDialogRef.current?.open) {
      forkBranchDialogRef.current?.showModal();
    }
  };

  const closeForkDialog = () => {
    forkBranchDialogRef.current?.close();
    setForkCommit(null);
    setForkBranchName("");
    setForkBranchError(null);
  };

  const handleCreateProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();

    if (!trimmedName) {
      setFormError("项目名不能为空。");
      return;
    }

    try {
      const id = createProjectId();
      await createProject.mutate({
        id,
        name: trimmedName,
        description: trimmedDescription || null,
      });
      closeCreateProjectDialog();
      navigate(`/project/${id}`);
    } catch (mutationError) {
      setFormError(
        mutationError instanceof Error ? mutationError.message : "创建项目失败，请稍后重试。",
      );
    }
  };

  const handleDeleteProject = async (id: string, projectName: string) => {
    if (!confirm(`确认删除项目“${projectName}”吗？`)) {
      return;
    }

    try {
      setDeletingId(id);
      await deleteProject.mutate({ id });
      setLastProjectId((current) => (current === id ? null : current));
      setLastWorkspaceRoute((current) => (current?.projectId === id ? null : current));
      if (projectId === id) {
        navigate("/");
      }
    } finally {
      setDeletingId(null);
    }
  };

  const commitProjectMetadata = async () => {
    if (!project) {
      return;
    }

    const trimmedName = detailName.trim();
    const trimmedDescription = detailDescription.trim();
    const currentDescription = project.description ?? "";

    if (!trimmedName) {
      setDetailError("项目名不能为空。");
      setDetailName(project.name);
      setDetailDescription(currentDescription);
      return;
    }

    if (trimmedName === project.name && trimmedDescription === currentDescription) {
      setDetailError(null);
      if (detailName !== trimmedName) {
        setDetailName(trimmedName);
      }
      if (detailDescription !== trimmedDescription) {
        setDetailDescription(trimmedDescription);
      }
      return;
    }

    try {
      setDetailError(null);
      await updateProject.mutate({
        id: project.id,
        name: trimmedName,
        description: trimmedDescription || null,
      });
      setDetailName(trimmedName);
      setDetailDescription(trimmedDescription);
    } catch (mutationError) {
      setDetailError(
        mutationError instanceof Error ? mutationError.message : "更新项目失败，请稍后重试。",
      );
      setDetailName(project.name);
      setDetailDescription(currentDescription);
    }
  };

  const handleCreateBranch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!project) {
      return;
    }

    const trimmedName = newBranchName.trim();
    if (!trimmedName) {
      setNewBranchError("分支名称不能为空。");
      return;
    }

    try {
      const sourceCommitId = resolveNewBranchSourceCommitId(branches, project.defaultBranchId);
      const workspace = await createBranchWithWorkspace.mutate({
        projectId: project.id,
        name: trimmedName,
        fromCommitId: sourceCommitId,
      });
      closeCreateBranchDialog();
      navigate(`/project/${project.id}/branches/${workspace.branchId}`);
    } catch (mutationError) {
      setNewBranchError(
        mutationError instanceof Error ? mutationError.message : "创建分支失败，请稍后重试。",
      );
    }
  };

  const handleForkBranch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!project || !forkCommit) {
      return;
    }

    const trimmedName = forkBranchName.trim();
    if (!trimmedName) {
      setForkBranchError("分支名称不能为空。");
      return;
    }

    try {
      const workspace = await createBranchWithWorkspace.mutate({
        projectId: project.id,
        name: trimmedName,
        fromCommitId: forkCommit.id,
      });
      closeForkDialog();
      navigate(`/project/${project.id}/branches/${workspace.branchId}`);
    } catch (mutationError) {
      setForkBranchError(
        mutationError instanceof Error ? mutationError.message : "Fork 分支失败，请稍后重试。",
      );
    }
  };

  const handleCommit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedBranch || !selectedWorkspace) {
      return;
    }

    const trimmedMessage = commitMessage.trim();
    if (!trimmedMessage) {
      setCommitError("提交信息不能为空。");
      return;
    }

    try {
      setCommitError(null);
      await createCommit.mutate({
        branchId: selectedBranch.id,
        message: trimmedMessage,
      });
      setCommitMessage("");
    } catch (mutationError) {
      setCommitError(
        mutationError instanceof Error ? mutationError.message : "提交失败，请稍后重试。",
      );
    }
  };

  const handleDeleteBranch = async (branch: BranchRow) => {
    if (!project) {
      return;
    }

    if (!confirm(`确认删除分支“${branch.name}”吗？这会连带删除它绑定的 workspace。`)) {
      return;
    }

    await deleteBranch.mutate({
      projectId: project.id,
      branchId: branch.id,
    });

    navigate("/project/" + project.id + "/branches");
  };

  const handleSetDefaultBranch = async (branch: BranchRow) => {
    if (!project || project.defaultBranchId === branch.id) {
      return;
    }

    await setDefaultBranch.mutate({
      projectId: project.id,
      branchId: branch.id,
    });
  };

  const renderListError = projectsQuery.error ? (
    <InlineError message={projectsQuery.error.message} />
  ) : null;

  return (
    <>
      <AppShell
        active="home"
        sidebar={
          projectId ? (
            <ProjectCockpitSidebar
              projectName={project?.name ?? "项目驾驶舱"}
              section={section}
              onOpenOverview={() => navigate(`/project/${projectId}`)}
              onOpenBranches={() => navigate(`/project/${projectId}/branches`)}
            />
          ) : undefined
        }
      >
        {!projectId ? (
          <ProjectListView
            projectList={projectList}
            lastProjectId={lastProjectId}
            isLoading={projectsQuery.isInitialLoading}
            isDeleting={deleteProject.isPending}
            deletingId={deletingId}
            renderError={renderListError}
            onCreateProject={openCreateProjectDialog}
            onOpenProject={(nextProjectId) => navigate(`/project/${nextProjectId}`)}
            onDeleteProject={handleDeleteProject}
          />
        ) : projectQuery.isInitialLoading && !project ? (
          <FullPageMessage
            icon="icon-[material-symbols--sync] animate-spin"
            title="正在加载项目驾驶舱"
            description="正在读取项目、分支和工作副本。"
            embedded
          />
        ) : projectQuery.error ? (
          <FullPageMessage
            icon="icon-[material-symbols--folder-off]"
            title="未找到项目"
            description={projectQuery.error.message}
            embedded
          />
        ) : project ? (
          <ProjectCockpitView
            project={project}
            section={section}
            detailName={detailName}
            detailDescription={detailDescription}
            detailError={detailError ?? updateProject.error?.message ?? null}
            isSaving={updateProject.isPending}
            branches={sortedBranches}
            branchesLoading={branchesQuery.isInitialLoading && sortedBranches.length === 0}
            branchesError={branchesQuery.error?.message ?? null}
            selectedBranch={selectedBranch}
            selectedWorkspace={selectedWorkspace}
            commitHistory={commitHistory}
            commitHistoryLoading={commitHistoryQuery.isInitialLoading && commitHistory.length === 0}
            commitHistoryError={commitHistoryQuery.error?.message ?? null}
            commitMessage={commitMessage}
            commitError={commitError ?? createCommit.error?.message ?? null}
            isCommitting={createCommit.isPending}
            defaultBranch={defaultBranch}
            defaultWorkspace={defaultWorkspace}
            isSettingDefault={setDefaultBranch.isPending}
            isDeletingBranch={deleteBranch.isPending}
            onClose={() => navigate("/")}
            onNameChange={setDetailName}
            onDescriptionChange={setDetailDescription}
            onMetadataCommit={() => void commitProjectMetadata()}
            onOpenBranches={() => navigate(`/project/${project.id}/branches`)}
            onOpenBranch={(nextBranchId) =>
              navigate(`/project/${project.id}/branches/${nextBranchId}`)
            }
            onOpenWorkspace={(workspaceId) =>
              navigate(`/project/${project.id}/workspace/${workspaceId}`)
            }
            onCreateBranch={openCreateBranchDialog}
            onSetDefaultBranch={handleSetDefaultBranch}
            onDeleteBranch={() =>
              selectedBranch ? void handleDeleteBranch(selectedBranch) : undefined
            }
            onOpenFork={openForkDialog}
            onCommitMessageChange={setCommitMessage}
            onSubmitCommit={(event) => void handleCommit(event)}
          />
        ) : (
          <FullPageMessage
            icon="icon-[material-symbols--folder-off]"
            title="未找到项目"
            description="这个项目可能已被删除，或当前链接中的项目 ID 无效。"
            embedded
          />
        )}
      </AppShell>

      <ProjectDialog
        dialogRef={createProjectDialogRef}
        title="新建项目"
        icon="icon-[material-symbols--add-circle-outline]"
        onClose={closeCreateProjectDialog}
        onSubmit={handleCreateProject}
        error={formError ?? createProject.error?.message ?? null}
        isPending={createProject.isPending}
        pendingLabel="创建中"
        submitLabel="创建"
      >
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-foreground-muted">项目名</span>
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例如：雾港编年史"
            className="w-full rounded-md border border-border bg-editor-background px-3 py-1.5 text-sm text-foreground transition outline-none placeholder:text-foreground-muted/50 focus:border-accent-foreground"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-foreground-muted">描述</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            placeholder="可选"
            className="w-full resize-none rounded-md border border-border bg-editor-background px-3 py-1.5 text-sm leading-relaxed text-foreground transition outline-none placeholder:text-foreground-muted/50 focus:border-accent-foreground"
          />
        </label>
      </ProjectDialog>

      <ProjectDialog
        dialogRef={createBranchDialogRef}
        title="新建分支"
        icon="icon-[material-symbols--account-tree]"
        onClose={closeCreateBranchDialog}
        onSubmit={handleCreateBranch}
        error={newBranchError ?? createBranchWithWorkspace.error?.message ?? null}
        isPending={createBranchWithWorkspace.isPending}
        pendingLabel="创建中"
        submitLabel="创建分支"
      >
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-foreground-muted">分支名</span>
          <input
            autoFocus
            value={newBranchName}
            onChange={(event) => setNewBranchName(event.target.value)}
            placeholder="例如：feature-outline"
            className="w-full rounded-md border border-border bg-editor-background px-3 py-1.5 text-sm text-foreground transition outline-none placeholder:text-foreground-muted/50 focus:border-accent-foreground"
          />
        </label>
      </ProjectDialog>

      <ProjectDialog
        dialogRef={forkBranchDialogRef}
        title="Fork 分支"
        icon="icon-[material-symbols--fork-right]"
        onClose={closeForkDialog}
        onSubmit={handleForkBranch}
        error={forkBranchError ?? createBranchWithWorkspace.error?.message ?? null}
        isPending={createBranchWithWorkspace.isPending}
        pendingLabel="Fork 中"
        submitLabel="创建 Fork"
      >
        <div className="rounded-md border border-border bg-editor-background px-3 py-2 text-xs text-foreground-muted">
          来源提交：{forkCommit ? `${forkCommit.message} · ${shortId(forkCommit.id)}` : "—"}
        </div>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-foreground-muted">分支名</span>
          <input
            autoFocus
            value={forkBranchName}
            onChange={(event) => setForkBranchName(event.target.value)}
            placeholder="例如：fork-alt-ending"
            className="w-full rounded-md border border-border bg-editor-background px-3 py-1.5 text-sm text-foreground transition outline-none placeholder:text-foreground-muted/50 focus:border-accent-foreground"
          />
        </label>
      </ProjectDialog>
    </>
  );
}

function ProjectListView({
  projectList,
  lastProjectId,
  isLoading,
  isDeleting,
  deletingId,
  renderError,
  onCreateProject,
  onOpenProject,
  onDeleteProject,
}: {
  projectList: ProjectList;
  lastProjectId: string | null;
  isLoading: boolean;
  isDeleting: boolean;
  deletingId: string | null;
  renderError: React.ReactNode;
  onCreateProject: () => void;
  onOpenProject: (_projectId: string) => void;
  onDeleteProject: (_projectId: string, _projectName: string) => void;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        icon="icon-[material-symbols--folder]"
        title="项目"
        subtitle={`${projectList.length} 个项目`}
      />

      <div className="flex-1 overflow-y-auto p-6">
        {renderError}

        {isLoading ? (
          <LoadingBlock />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
            <button
              type="button"
              onClick={onCreateProject}
              className="group flex min-h-36 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-sidebar-background p-4 text-foreground-muted transition hover:border-accent-foreground hover:bg-list-hover-background hover:text-foreground"
            >
              <span className="icon-[material-symbols--add-circle-outline] text-3xl text-accent-foreground transition group-hover:scale-105" />
              <span className="text-sm font-medium">新建项目</span>
            </button>

            {projectList.map((project) => {
              const isLastViewed = project.id === lastProjectId;

              return (
                <div
                  key={project.id}
                  className={cn(
                    "group relative flex min-h-36 flex-col rounded-md border p-4 transition",
                    isLastViewed
                      ? "border-accent-foreground/40 bg-list-active-background"
                      : "border-border bg-sidebar-background hover:bg-list-hover-background",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onOpenProject(project.id)}
                    className="flex min-h-0 flex-1 flex-col items-start gap-2 text-left"
                  >
                    <div className="flex w-full items-center gap-2">
                      <span className="icon-[material-symbols--folder] text-2xl text-icon-folder" />
                      {isLastViewed ? (
                        <span className="rounded px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground">
                          上次查看
                        </span>
                      ) : null}
                    </div>
                    <span className="line-clamp-2 text-sm font-medium text-foreground">
                      {project.name}
                    </span>
                    <p className="line-clamp-2 flex-1 text-xs leading-relaxed text-foreground-muted">
                      {project.description?.trim() || "暂无描述"}
                    </p>
                    <span className="text-[11px] text-foreground-muted">
                      {dateFormatter.format(project.updatedAt)}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteProject(project.id, project.name)}
                    disabled={isDeleting && deletingId === project.id}
                    className="absolute top-2 right-2 rounded p-1 text-foreground-muted opacity-0 transition group-hover:opacity-100 hover:bg-button-hover-background hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                    title="删除项目"
                  >
                    <span className="icon-[material-symbols--delete] text-base leading-none" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectCockpitSidebar({
  projectName,
  section,
  onOpenOverview,
  onOpenBranches,
}: {
  projectName: string;
  section: "overview" | "branches";
  onOpenOverview: () => void;
  onOpenBranches: () => void;
}) {
  return (
    <AppSidebar>
      <div className="border-b border-border px-3 py-3">
        <div className="text-[11px] font-semibold tracking-wider text-foreground-muted uppercase">
          项目驾驶舱
        </div>
        <div className="mt-1 truncate text-sm font-medium text-foreground">{projectName}</div>
      </div>

      <div className="py-2">
        <SidebarListRow
          isActive={section === "overview"}
          onClick={onOpenOverview}
          icon={
            <span className="icon-[material-symbols--dashboard] text-base text-foreground-muted" />
          }
          label="Overview"
        />
        <SidebarListRow
          isActive={section === "branches"}
          onClick={onOpenBranches}
          icon={
            <span className="icon-[material-symbols--account-tree] text-base text-foreground-muted" />
          }
          label="Branches"
        />
      </div>
    </AppSidebar>
  );
}

function ProjectCockpitView({
  project,
  section,
  detailName,
  detailDescription,
  detailError,
  isSaving,
  branches,
  branchesLoading,
  branchesError,
  selectedBranch,
  selectedWorkspace,
  commitHistory,
  commitHistoryLoading,
  commitHistoryError,
  commitMessage,
  commitError,
  isCommitting,
  defaultBranch,
  defaultWorkspace,
  isSettingDefault,
  isDeletingBranch,
  onClose,
  onNameChange,
  onDescriptionChange,
  onMetadataCommit,
  onOpenBranches,
  onOpenBranch,
  onOpenWorkspace,
  onCreateBranch,
  onSetDefaultBranch,
  onDeleteBranch,
  onOpenFork,
  onCommitMessageChange,
  onSubmitCommit,
}: {
  project: ProjectRow;
  section: "overview" | "branches";
  detailName: string;
  detailDescription: string;
  detailError: string | null;
  isSaving: boolean;
  branches: BranchList;
  branchesLoading: boolean;
  branchesError: string | null;
  selectedBranch: BranchRow | null;
  selectedWorkspace: WorkspaceRow | null;
  commitHistory: CommitHistory;
  commitHistoryLoading: boolean;
  commitHistoryError: string | null;
  commitMessage: string;
  commitError: string | null;
  isCommitting: boolean;
  defaultBranch: BranchRow | null;
  defaultWorkspace: WorkspaceRow | null;
  isSettingDefault: boolean;
  isDeletingBranch: boolean;
  onClose: () => void;
  onNameChange: (_value: string) => void;
  onDescriptionChange: (_value: string) => void;
  onMetadataCommit: () => void;
  onOpenBranches: () => void;
  onOpenBranch: (_branchId: string) => void;
  onOpenWorkspace: (_workspaceId: string) => void;
  onCreateBranch: () => void;
  onSetDefaultBranch: (_branch: BranchRow) => void;
  onDeleteBranch: () => void;
  onOpenFork: (_commit: CommitRow) => void;
  onCommitMessageChange: (_value: string) => void;
  onSubmitCommit: (_event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        icon="icon-[material-symbols--folder-open]"
        title={project.name}
        subtitle={section === "overview" ? "Overview" : "Branches"}
        trailing={
          <button type="button" onClick={onClose} className={secondaryButton}>
            <span className="icon-[material-symbols--close] text-sm" />
            关闭项目
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {section === "overview" ? (
          <OverviewSection
            project={project}
            detailName={detailName}
            detailDescription={detailDescription}
            detailError={detailError}
            isSaving={isSaving}
            defaultBranch={defaultBranch}
            defaultWorkspace={defaultWorkspace}
            branchCount={branches.length}
            onNameChange={onNameChange}
            onDescriptionChange={onDescriptionChange}
            onMetadataCommit={onMetadataCommit}
            onOpenBranches={onOpenBranches}
            onOpenWorkspace={(workspaceId) => onOpenWorkspace(workspaceId)}
          />
        ) : (
          <BranchesSection
            project={project}
            branches={branches}
            branchesLoading={branchesLoading}
            branchesError={branchesError}
            selectedBranch={selectedBranch}
            selectedWorkspace={selectedWorkspace}
            commitHistory={commitHistory}
            commitHistoryLoading={commitHistoryLoading}
            commitHistoryError={commitHistoryError}
            commitMessage={commitMessage}
            commitError={commitError}
            isCommitting={isCommitting}
            isSettingDefault={isSettingDefault}
            isDeletingBranch={isDeletingBranch}
            onOpenBranch={onOpenBranch}
            onCreateBranch={onCreateBranch}
            onSetDefaultBranch={onSetDefaultBranch}
            onDeleteBranch={onDeleteBranch}
            onOpenWorkspace={onOpenWorkspace}
            onOpenFork={onOpenFork}
            onCommitMessageChange={onCommitMessageChange}
            onSubmitCommit={onSubmitCommit}
          />
        )}
      </div>
    </div>
  );
}

function OverviewSection({
  project,
  detailName,
  detailDescription,
  detailError,
  isSaving,
  defaultBranch,
  defaultWorkspace,
  branchCount,
  onNameChange,
  onDescriptionChange,
  onMetadataCommit,
  onOpenBranches,
  onOpenWorkspace,
}: {
  project: ProjectRow;
  detailName: string;
  detailDescription: string;
  detailError: string | null;
  isSaving: boolean;
  defaultBranch: BranchRow | null;
  defaultWorkspace: WorkspaceRow | null;
  branchCount: number;
  onNameChange: (_value: string) => void;
  onDescriptionChange: (_value: string) => void;
  onMetadataCommit: () => void;
  onOpenBranches: () => void;
  onOpenWorkspace: (_workspaceId: string) => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <section className="rounded-xl border border-border bg-sidebar-background p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="icon-[material-symbols--info] text-base text-accent-foreground" />
          <h2 className="text-sm font-semibold text-foreground">基础信息</h2>
          {isSaving ? (
            <span className="ml-auto inline-flex items-center gap-1 text-xs text-foreground-muted">
              <span className="icon-[material-symbols--sync] animate-spin text-sm" />
              保存中
            </span>
          ) : (
            <span className="ml-auto text-xs text-foreground-muted">失焦或回车保存</span>
          )}
        </div>

        <div className="mt-4 grid gap-4">
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-foreground-muted">项目名</span>
            <input
              value={detailName}
              disabled={isSaving}
              onChange={(event) => onNameChange(event.target.value)}
              onBlur={onMetadataCommit}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.currentTarget.blur();
                }
              }}
              className="w-full rounded-md border border-border bg-editor-background px-3 py-2 text-sm text-foreground transition outline-none focus:border-accent-foreground disabled:cursor-wait disabled:opacity-70"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-foreground-muted">描述</span>
            <textarea
              value={detailDescription}
              disabled={isSaving}
              rows={4}
              onChange={(event) => onDescriptionChange(event.target.value)}
              onBlur={onMetadataCommit}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.blur();
                }
              }}
              className="w-full resize-y rounded-md border border-border bg-editor-background px-3 py-2 text-sm leading-relaxed text-foreground transition outline-none focus:border-accent-foreground disabled:cursor-wait disabled:opacity-70"
              placeholder="为这个项目补充背景、目标或当前进度。"
            />
            <span className="text-[11px] text-foreground-muted">
              `Enter` 保存，`Shift+Enter` 换行。
            </span>
          </label>

          {detailError ? <InlineError message={detailError} /> : null}

          <div className="text-xs text-foreground-muted">
            上次更新于 {dateFormatter.format(project.updatedAt)}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="rounded-xl border border-border bg-sidebar-background p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="icon-[material-symbols--target] text-base text-accent-foreground" />
            <h2 className="text-sm font-semibold text-foreground">默认分支</h2>
          </div>

          <div className="mt-4 flex flex-col gap-4">
            {defaultBranch ? (
              <>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {defaultBranch.name}
                    </span>
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground">
                      默认
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-foreground-muted">
                    {defaultBranch.headCommitId
                      ? `HEAD ${shortId(defaultBranch.headCommitId)}`
                      : "还没有提交历史"}
                  </div>
                </div>

                {defaultWorkspace ? (
                  <button
                    type="button"
                    onClick={() => onOpenWorkspace(defaultWorkspace.id)}
                    className={primaryButton}
                  >
                    <span className="icon-[material-symbols--edit] text-base" />
                    打开默认分支工作区
                  </button>
                ) : (
                  <div className="rounded-md border border-dashed border-border bg-editor-background px-3 py-3 text-sm text-foreground-muted">
                    默认分支当前没有对应 workspace，只能先在 Branches 里只读查看。
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-md border border-dashed border-border bg-editor-background px-3 py-3 text-sm text-foreground-muted">
                当前项目还没有默认分支。
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-sidebar-background p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="icon-[material-symbols--account-tree] text-base text-accent-foreground" />
            <h2 className="text-sm font-semibold text-foreground">仓库摘要</h2>
          </div>

          <div className="mt-4 grid gap-4">
            <SummaryMetric label="Branch 数量" value={String(branchCount)} />
            <SummaryMetric
              label="默认分支来源"
              value={
                defaultBranch?.forkedFromCommitId ? shortId(defaultBranch.forkedFromCommitId) : "—"
              }
            />
            <button type="button" onClick={onOpenBranches} className={secondaryButton}>
              <span className="icon-[material-symbols--arrow-forward] text-base" />
              进入 Branches
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function BranchesSection({
  project,
  branches,
  branchesLoading,
  branchesError,
  selectedBranch,
  selectedWorkspace,
  commitHistory,
  commitHistoryLoading,
  commitHistoryError,
  commitMessage,
  commitError,
  isCommitting,
  isSettingDefault,
  isDeletingBranch,
  onOpenBranch,
  onCreateBranch,
  onSetDefaultBranch,
  onDeleteBranch,
  onOpenWorkspace,
  onOpenFork,
  onCommitMessageChange,
  onSubmitCommit,
}: {
  project: ProjectRow;
  branches: BranchList;
  branchesLoading: boolean;
  branchesError: string | null;
  selectedBranch: BranchRow | null;
  selectedWorkspace: WorkspaceRow | null;
  commitHistory: CommitHistory;
  commitHistoryLoading: boolean;
  commitHistoryError: string | null;
  commitMessage: string;
  commitError: string | null;
  isCommitting: boolean;
  isSettingDefault: boolean;
  isDeletingBranch: boolean;
  onOpenBranch: (_branchId: string) => void;
  onCreateBranch: () => void;
  onSetDefaultBranch: (_branch: BranchRow) => void;
  onDeleteBranch: () => void;
  onOpenWorkspace: (_workspaceId: string) => void;
  onOpenFork: (_commit: CommitRow) => void;
  onCommitMessageChange: (_value: string) => void;
  onSubmitCommit: (_event: FormEvent<HTMLFormElement>) => void;
}) {
  const workspaceMissing = selectedBranch != null && selectedWorkspace == null;

  return (
    <div className="grid min-h-full gap-6 xl:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]">
      <section className="rounded-xl border border-border bg-sidebar-background p-4 shadow-sm">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <span className="icon-[material-symbols--account-tree] text-base text-accent-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Branches</h2>
          <span className="ml-auto text-xs text-foreground-muted">{branches.length} 个分支</span>
        </div>

        <div className="mt-4 flex min-h-0 flex-col gap-3">
          <button type="button" onClick={onCreateBranch} className={primaryButton}>
            <span className="icon-[material-symbols--add] text-base" />
            新建分支
          </button>

          {branchesError ? (
            <InlineError message={branchesError} />
          ) : branchesLoading ? (
            <LoadingBlock label="正在加载分支..." />
          ) : branches.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-editor-background px-4 py-10 text-sm text-foreground-muted">
              当前项目还没有 branch，先创建一个分支开始工作。
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-editor-background">
              {branches.map((branch) => (
                <SidebarListRow
                  key={branch.id}
                  isActive={branch.id === selectedBranch?.id}
                  onClick={() => onOpenBranch(branch.id)}
                  icon={
                    <span className="icon-[material-symbols--fork-right] text-base text-foreground-muted" />
                  }
                  label={
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate">{branch.name}</span>
                      {project.defaultBranchId === branch.id ? (
                        <span className="rounded px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground">
                          默认
                        </span>
                      ) : null}
                    </div>
                  }
                  trailing={branch.headCommitId ? shortId(branch.headCommitId) : "空分支"}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-sidebar-background p-5 shadow-sm">
        {!selectedBranch ? (
          <FullPageMessage
            icon="icon-[material-symbols--account-tree]"
            title="还没有选中的分支"
            description="从左侧选择一个 branch，或先创建新的 branch。"
            embedded
          />
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-start gap-3 border-b border-border pb-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-lg font-semibold text-foreground">
                    {selectedBranch.name}
                  </h2>
                  {project.defaultBranchId === selectedBranch.id ? (
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground">
                      默认分支
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-foreground-muted">
                  <span>更新时间 {dateFormatter.format(selectedBranch.updatedAt)}</span>
                  <span>
                    HEAD {selectedBranch.headCommitId ? shortId(selectedBranch.headCommitId) : "—"}
                  </span>
                  <span>
                    Fork 自{" "}
                    {selectedBranch.forkedFromCommitId
                      ? shortId(selectedBranch.forkedFromCommitId)
                      : "空分支"}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {selectedWorkspace ? (
                  <button
                    type="button"
                    onClick={() => onOpenWorkspace(selectedWorkspace.id)}
                    className={primaryButton}
                  >
                    <span className="icon-[material-symbols--edit] text-base" />
                    打开 workspace
                  </button>
                ) : (
                  <button type="button" disabled className={primaryButton}>
                    <span className="icon-[material-symbols--warning] text-base" />无 workspace
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onSetDefaultBranch(selectedBranch)}
                  disabled={project.defaultBranchId === selectedBranch.id || isSettingDefault}
                  className={secondaryButton}
                >
                  <span className="icon-[material-symbols--target] text-base" />
                  设为默认
                </button>
                <button
                  type="button"
                  onClick={onDeleteBranch}
                  disabled={project.defaultBranchId === selectedBranch.id || isDeletingBranch}
                  className={cn(
                    secondaryButton,
                    "text-accent-foreground hover:bg-red-500/10 hover:text-red-200",
                  )}
                >
                  <span className="icon-[material-symbols--delete] text-base" />
                  删除分支
                </button>
              </div>
            </div>

            {workspaceMissing ? (
              <div className="rounded-md border border-border bg-editor-background px-4 py-3 text-sm text-accent-foreground">
                该分支当前没有对应 workspace，只支持只读查看历史，不能打开编辑器或直接提交。
              </div>
            ) : null}

            <section className="rounded-lg border border-border bg-editor-background p-4">
              <div className="flex items-center gap-2">
                <span className="icon-[material-symbols--upload] text-base text-accent-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Commit</h3>
              </div>

              <form className="mt-4 grid gap-3" onSubmit={onSubmitCommit}>
                <textarea
                  value={commitMessage}
                  onChange={(event) => onCommitMessageChange(event.target.value)}
                  rows={3}
                  disabled={workspaceMissing || isCommitting}
                  placeholder="描述这次提交做了什么。"
                  className="w-full resize-y rounded-md border border-border bg-sidebar-background px-3 py-2 text-sm leading-relaxed text-foreground transition outline-none focus:border-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
                />
                {commitError ? <InlineError message={commitError} /> : null}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={workspaceMissing || isCommitting}
                    className={primaryButton}
                  >
                    <span
                      className={cn(
                        "text-base",
                        isCommitting
                          ? "icon-[material-symbols--sync] animate-spin"
                          : "icon-[material-symbols--check-circle]",
                      )}
                    />
                    提交到当前分支
                  </button>
                </div>
              </form>
            </section>

            <section className="rounded-lg border border-border bg-editor-background p-4">
              <div className="flex items-center gap-2">
                <span className="icon-[material-symbols--history] text-base text-accent-foreground" />
                <h3 className="text-sm font-semibold text-foreground">提交历史</h3>
              </div>

              <div className="mt-4">
                {commitHistoryError ? (
                  <InlineError message={commitHistoryError} />
                ) : commitHistoryLoading ? (
                  <LoadingBlock label="正在加载提交历史..." />
                ) : commitHistory.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border bg-sidebar-background px-4 py-8 text-sm text-foreground-muted">
                    这个分支还没有提交历史。
                  </div>
                ) : (
                  <div className="space-y-3">
                    {commitHistory.map((commit) => (
                      <article
                        key={commit.id}
                        className="rounded-lg border border-border bg-sidebar-background px-4 py-3"
                      >
                        <div className="flex flex-wrap items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="font-medium text-foreground">{commit.message}</div>
                              {commit.id === selectedBranch.headCommitId ? (
                                <span className="rounded px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground">
                                  HEAD
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-3 text-xs text-foreground-muted">
                              <span>{shortId(commit.id)}</span>
                              <span>{dateFormatter.format(commit.committedAt)}</span>
                              <span>父提交 {commit.parents.length}</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => onOpenFork(commit)}
                            className={secondaryButton}
                          >
                            <span className="icon-[material-symbols--fork-right] text-base" />
                            Fork
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </section>
    </div>
  );
}

function ProjectDialog({
  dialogRef,
  title,
  icon,
  onClose,
  onSubmit,
  error,
  isPending,
  pendingLabel,
  submitLabel,
  children,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  title: string;
  icon: string;
  onClose: () => void;
  onSubmit: (_event: FormEvent<HTMLFormElement>) => void;
  error: string | null;
  isPending: boolean;
  pendingLabel: string;
  submitLabel: string;
  children: React.ReactNode;
}) {
  return (
    <dialog
      ref={dialogRef}
      className="w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-border bg-sidebar-background p-0 text-foreground shadow-lg backdrop:bg-black/50"
    >
      <form onSubmit={onSubmit}>
        <div className="flex items-center gap-2 border-b border-border px-4 py-2">
          <span className={cn(icon, "text-base text-accent-foreground")} />
          <span className="text-sm font-medium">{title}</span>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded p-0.5 text-foreground-muted transition hover:bg-button-hover-background hover:text-foreground"
          >
            <span className="icon-[material-symbols--close] text-base leading-none" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          {children}

          {error ? <InlineError message={error} /> : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          <button type="button" onClick={onClose} className={secondaryButton}>
            取消
          </button>
          <button type="submit" disabled={isPending} className={primaryButton}>
            {isPending ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="icon-[material-symbols--sync] animate-spin text-base" />
                {pendingLabel}
              </span>
            ) : (
              submitLabel
            )}
          </button>
        </div>
      </form>
    </dialog>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-editor-background px-3 py-2 text-sm text-accent-foreground">
      <span className="icon-[material-symbols--warning] shrink-0 text-base" />
      {message}
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] tracking-wide text-foreground-muted/70 uppercase">{label}</div>
      <div className="mt-1 text-sm text-foreground">{value}</div>
    </div>
  );
}

function PageHeader({
  icon,
  title,
  subtitle,
  trailing,
}: {
  icon: string;
  title: string;
  subtitle: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-border bg-title-bar-background px-4 py-2">
      <span className={`${icon} text-xl text-icon-folder`} />
      <div className="min-w-0">
        <h1 className="text-[14px] font-semibold text-foreground">{title}</h1>
        <p className="text-[11px] text-foreground-muted">{subtitle}</p>
      </div>
      {trailing ? <div className="ml-auto">{trailing}</div> : null}
    </div>
  );
}

function shortId(id: string) {
  return id.length > 16 ? `${id.slice(0, 16)}…` : id;
}
