import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/shared/lib/cn";
import { OverlayScrollbar } from "@/shared/ui/OverlayScrollbar";

export function MarkdownTable({
  children,
  className,
  node: _node,
  ...props
}: ComponentProps<"table"> & {
  children?: ReactNode;
  node?: unknown;
}) {
  return (
    <div className="my-4" data-streamdown="table-wrapper">
      <OverlayScrollbar variant="inline" className="ai-table-scrollbar">
        <table
          {...props}
          className={cn("w-full min-w-full border-collapse divide-y divide-border", className)}
          data-streamdown="table"
        >
          {children}
        </table>
      </OverlayScrollbar>
    </div>
  );
}
