import { AppSidebar } from "@/app/shell/AppShell";
import { IconButton } from "@/shared/ui/IconButton";
import { LoadingBlock } from "@/shared/ui/Loading";
import { OverlayScrollbar } from "@/shared/ui/OverlayScrollbar";
import { SidebarPanels } from "@/shared/ui/sidebar";
import { SidebarListRow } from "@/shared/ui/tree";

import type { BranchList, BranchRow, ProjectRow } from "./projectTypes";
import { dateFormatter, formatCommitId, InlineError } from "./projectUi";
import { useProjectPageState } from "./state/projectPageStore";

export function ProjectWorkbenchSidebar({
  project,
  branches,
  branchesLoading,
  branchesError,
  selectedBranch,
  metadataErrorMessage,
  isSaving,
  onMetadataCommit,
  onSelectBranch,
  onCreateBranch,
}: {
  project: ProjectRow;
  branches: BranchList;
  branchesLoading: boolean;
  branchesError: string | null;
  selectedBranch: BranchRow | null;
  metadataErrorMessage: string | null;
  isSaving: boolean;
  onMetadataCommit: () => void;
  onSelectBranch: (_branchId: string | null) => void;
  onCreateBranch: () => void;
}) {
  return (
    <AppSidebar>
      <div className="border-b border-border px-3 py-3">
        <div className="text-[11px] font-semibold tracking-wider text-foreground-muted uppercase">
          项目工作台
        </div>
        <div className="mt-1 truncate text-sm font-medium text-foreground">{project.name}</div>
      </div>

      <SidebarPanels
        panels={[
          {
            title: `Branches · ${branches.length}`,
            actions: (
              <IconButton
                icon="icon-[material-symbols--add]"
                title="新建分支"
                onClick={onCreateBranch}
              />
            ),
            content: (
              <ProjectBranchListPanel
                project={project}
                branches={branches}
                branchesLoading={branchesLoading}
                branchesError={branchesError}
                selectedBranch={selectedBranch}
                onSelectBranch={onSelectBranch}
              />
            ),
          },
          {
            title: "Project Meta",
            content: (
              <ProjectMetaPanel
                project={project}
                metadataErrorMessage={metadataErrorMessage}
                isSaving={isSaving}
                branchCount={branches.length}
                onMetadataCommit={onMetadataCommit}
              />
            ),
          },
        ]}
      />
    </AppSidebar>
  );
}

function ProjectBranchListPanel({
  project,
  branches,
  branchesLoading,
  branchesError,
  selectedBranch,
  onSelectBranch,
}: {
  project: ProjectRow;
  branches: BranchList;
  branchesLoading: boolean;
  branchesError: string | null;
  selectedBranch: BranchRow | null;
  onSelectBranch: (_branchId: string | null) => void;
}) {
  if (branchesError) {
    return (
      <div className="p-3">
        <InlineError message={branchesError} />
      </div>
    );
  }

  if (branchesLoading) {
    return (
      <div className="p-3">
        <LoadingBlock label="正在加载分支..." />
      </div>
    );
  }

  if (branches.length === 0) {
    return (
      <div className="p-3">
        <div className="rounded-md border border-dashed border-border bg-editor-background px-4 py-8 text-sm text-foreground-muted">
          当前项目还没有 branch，先创建一个分支开始工作。
        </div>
      </div>
    );
  }

  return (
    <div className="py-1">
      {branches.map((branch) => (
        <SidebarListRow
          key={branch.id}
          isActive={branch.id === selectedBranch?.id}
          onClick={() => onSelectBranch(branch.id)}
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
          trailing={branch.headCommitId ? formatCommitId(branch.headCommitId) : "空分支"}
        />
      ))}
    </div>
  );
}

function ProjectMetaPanel({
  project,
  metadataErrorMessage,
  isSaving,
  branchCount,
  onMetadataCommit,
}: {
  project: ProjectRow;
  metadataErrorMessage: string | null;
  isSaving: boolean;
  branchCount: number;
  onMetadataCommit: () => void;
}) {
  const detailName = useProjectPageState((state) => state.detailName);
  const detailDescription = useProjectPageState((state) => state.detailDescription);
  const detailError = useProjectPageState((state) => state.detailError);
  const setDetailName = useProjectPageState((state) => state.setDetailName);
  const setDetailDescription = useProjectPageState((state) => state.setDetailDescription);

  return (
    <OverlayScrollbar className="h-full min-h-0 w-full">
      <div className="space-y-4 p-3">
        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-foreground-muted">项目名</span>
          <input
            value={detailName}
            disabled={isSaving}
            onChange={(event) => setDetailName(event.target.value)}
            onBlur={onMetadataCommit}
            className="w-full rounded-md border border-border bg-editor-background px-3 py-2 text-sm text-foreground transition outline-none focus:border-accent-foreground disabled:cursor-wait disabled:opacity-70"
          />
        </label>

        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-foreground-muted">描述</span>
          <textarea
            value={detailDescription}
            disabled={isSaving}
            rows={5}
            onChange={(event) => setDetailDescription(event.target.value)}
            onBlur={onMetadataCommit}
            className="field-sizing-content w-full resize-none rounded-md border border-border bg-editor-background px-3 py-2 text-sm leading-relaxed text-foreground transition outline-none focus:border-accent-foreground disabled:cursor-wait disabled:opacity-70"
            placeholder="为这个项目补充背景、目标或当前进度。"
          />
        </label>

        {detailError || metadataErrorMessage ? (
          <InlineError message={detailError ?? metadataErrorMessage ?? ""} />
        ) : null}

        <div className="rounded-md border border-border bg-editor-background p-3">
          <div className="text-[11px] tracking-wide text-foreground-muted/70 uppercase">Stats</div>
          <div className="mt-2 space-y-2 text-sm text-foreground">
            <div className="flex items-center justify-between gap-3">
              <span className="text-foreground-muted">Branch 数量</span>
              <span>{branchCount}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-foreground-muted">上次更新</span>
              <span className="text-right text-xs">{dateFormatter.format(project.updatedAt)}</span>
            </div>
          </div>
        </div>
      </div>
    </OverlayScrollbar>
  );
}
