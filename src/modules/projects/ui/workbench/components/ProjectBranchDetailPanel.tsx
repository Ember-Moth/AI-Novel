import { cn } from "@/shared/lib/cn";
import { FullPageMessage } from "@/shared/ui/FullPageMessage";

import { CommitHistorySection } from "./CommitHistorySection";
import { useProjectBranchAdminFeature } from "../features/useProjectBranchAdminFeature";
import { useProjectCommitFeature } from "../features/useProjectCommitFeature";
import { useForkBranchDialogControls } from "../features/useForkBranchFeature";
import {
  dateFormatter,
  formatCommitId,
  InlineError,
  primaryButton,
  secondaryButton,
} from "../../shared/projectUi";
import { useProjectCommitDraft } from "../state/projectWorkbenchStore";
import {
  useProjectWorkbenchNavigation,
  useProjectWorkbenchViewModel,
} from "../core/useProjectWorkbench";
import { WorkingTreeStatusPanel } from "./WorkingTreeStatusPanel";

export function ProjectBranchDetailPanel() {
  const model = useProjectWorkbenchViewModel();
  const { navigate } = useProjectWorkbenchNavigation();
  const { commitMessage, commitError, discardError, setCommitMessage } = useProjectCommitDraft();
  const forkBranchDialog = useForkBranchDialogControls();
  const branchAdmin = useProjectBranchAdminFeature();
  const commitFeature = useProjectCommitFeature();
  const project = model.project;
  const selectedBranch = model.selectedBranch;
  const selectedWorkspace = model.selectedWorkspace;
  const workingTreeStatus = model.workingTreeStatus;

  if (!project) {
    return null;
  }

  if (!selectedBranch) {
    return (
      <FullPageMessage
        icon="icon-[material-symbols--account-tree]"
        title="还没有可查看的分支"
        description="从左侧创建一个 branch，或等待已有 branch 加载完成。"
        embedded
      />
    );
  }

  const workspaceMissing = selectedWorkspace == null;
  const commitDisabledByCleanTree =
    workingTreeStatus?.headCommitId != null && workingTreeStatus.hasChanges === false;
  const canDiscardChanges =
    !workspaceMissing &&
    workingTreeStatus?.headCommitId != null &&
    workingTreeStatus.hasChanges === true;
  const commitDisabled =
    workspaceMissing ||
    commitFeature.isCommitting ||
    commitFeature.isDiscardingChanges ||
    commitDisabledByCleanTree;

  return (
    <div className="mx-auto grid min-h-full w-full max-w-6xl gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,28rem)]">
      <section className="overflow-hidden rounded-md border border-border bg-sidebar-background">
        <div className="p-3">
          <div className="flex flex-wrap items-start gap-2 border-b border-border pb-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-[14px] font-semibold text-foreground">
                  {selectedBranch.name}
                </h2>
                {project.defaultBranchId === selectedBranch.id ? (
                  <span className="rounded px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground">
                    默认分支
                  </span>
                ) : null}
              </div>
              <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-foreground-muted">
                <span>更新时间 {dateFormatter.format(selectedBranch.updatedAt)}</span>
                <span>
                  HEAD{" "}
                  {model.selectedBranchHeadCommitId ? (
                    <span className="font-mono">
                      {formatCommitId(model.selectedBranchHeadCommitId)}
                    </span>
                  ) : (
                    "—"
                  )}
                </span>
                <span>
                  Fork 自{" "}
                  {selectedBranch.forkedFromCommitId ? (
                    <span className="font-mono">
                      {formatCommitId(selectedBranch.forkedFromCommitId)}
                    </span>
                  ) : (
                    "空分支"
                  )}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {selectedWorkspace ? (
                <button
                  type="button"
                  onClick={() =>
                    navigate(`/project/${project.id}/workspace/${selectedWorkspace.id}`)
                  }
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
                onClick={() => void branchAdmin.handleSetDefaultBranch(selectedBranch)}
                disabled={
                  project.defaultBranchId === selectedBranch.id || branchAdmin.isSettingDefault
                }
                className={secondaryButton}
              >
                <span className="icon-[material-symbols--target] text-base" />
                设为默认
              </button>
              <button
                type="button"
                onClick={() => void branchAdmin.handleDeleteBranch(selectedBranch)}
                disabled={
                  project.defaultBranchId === selectedBranch.id || branchAdmin.isDeletingBranch
                }
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
            <div className="mt-2 rounded-md border border-border bg-editor-background px-3 py-2 text-xs text-accent-foreground">
              该分支当前没有对应 workspace，只支持只读查看历史，不能打开编辑器或直接提交。
            </div>
          ) : null}
        </div>

        <CommitHistorySection
          commitHistory={model.commitHistory}
          commitHistoryLoading={model.commitHistoryLoading}
          commitHistoryError={model.commitHistoryErrorMessage}
          selectedBranchHeadCommitId={model.selectedBranchHeadCommitId}
          onOpenFork={forkBranchDialog.openDialog}
        />
      </section>

      <section className="rounded-md border border-border bg-sidebar-background p-3">
        <div className="flex h-7 items-center gap-1 text-[11px] font-semibold tracking-wider text-foreground-muted uppercase">
          <span className="icon-[material-symbols--upload] text-base text-accent-foreground" />
          <h3>Commit</h3>
        </div>

        {!workspaceMissing ? (
          <WorkingTreeStatusPanel
            status={workingTreeStatus}
            loading={model.workingTreeStatusLoading}
            error={model.workingTreeStatusErrorMessage}
            discardError={discardError ?? commitFeature.discardErrorMessage}
            canDiscardChanges={canDiscardChanges}
            isDiscardingChanges={commitFeature.isDiscardingChanges}
            onDiscardChanges={() => void commitFeature.handleDiscardChanges()}
          />
        ) : null}

        <form
          className="mt-2 grid gap-2"
          onSubmit={(event) => void commitFeature.handleCommit(event)}
        >
          <textarea
            value={commitMessage}
            onChange={(event) => setCommitMessage(event.target.value)}
            rows={4}
            disabled={commitDisabled}
            placeholder="描述这次提交做了什么。"
            className="field-sizing-content w-full resize-none rounded-md border border-border bg-editor-background px-3 py-2 text-sm leading-relaxed text-foreground transition outline-none focus:border-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
          />
          {commitError || commitFeature.commitErrorMessage ? (
            <InlineError message={commitError ?? commitFeature.commitErrorMessage ?? ""} />
          ) : null}
          <div className="flex justify-end">
            <button type="submit" disabled={commitDisabled} className={primaryButton}>
              <span
                className={cn(
                  "text-base",
                  commitFeature.isCommitting
                    ? "icon-[material-symbols--sync] animate-spin"
                    : "icon-[material-symbols--check-circle]",
                )}
              />
              提交到当前分支
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
