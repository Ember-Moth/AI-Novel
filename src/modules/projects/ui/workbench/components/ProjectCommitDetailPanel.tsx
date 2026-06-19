import { skipToken } from "@codehz/rpc/react";

import { rpc } from "@/rpc/client";
import { LoadingBlock } from "@/shared/ui/Loading";

import { useProjectWorkbenchProjectId } from "../core/useProjectWorkbench";
import type { CommitRow } from "../../shared/projectTypes";
import {
  dateFormatter,
  formatCommitId,
  InlineError,
  secondaryButton,
} from "../../shared/projectUi";

/**
 * 选中某个 commit 时展示的详情面板（仿专业版本控制软件的 commit inspector）：
 * 元信息（message / 作者 / 时间 / hash / 父提交）+ 操作入口。
 *
 * 简化版说明：
 * - 「改动文件清单 / 内容 diff」依赖一个「按 commit 取 diff」的后端能力，目前 RPC 尚未提供，
 *   因此这里以占位形式呈现（见下方 DiffPlaceholder），并保留 TODO。
 * - 「Reset 到此提交 / Merge」同样留待后续实现，目前仅暴露 Fork 入口。
 */
export function ProjectCommitDetailPanel({
  commitId,
  selectedBranchHeadCommitId,
  onOpenFork,
}: {
  commitId: string;
  selectedBranchHeadCommitId: string | null;
  onOpenFork: (_commit: CommitRow) => void;
}) {
  const projectId = useProjectWorkbenchProjectId();
  const commitQuery = rpc.useQuery("commits.get", commitId ? { projectId, commitId } : skipToken);
  const commit = commitQuery.data ?? null;
  const isHead = commit?.id === selectedBranchHeadCommitId;

  if (commitQuery.error) {
    return <InlineError message={commitQuery.error.message} />;
  }

  if (!commit) {
    return <LoadingBlock label="正在加载提交..." />;
  }

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div>
        <div className="flex items-start gap-2">
          <span className="mt-0.5 icon-[material-symbols--commit] shrink-0 text-base text-accent-foreground" />
          <h3 className="min-w-0 text-sm leading-snug font-semibold break-words text-foreground">
            {commit.message}
          </h3>
          {isHead ? (
            <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground">
              HEAD
            </span>
          ) : null}
        </div>
      </div>

      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-xs">
        <MetaRow label="提交">
          <span className="font-mono break-all">{formatCommitId(commit.id)}</span>
        </MetaRow>
        <MetaRow label="作者">{commit.author ?? "—"}</MetaRow>
        <MetaRow label="时间">{dateFormatter.format(commit.committedAt)}</MetaRow>
        <MetaRow label="父提交">
          {commit.parents.length === 0 ? (
            <span className="text-foreground-muted">根提交（无父）</span>
          ) : (
            <div className="flex flex-col gap-1">
              {commit.parents.map((parent) => (
                <div key={parent.parentId} className="flex items-center gap-1.5">
                  <span className="font-mono break-all">{formatCommitId(parent.parentId)}</span>
                  {parent.mergeRole !== "normal" ? (
                    <span className="rounded bg-sidebar-background px-1 py-0.5 text-[9px] text-foreground-muted">
                      {parent.mergeRole === "mainline" ? "主线" : "并入"}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </MetaRow>
      </dl>

      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => onOpenFork(commit)} className={secondaryButton}>
          <span className="icon-[material-symbols--fork-right] text-base" />
          从这里 Fork
        </button>
        {/* TODO: Reset 到此提交 / Merge 入口待后端能力补齐后接入。 */}
      </div>

      <DiffPlaceholder />
    </div>
  );
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-foreground-muted">{label}</dt>
      <dd className="min-w-0 text-foreground">{children}</dd>
    </>
  );
}

/**
 * 占位：单个 commit 的改动文件清单 / 内容 diff。
 * TODO: 待新增「commits.diff」之类的 RPC（对比该 commit 与其首个父提交）后替换为真实视图。
 */
function DiffPlaceholder() {
  return (
    <div className="rounded-md border border-dashed border-border bg-editor-background px-3 py-6 text-center">
      <span className="icon-[material-symbols--difference] text-xl text-foreground-muted/60" />
      <p className="mt-1 text-xs text-foreground-muted">改动文件与差异视图待实现</p>
      <p className="mt-0.5 text-[10px] text-foreground-muted/70">
        需要按 commit 计算 diff 的后端能力，当前版本暂未提供。
      </p>
    </div>
  );
}
