import { cn } from "@/shared/lib/cn";
import { LoadingBlock } from "@/shared/ui/Loading";

import type { ChangeAreas, WorkingTreeStatus } from "../../shared/projectTypes";
import { InlineError, secondaryButton } from "../../shared/projectUi";
import { ChangeAreasView } from "./ChangeAreasView";

export function WorkingTreeStatusPanel({
  status,
  loading,
  error,
  discardError,
  canDiscardChanges,
  isDiscardingChanges,
  onDiscardChanges,
  onRevertContentChange,
  onRevertTimelineChange,
  onRevertAuxChange,
}: {
  status: WorkingTreeStatus | null;
  loading: boolean;
  error: string | null;
  discardError: string | null;
  canDiscardChanges: boolean;
  isDiscardingChanges: boolean;
  onDiscardChanges: () => void;
  onRevertContentChange?: (
    nodeId: string,
    kind: ChangeAreas["content"]["changes"][number]["kind"],
  ) => void;
  onRevertTimelineChange?: (
    pointId: string,
    kind: ChangeAreas["timeline"]["changes"][number]["kind"],
  ) => void;
  onRevertAuxChange?: (
    filepath: string,
    kind: ChangeAreas["aux"]["changes"][number]["kind"],
  ) => void;
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
          <ChangeAreasView
            areas={status.areas}
            onRevertContentChange={onRevertContentChange}
            onRevertTimelineChange={onRevertTimelineChange}
            onRevertAuxChange={onRevertAuxChange}
          />
        )}
      </div>
    </section>
  );
}
