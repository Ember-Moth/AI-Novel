import { skipToken } from "@codehz/rpc/react";
import { ScopeProvider } from "bunshi/react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

import { AppShell } from "@/app/shell/AppShell";
import { useLastProjectStore } from "@/app/state/lastProject";
import { SidebarLayoutScope } from "@/shared/ui/sidebar";
import { rpc } from "@/rpc/client";
import { createProjectId } from "@/shared/lib/domain";
import { FullPageMessage } from "@/shared/ui/FullPageMessage";

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
import { ProjectDialog } from "./ProjectDialog";
import { ProjectListView } from "./ProjectListView";
import type { BranchRow, CommitRow, ProjectList } from "./projectTypes";
import { formatCommitId, InlineError } from "./projectUi";
import { ProjectWorkbenchMain } from "./ProjectWorkbenchMain";
import { ProjectWorkbenchSidebar } from "./ProjectWorkbenchSidebar";

type ProjectMutationContext = {
  previousProjects?: ProjectList;
};

export function ProjectsPage({ projectId = null }: { projectId?: string | null }) {
  const [, navigate] = useLocation();
  const lastProjectId = useLastProjectStore((state) => state.lastProjectId);
  const setLastProjectId = useLastProjectStore((state) => state.setLastProjectId);
  const setLastWorkspaceRoute = useLastProjectStore((state) => state.setLastWorkspaceRoute);
  const projectBranchSelection = useLastProjectStore((state) => state.projectBranchSelection);
  const setProjectBranchSelection = useLastProjectStore((state) => state.setProjectBranchSelection);

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
  const [discardError, setDiscardError] = useState<string | null>(null);

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
  const rememberedBranchId = projectId ? (projectBranchSelection[projectId] ?? null) : null;
  const selectedBranchId = resolveSelectedBranchId(
    sortedBranches,
    rememberedBranchId,
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
  const workingTreeStatusQuery = rpc.useQuery(
    "commits.workingTreeStatus",
    selectedBranchId ? { branchId: selectedBranchId } : skipToken,
    {
      refetchOnWindowFocus: true,
    },
  );
  const commitHistory = commitHistoryQuery.data ?? [];
  const workingTreeStatus = workingTreeStatusQuery.data ?? null;

  const workspaceMap = new Map(workspaces.map((workspace) => [workspace.branchId, workspace]));
  const selectedWorkspace = selectedBranch ? (workspaceMap.get(selectedBranch.id) ?? null) : null;
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
  const checkoutCommit = rpc.useMutation("commits.checkout");

  const projectList = [...(projectsQuery.data ?? [])].sort((a, b) => b.updatedAt - a.updatedAt);

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

  useEffect(() => {
    if (!projectId) {
      return;
    }

    setProjectBranchSelection((current) => {
      if ((current[projectId] ?? null) === selectedBranchId) {
        return current;
      }

      return {
        ...current,
        [projectId]: selectedBranchId,
      };
    });
  }, [projectId, selectedBranchId, setProjectBranchSelection]);

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

  const rememberSelectedBranch = (nextBranchId: string | null) => {
    if (!projectId) {
      return;
    }

    setProjectBranchSelection((current) => ({
      ...current,
      [projectId]: nextBranchId,
    }));
  };

  const forgetProjectBranch = (nextProjectId: string) => {
    setProjectBranchSelection((current) => {
      if (!(nextProjectId in current)) {
        return current;
      }

      const next = { ...current };
      delete next[nextProjectId];
      return next;
    });
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
      forgetProjectBranch(id);
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
      rememberSelectedBranch(workspace.branchId);
      closeCreateBranchDialog();
      navigate(`/project/${project.id}`);
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
      rememberSelectedBranch(workspace.branchId);
      closeForkDialog();
      navigate(`/project/${project.id}`);
    } catch (mutationError) {
      setForkBranchError(
        mutationError instanceof Error ? mutationError.message : "Fork 分支失败，请稍后重试。",
      );
    }
  };

  const handleDiscardChanges = async () => {
    if (!selectedBranch || !selectedWorkspace || !selectedBranch.headCommitId) {
      return;
    }

    if (!confirm("确认撤回全部未提交修改吗？工作区将恢复到当前 HEAD 状态，此操作不可撤销。")) {
      return;
    }

    try {
      setDiscardError(null);
      await checkoutCommit.mutate({
        workspaceId: selectedWorkspace.id,
        commitId: selectedBranch.headCommitId,
      });
    } catch (mutationError) {
      setDiscardError(
        mutationError instanceof Error ? mutationError.message : "撤回修改失败，请稍后重试。",
      );
    }
  };

  const handleCommit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedBranch || !selectedWorkspace) {
      return;
    }

    const commitBlockedByCleanTree =
      workingTreeStatus?.headCommitId != null && workingTreeStatus.hasChanges === false;
    if (commitBlockedByCleanTree) {
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

    const remainingBranches = sortedBranches.filter((item) => item.id !== branch.id);
    const nextSelectedBranchId = resolveSelectedBranchId(
      remainingBranches,
      selectedBranchId === branch.id ? null : selectedBranchId,
      project.defaultBranchId,
    );

    await deleteBranch.mutate({
      projectId: project.id,
      branchId: branch.id,
    });

    rememberSelectedBranch(nextSelectedBranchId);
    navigate(`/project/${project.id}`);
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
          projectId && project ? (
            <ScopeProvider scope={SidebarLayoutScope} value={`projects:${project.id}`}>
              <ProjectWorkbenchSidebar
                project={project}
                branches={sortedBranches}
                branchesLoading={branchesQuery.isInitialLoading && sortedBranches.length === 0}
                branchesError={branchesQuery.error?.message ?? null}
                selectedBranch={selectedBranch}
                detailName={detailName}
                detailDescription={detailDescription}
                detailError={detailError ?? updateProject.error?.message ?? null}
                isSaving={updateProject.isPending}
                onNameChange={setDetailName}
                onDescriptionChange={setDetailDescription}
                onMetadataCommit={() => void commitProjectMetadata()}
                onSelectBranch={rememberSelectedBranch}
                onCreateBranch={openCreateBranchDialog}
              />
            </ScopeProvider>
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
            title="正在加载项目工作台"
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
          <ProjectWorkbenchMain
            project={project}
            selectedBranch={selectedBranch}
            selectedWorkspace={selectedWorkspace}
            commitHistory={commitHistory}
            commitHistoryLoading={commitHistoryQuery.isInitialLoading && commitHistory.length === 0}
            commitHistoryError={commitHistoryQuery.error?.message ?? null}
            workingTreeStatus={workingTreeStatus}
            workingTreeStatusLoading={
              workingTreeStatusQuery.isInitialLoading && workingTreeStatus == null
            }
            workingTreeStatusError={workingTreeStatusQuery.error?.message ?? null}
            discardError={discardError ?? checkoutCommit.error?.message ?? null}
            commitMessage={commitMessage}
            commitError={commitError ?? createCommit.error?.message ?? null}
            isCommitting={createCommit.isPending}
            isDiscardingChanges={checkoutCommit.isPending}
            isSettingDefault={setDefaultBranch.isPending}
            isDeletingBranch={deleteBranch.isPending}
            onClose={() => navigate("/")}
            onOpenWorkspace={(workspaceId) =>
              navigate(`/project/${project.id}/workspace/${workspaceId}`)
            }
            onSetDefaultBranch={handleSetDefaultBranch}
            onDeleteBranch={() =>
              selectedBranch ? void handleDeleteBranch(selectedBranch) : undefined
            }
            onOpenFork={openForkDialog}
            onCommitMessageChange={setCommitMessage}
            onSubmitCommit={(event) => void handleCommit(event)}
            onDiscardChanges={() => void handleDiscardChanges()}
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
          来源提交：{forkCommit ? `${forkCommit.message} · ${formatCommitId(forkCommit.id)}` : "—"}
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
