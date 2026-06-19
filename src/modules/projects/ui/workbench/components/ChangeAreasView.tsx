import { cn } from "@/shared/lib/cn";

import type { ChangeAreas } from "../../shared/projectTypes";

const workingTreeChangeKindLabels: Record<
  ChangeAreas["content"]["changes"][number]["kind"],
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

/**
 * 渲染一组语义化变更（正文 / 时间线 / 辅助信息）。
 * 由「未提交变更」面板与「提交差异」面板共用，保证两处呈现一致。
 *
 * 当提供 `onRevertContentChange` 时，正文区域的变更项会在 chip 上显示撤回按钮。
 */
export function ChangeAreasView({
  areas,
  onRevertContentChange,
}: {
  areas: ChangeAreas;
  onRevertContentChange?: (
    nodeId: string,
    kind: ChangeAreas["content"]["changes"][number]["kind"],
  ) => void;
}) {
  return (
    <div className="space-y-2">
      {(Object.keys(workingTreeAreaLabels) as Array<keyof typeof workingTreeAreaLabels>).map(
        (areaKey) => {
          const area = areas[areaKey];
          if (!area.changed) {
            return null;
          }

          return (
            <div key={areaKey}>
              <div className="text-xs font-medium text-foreground-muted">
                {workingTreeAreaLabels[areaKey]}
              </div>
              {areaKey === "content"
                ? renderContentArea(areas.content.changes, onRevertContentChange)
                : renderPathArea(area.changes, areaKey === "aux")}
            </div>
          );
        },
      )}
    </div>
  );
}

function renderContentArea(
  changes: ChangeAreas["content"]["changes"],
  onRevertContentChange?: (
    nodeId: string,
    kind: ChangeAreas["content"]["changes"][number]["kind"],
  ) => void,
) {
  return (
    <ul className="mt-1 space-y-1">
      {changes.map((change) => (
        <li
          key={`content-${change.kind}-${change.nodeId}`}
          className="flex flex-col gap-1 text-sm text-foreground"
        >
          <div className="flex items-center gap-2">
            <WorkingTreeChangeBadge
              kind={change.kind}
              nodeId={change.nodeId}
              revertable={change.revertable}
              onRevert={onRevertContentChange}
            />
            <ContentChangeBreadcrumb change={change} />
          </div>
          <WorkingTreeContentChangeDetails change={change} />
        </li>
      ))}
    </ul>
  );
}

function renderPathArea(changes: ChangeAreas["timeline"]["changes"], emphasizeTimeline: boolean) {
  return (
    <ul className="mt-1 space-y-1">
      {changes.map((change) => (
        <li
          key={`${change.kind}-${change.label}`}
          className="flex items-center gap-2 text-sm text-foreground"
        >
          <WorkingTreeChangeBadge kind={change.kind} />
          <WorkingTreeChangeLabel label={change.label} emphasizeTimeline={emphasizeTimeline} />
        </li>
      ))}
    </ul>
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
  nodeId,
  revertable,
  onRevert,
}: {
  kind: ChangeAreas["timeline"]["changes"][number]["kind"];
  nodeId?: string;
  revertable?: boolean;
  onRevert?: (nodeId: string, kind: ChangeAreas["content"]["changes"][number]["kind"]) => void;
}) {
  const label = workingTreeChangeKindLabels[kind];
  const className =
    kind === "added"
      ? "bg-emerald-500/15 text-emerald-200"
      : kind === "deleted"
        ? "bg-red-500/15 text-red-200"
        : "bg-amber-500/15 text-amber-200";

  const revertLabel = kind === "added" ? "删除" : kind === "deleted" ? "恢复" : "恢复";
  const canRevert = revertable !== false;
  const hasRevert = typeof nodeId === "string" && typeof onRevert === "function";

  return (
    <span
      className={cn(
        "group relative shrink-0 overflow-hidden rounded px-1.5 py-0.5 text-[10px] font-medium",
        className,
      )}
    >
      <span className={cn("transition-opacity", hasRevert && "group-hover:opacity-0")}>
        {label}
      </span>
      {hasRevert ? (
        <button
          type="button"
          disabled={!canRevert}
          onClick={(event) => {
            event.stopPropagation();
            if (canRevert) {
              onRevert(nodeId, kind);
            }
          }}
          className={cn(
            "absolute inset-0 flex items-center justify-center rounded px-1.5 text-[10px] font-medium opacity-0 transition-opacity",
            "group-hover:opacity-100",
            canRevert ? "cursor-pointer hover:brightness-110" : "cursor-default opacity-30",
          )}
        >
          {revertLabel}
        </button>
      ) : null}
    </span>
  );
}

function ContentChangeBreadcrumb({
  change,
}: {
  change: ChangeAreas["content"]["changes"][number];
}) {
  const parentPath =
    change.kind === "deleted"
      ? (change.previousParentPathLabel ?? change.parentPathLabel)
      : change.parentPathLabel;
  const parentSegments = parentPath === "顶层" ? [] : parentPath.split(" / ");
  const segments = [...parentSegments, change.label];

  return (
    <div className="flex min-w-0 items-center gap-1 overflow-hidden">
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        return (
          <span
            key={`${change.nodeId}-${segment}-${index}`}
            className="flex min-w-0 items-center gap-1"
          >
            {index > 0 ? (
              <span className="shrink-0 text-sm text-foreground-muted/55">{"/"}</span>
            ) : null}
            <span
              className={cn(
                "min-w-0 truncate text-sm",
                isLast ? "font-medium text-foreground" : "text-foreground-muted",
              )}
            >
              {segment}
            </span>
          </span>
        );
      })}
    </div>
  );
}

function WorkingTreeContentChangeDetails({
  change,
}: {
  change: ChangeAreas["content"]["changes"][number];
}) {
  if (change.kind === "added") {
    return (
      <div className="ml-5 flex flex-wrap items-center gap-1.5 text-[11px] leading-relaxed text-foreground-muted">
        {change.anchorTimelinePointLabel && change.anchorTimelinePointLabel !== "原点" ? (
          <SemanticPlacementChip
            label="锚定到"
            value={change.anchorTimelinePointLabel}
            tone="sky"
          />
        ) : null}
      </div>
    );
  }

  if (change.kind === "deleted") {
    return (
      <div className="ml-5 flex flex-wrap items-center gap-1.5 text-[11px] leading-relaxed text-foreground-muted">
        {change.previousAnchorTimelinePointLabel &&
        change.previousAnchorTimelinePointLabel !== "原点" ? (
          <SemanticPlacementChip
            label="原锚点"
            value={change.previousAnchorTimelinePointLabel}
            tone="red"
          />
        ) : null}
      </div>
    );
  }

  const parentDetail = change.changedAspects.includes("parent")
    ? `${change.previousParentLabel ?? "根目录"} -> ${change.parentLabel ?? "根目录"}`
    : null;
  const anchorDetail = change.changedAspects.includes("anchor")
    ? `${change.previousAnchorTimelinePointLabel ?? "原点"} -> ${change.anchorTimelinePointLabel ?? "原点"}`
    : null;
  const bodyChanged = change.changedAspects.includes("body");
  const orderChanged = change.changedAspects.includes("order");
  const parentChanged = change.changedAspects.includes("parent");
  const anchorChanged = change.changedAspects.includes("anchor");
  const titleChanged =
    change.changedAspects.includes("title") &&
    change.previousTitle &&
    change.previousTitle !== (change.title ?? change.label);
  return (
    <div className="ml-5 flex flex-wrap items-center gap-1.5 text-[11px] leading-relaxed text-foreground-muted">
      {bodyChanged && change.bodyCharDelta ? (
        <SemanticBodyDeltaChip
          added={change.bodyCharDelta.added}
          removed={change.bodyCharDelta.removed}
        />
      ) : null}
      {orderChanged ? <SemanticChangeChip label="同级顺序调整" tone="slate" /> : null}
      {titleChanged ? (
        <SemanticTransitionChip
          label="标题"
          from={change.previousTitle ?? "未命名"}
          to={change.title ?? change.label}
          fromTone="red"
          toTone="emerald"
        />
      ) : null}
      {parentChanged && parentDetail ? (
        <SemanticTransitionChip
          label="移动位置"
          from={change.previousParentLabel ?? "根目录"}
          to={change.parentLabel ?? "根目录"}
          fromTone="slate"
          toTone="sky"
        />
      ) : null}
      {anchorChanged && anchorDetail ? (
        <SemanticTransitionChip
          label="锚点切换"
          from={change.previousAnchorTimelinePointLabel ?? "原点"}
          to={change.anchorTimelinePointLabel ?? "原点"}
          fromTone="slate"
          toTone="sky"
        />
      ) : null}
    </div>
  );
}

function SemanticChangeChip({ tone, label }: { tone: "amber" | "slate"; label: string }) {
  const className =
    tone === "amber"
      ? "border-amber-500/20 bg-amber-500/10 text-amber-100"
      : "border-border bg-sidebar-background text-foreground-muted";
  return (
    <span
      className={cn(
        "inline-flex h-5.5 items-center rounded-sm border px-1.5 text-[10px] leading-none",
        className,
      )}
    >
      {label}
    </span>
  );
}

function SemanticBodyDeltaChip({ added, removed }: { added: number; removed: number }) {
  return (
    <span className="inline-flex h-5.5 items-stretch overflow-hidden rounded-sm border border-border bg-sidebar-background/70 align-middle text-[10px] leading-none">
      {added > 0 ? (
        <span className="inline-flex items-center bg-emerald-500/14 px-1.5 text-emerald-100">
          {`+${added}`}
        </span>
      ) : null}
      {removed > 0 ? (
        <span className="inline-flex items-center bg-red-500/14 px-1.5 text-red-200/85">
          {`-${removed}`}
        </span>
      ) : null}
    </span>
  );
}

function SemanticTransitionChip({
  label,
  from,
  to,
  fromTone,
  toTone,
}: {
  label: string;
  from: string;
  to: string;
  fromTone: "red" | "slate";
  toTone: "emerald" | "sky";
}) {
  const fromClassName =
    fromTone === "red"
      ? "bg-red-500/14 text-red-200/85 line-through decoration-red-300/50"
      : "bg-foreground-muted/8 text-foreground-muted";
  const toClassName =
    toTone === "emerald"
      ? "bg-emerald-500/14 font-medium text-emerald-100"
      : "bg-sky-500/14 text-sky-100";
  return (
    <span className="inline-flex h-5.5 items-stretch overflow-hidden rounded-sm border border-border bg-sidebar-background/70 align-middle text-[10px] leading-none">
      <span className="inline-flex items-center px-1.5 text-foreground-muted/70">{label}</span>
      <span className={cn("inline-flex items-center px-1.5 leading-none", fromClassName)}>
        {from}
      </span>
      <span className="inline-flex items-center px-1 text-foreground-muted/60">{"→"}</span>
      <span className={cn("inline-flex items-center px-1.5 leading-none", toClassName)}>{to}</span>
    </span>
  );
}

function SemanticPlacementChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "sky" | "slate" | "red";
}) {
  const valueClassName =
    tone === "emerald"
      ? "bg-emerald-500/14 text-emerald-100"
      : tone === "red"
        ? "bg-red-500/14 text-red-200/85"
        : tone === "sky"
          ? "bg-sky-500/14 text-sky-100"
          : "bg-foreground-muted/8 text-foreground-muted";
  return (
    <span className="inline-flex h-5.5 items-stretch overflow-hidden rounded-sm border border-border bg-sidebar-background/70 align-middle text-[10px] leading-none">
      <span className="inline-flex items-center px-1.5 text-foreground-muted/70">{label}</span>
      <span className={cn("inline-flex items-center px-1.5 leading-none", valueClassName)}>
        {value}
      </span>
    </span>
  );
}
