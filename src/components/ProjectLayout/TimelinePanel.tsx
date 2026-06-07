import { useState } from "react";

import type { TimelinePointVM } from "./types";

export function TimelinePanel({
  points,
  activeId,
  isBusy,
  onSelect,
  onReorder,
  onDelete,
}: {
  points: TimelinePointVM[];
  activeId: string | null;
  isBusy: boolean;
  onSelect: (_id: string) => void;
  onReorder: (_fromIndex: number, _toIndex: number) => void;
  onDelete: (_id: string) => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  return (
    <div className="pb-2">
      {points.map((point, index) => {
        const isActive = point.id === activeId;
        const isDragging = dragIndex === index;
        const isDragOver = dragOverIndex === index;

        return (
          <div
            key={point.id}
            className={`flex cursor-pointer items-center gap-1 py-0.75 pr-1 text-[13px] ${
              isDragging ? "opacity-40" : ""
            } ${isDragOver ? "border-t border-t-drag-border" : ""} ${
              isActive
                ? "bg-list-active-background text-foreground"
                : "text-foreground hover:bg-list-hover-background"
            } ${point.isImplicitOrigin ? "opacity-90" : ""}`}
            style={{ paddingLeft: "8px" }}
            draggable={!point.isImplicitOrigin && !isBusy}
            onDragStart={(event) => {
              if (point.isImplicitOrigin || isBusy) {
                event.preventDefault();
                return;
              }

              setDragIndex(index);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", String(index));
            }}
            onDragOver={(event) => {
              if (dragIndex === null || isBusy || dragIndex === index) {
                return;
              }

              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setDragOverIndex(index);
            }}
            onDragLeave={() => setDragOverIndex(null)}
            onDrop={(event) => {
              event.preventDefault();
              if (dragIndex !== null && dragIndex !== index) {
                onReorder(dragIndex, index);
              }
              setDragIndex(null);
              setDragOverIndex(null);
            }}
            onDragEnd={() => {
              setDragIndex(null);
              setDragOverIndex(null);
            }}
            onClick={() => onSelect(point.id)}
          >
            <span className="icon-[material-symbols--radio-button-checked] shrink-0 text-sm text-foreground-muted" />
            <span className="truncate">{point.label}</span>
            {point.description ? (
              <span className="truncate text-[11px] text-foreground-muted">
                {point.description}
              </span>
            ) : null}
            {!point.isImplicitOrigin ? (
              <button
                type="button"
                className="ml-auto rounded p-px text-foreground-muted opacity-0 hover:bg-button-hover-background hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-30"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(point.id);
                }}
                disabled={isBusy}
                title="删除时间点"
              >
                <span className="icon-[material-symbols--close] text-sm leading-none" />
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
