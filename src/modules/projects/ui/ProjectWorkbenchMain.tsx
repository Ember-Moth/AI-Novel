import { type FormEvent } from "react";

import { cn } from "@/shared/lib/cn";
import { FullPageMessage } from "@/shared/ui/FullPageMessage";
import { LoadingBlock } from "@/shared/ui/Loading";
import { RowActionButton } from "@/shared/ui/tree";

import type {
  BranchRow,
  CommitHistory,
  CommitRow,
  ProjectRow,
  WorkingTreeStatus,
  WorkspaceRow,
} from "./projectTypes";
import {
  dateFormatter,
  formatCommitId,
  InlineError,
  PageHeader,
  primaryButton,
  secondaryButton,
} from "./projectUi";

export function ProjectWorkbenchMain({
  project,
  selectedBranch,
  selectedWorkspace,
  commitHistory,
  commitHistoryLoading,
  commitHistoryError,
  workingTreeStatus,
  workingTreeStatusLoading,
  workingTreeStatusError,
  discardError,
  commitMessage,
  commitError,
  isCommitting,
  isDiscardingChanges,
  isSettingDefault,
  isDeletingBranch,
  onClose,
  onOpenWorkspace,
  onSetDefaultBranch,
  onDeleteBranch,
  onOpenFork,
  onCommitMessageChange,
  onSubmitCommit,
  onDiscardChanges,
}: {
  project: ProjectRow;
  selectedBranch: BranchRow | null;
  selectedWorkspace: WorkspaceRow | null;
  commitHistory: CommitHistory;
  commitHistoryLoading: boolean;
  commitHistoryError: string | null;
  workingTreeStatus: WorkingTreeStatus | null;
  workingTreeStatusLoading: boolean;
  workingTreeStatusError: string | null;
  discardError: string | null;
  commitMessage: string;
  commitError: string | null;
  isCommitting: boolean;
  isDiscardingChanges: boolean;
  isSettingDefault: boolean;
  isDeletingBranch: boolean;
  onClose: () => void;
  onOpenWorkspace: (_workspaceId: string) => void;
  onSetDefaultBranch: (_branch: BranchRow) => void;
  onDeleteBranch: () => void;
  onOpenFork: (_commit: CommitRow) => void;
  onCommitMessageChange: (_value: string) => void;
  onSubmitCommit: (_event: FormEvent<HTMLFormElement>) => void;
  onDiscardChanges: () => void;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        icon="icon-[material-symbols--folder-open]"
        title={project.name}
        subtitle={selectedBranch ? `Branch · ${selectedBranch.name}` : "Branch Workspace"}
        trailing={
          <button type="button" onClick={onClose} className={secondaryButton}>
            <span className="icon-[material-symbols--close] text-sm" />
            关闭项目
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-3">
        <BranchDetailPanel
          project={project}
          selectedBranch={selectedBranch}
          selectedWorkspace={selectedWorkspace}
          commitHistory={commitHistory}
          commitHistoryLoading={commitHistoryLoading}
          commitHistoryError={commitHistoryError}
          workingTreeStatus={workingTreeStatus}
          workingTreeStatusLoading={workingTreeStatusLoading}
          workingTreeStatusError={workingTreeStatusError}
          discardError={discardError}
          commitMessage={commitMessage}
          commitError={commitError}
          isCommitting={isCommitting}
          isDiscardingChanges={isDiscardingChanges}
          isSettingDefault={isSettingDefault}
          isDeletingBranch={isDeletingBranch}
          onOpenWorkspace={onOpenWorkspace}
          onSetDefaultBranch={onSetDefaultBranch}
          onDeleteBranch={onDeleteBranch}
          onOpenFork={onOpenFork}
          onCommitMessageChange={onCommitMessageChange}
          onSubmitCommit={onSubmitCommit}
          onDiscardChanges={onDiscardChanges}
        />
      </div>
    </div>
  );
}

function BranchDetailPanel({
  project,
  selectedBranch,
  selectedWorkspace,
  commitHistory,
  commitHistoryLoading,
  commitHistoryError,
  workingTreeStatus,
  workingTreeStatusLoading,
  workingTreeStatusError,
  discardError,
  commitMessage,
  commitError,
  isCommitting,
  isDiscardingChanges,
  isSettingDefault,
  isDeletingBranch,
  onOpenWorkspace,
  onSetDefaultBranch,
  onDeleteBranch,
  onOpenFork,
  onCommitMessageChange,
  onSubmitCommit,
  onDiscardChanges,
}: {
  project: ProjectRow;
  selectedBranch: BranchRow | null;
  selectedWorkspace: WorkspaceRow | null;
  commitHistory: CommitHistory;
  commitHistoryLoading: boolean;
  commitHistoryError: string | null;
  workingTreeStatus: WorkingTreeStatus | null;
  workingTreeStatusLoading: boolean;
  workingTreeStatusError: string | null;
  discardError: string | null;
  commitMessage: string;
  commitError: string | null;
  isCommitting: boolean;
  isDiscardingChanges: boolean;
  isSettingDefault: boolean;
  isDeletingBranch: boolean;
  onOpenWorkspace: (_workspaceId: string) => void;
  onSetDefaultBranch: (_branch: BranchRow) => void;
  onDeleteBranch: () => void;
  onOpenFork: (_commit: CommitRow) => void;
  onCommitMessageChange: (_value: string) => void;
  onSubmitCommit: (_event: FormEvent<HTMLFormElement>) => void;
  onDiscardChanges: () => void;
}) {
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
    workspaceMissing || isCommitting || isDiscardingChanges || commitDisabledByCleanTree;

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
                  {selectedBranch.headCommitId ? (
                    <span className="font-mono">{formatCommitId(selectedBranch.headCommitId)}</span>
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
            <div className="mt-2 rounded-md border border-border bg-editor-background px-3 py-2 text-xs text-accent-foreground">
              该分支当前没有对应 workspace，只支持只读查看历史，不能打开编辑器或直接提交。
            </div>
          ) : null}
        </div>

        <section>
          <div className="flex h-7 items-center gap-1 px-3 text-[11px] font-semibold tracking-wider text-foreground-muted uppercase">
            <span className="icon-[material-symbols--history] text-base text-accent-foreground" />
            <h3>提交历史</h3>
          </div>

          <div className="mt-1">
            {commitHistoryError ? (
              <div className="px-3 pb-3">
                <InlineError message={commitHistoryError} />
              </div>
            ) : commitHistoryLoading ? (
              <div className="px-3 pb-3">
                <LoadingBlock label="正在加载提交历史..." />
              </div>
            ) : commitHistory.length === 0 ? (
              <div className="mx-3 mb-3 rounded-md border border-dashed border-border bg-editor-background px-3 py-6 text-sm text-foreground-muted">
                这个分支还没有提交历史。
              </div>
            ) : (
              <div>
                {commitHistory.map((commit) => (
                  <CommitHistoryRow
                    key={commit.id}
                    commit={commit}
                    isHead={commit.id === selectedBranch.headCommitId}
                    onFork={() => onOpenFork(commit)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </section>

      <section className="rounded-md border border-border bg-sidebar-background p-3">
        <div className="flex h-7 items-center gap-1 text-[11px] font-semibold tracking-wider text-foreground-muted uppercase">
          <span className="icon-[material-symbols--upload] text-base text-accent-foreground" />
          <h3>Commit</h3>
        </div>

        {!workspaceMissing ? (
          <WorkingTreeStatusPanel
            status={workingTreeStatus}
            loading={workingTreeStatusLoading}
            error={workingTreeStatusError}
            discardError={discardError}
            canDiscardChanges={canDiscardChanges}
            isDiscardingChanges={isDiscardingChanges}
            onDiscardChanges={onDiscardChanges}
          />
        ) : null}

        <form className="mt-2 grid gap-2" onSubmit={onSubmitCommit}>
          <textarea
            value={commitMessage}
            onChange={(event) => onCommitMessageChange(event.target.value)}
            rows={4}
            disabled={commitDisabled}
            placeholder="描述这次提交做了什么。"
            className="field-sizing-content w-full resize-none rounded-md border border-border bg-editor-background px-3 py-2 text-sm leading-relaxed text-foreground transition outline-none focus:border-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
          />
          {commitError ? <InlineError message={commitError} /> : null}
          <div className="flex justify-end">
            <button type="submit" disabled={commitDisabled} className={primaryButton}>
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
    </div>
  );
}

function CommitHistoryRow({
  commit,
  isHead,
  onFork,
}: {
  commit: CommitRow;
  isHead: boolean;
  onFork: () => void;
}) {
  return (
    <div className="group flex w-full items-start gap-1.5 px-3 py-1 text-[13px] text-foreground transition hover:bg-list-hover-background">
      <span className="mt-0.5 icon-[material-symbols--commit] shrink-0 text-base text-foreground-muted" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-1 leading-none">
          <span className="truncate">{commit.message}</span>
          {isHead ? (
            <span className="rounded px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground">
              HEAD
            </span>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[10px] leading-none text-foreground-muted">
          <span className="break-all">{formatCommitId(commit.id)}</span>
          <span className="shrink-0">{dateFormatter.format(commit.committedAt)}</span>
        </div>
      </div>
      <div className="grid h-5 shrink-0 items-center self-center">
        <div className="pointer-events-none col-start-1 row-start-1 flex items-center justify-end opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100">
          <RowActionButton
            icon="icon-[material-symbols--fork-right]"
            title="Fork"
            onClick={onFork}
          />
        </div>
      </div>
    </div>
  );
}

const workingTreeChangeKindLabels: Record<
  WorkingTreeStatus["areas"]["content"]["changes"][number]["kind"],
  string
> = {
  added: "新增",
  modified: "修改",
  deleted: "删除",
};

const workingTreeAreaLabels = {
  content: "正文",
  timeline: "时间线",
  aux: "辅助信息",
} as const;

function WorkingTreeStatusPanel({
  status,
  loading,
  error,
  discardError,
  canDiscardChanges,
  isDiscardingChanges,
  onDiscardChanges,
}: {
  status: WorkingTreeStatus | null;
  loading: boolean;
  error: string | null;
  discardError: string | null;
  canDiscardChanges: boolean;
  isDiscardingChanges: boolean;
  onDiscardChanges: () => void;
}) {
  return (
    <section className="relative mt-2 rounded-md border border-border bg-editor-background p-3">
      {canDiscardChanges ? (
        <button
          type="button"
          onClick={onDiscardChanges}
          disabled={isDiscardingChanges}
          className={cn(
            secondaryButton,
            "absolute top-3 right-3 text-accent-foreground hover:bg-red-500/10 hover:text-red-200",
          )}
        >
          <span
            className={cn(
              "text-base",
              isDiscardingChanges
                ? "icon-[material-symbols--sync] animate-spin"
                : "icon-[material-symbols--undo]",
            )}
          />
          撤回全部修改
        </button>
      ) : null}

      <div className="flex items-center gap-1">
        <span className="icon-[material-symbols--difference] text-base text-accent-foreground" />
        <h4 className="text-xs font-medium text-foreground-muted">未提交变更</h4>
      </div>

      <div className="mt-2 space-y-2">
        {error ? <InlineError message={error} /> : null}
        {discardError ? <InlineError message={discardError} /> : null}
        {loading ? (
          <LoadingBlock label="正在对比工作区与 HEAD..." />
        ) : status == null ? null : !status.hasChanges ? (
          <p className="text-sm text-foreground-muted">
            {status.headCommitId == null
              ? "尚无提交，当前工作区无变更。"
              : "工作区与 HEAD 一致，无未提交变更。"}
          </p>
        ) : (
          <div className="space-y-2">
            {(Object.keys(workingTreeAreaLabels) as Array<keyof typeof workingTreeAreaLabels>).map(
              (areaKey) => {
                const area = status.areas[areaKey];
                if (!area.changed) {
                  return null;
                }

                return (
                  <div key={areaKey}>
                    <div className="text-xs font-medium text-foreground-muted">
                      {workingTreeAreaLabels[areaKey]}
                    </div>
                    <ul className="mt-1 space-y-1">
                      {area.changes.map((change) => (
                        <li
                          key={`${areaKey}-${change.kind}-${change.label}`}
                          className="flex items-center gap-2 text-sm text-foreground"
                        >
                          <WorkingTreeChangeBadge kind={change.kind} />
                          <WorkingTreeChangeLabel
                            label={change.label}
                            emphasizeTimeline={areaKey === "aux"}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              },
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function WorkingTreeChangeLabel({
  label,
  emphasizeTimeline,
}: {
  label: string;
  emphasizeTimeline: boolean;
}) {
  if (!emphasizeTimeline) {
    return <span className="min-w-0 truncate">{label}</span>;
  }

  const timelineMarkerIndex = label.lastIndexOf("@");
  if (timelineMarkerIndex < 0) {
    return <span className="min-w-0 truncate">{label}</span>;
  }

  const path = label.slice(0, timelineMarkerIndex);
  const timelineRef = label.slice(timelineMarkerIndex);

  return (
    <span className="min-w-0 truncate">
      {path}
      <span className="text-foreground-muted italic">{timelineRef}</span>
    </span>
  );
}

function WorkingTreeChangeBadge({
  kind,
}: {
  kind: WorkingTreeStatus["areas"]["content"]["changes"][number]["kind"];
}) {
  const label = workingTreeChangeKindLabels[kind];
  const className =
    kind === "added"
      ? "bg-emerald-500/15 text-emerald-200"
      : kind === "deleted"
        ? "bg-red-500/15 text-red-200"
        : "bg-amber-500/15 text-amber-200";

  return (
    <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium", className)}>
      {label}
    </span>
  );
}
