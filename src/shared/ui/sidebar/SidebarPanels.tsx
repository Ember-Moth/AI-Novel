import { type ReactNode, useEffect, useRef } from "react";

import { isHandleInteractive } from "./layoutMath";
import { ResizeHandle } from "./ResizeHandle";
import { SidebarSection } from "./SidebarSection";
import { useSidebarLayout } from "./useSidebarLayout";

export type SidebarPanelSpec = {
  title: string;
  actions?: ReactNode;
  content: ReactNode;
};

export function SidebarPanels({ panels }: { panels: SidebarPanelSpec[] }) {
  const {
    heights,
    collapsed,
    initialized,
    onMeasure,
    resizeStart,
    resize,
    resizeEnd,
    toggleCollapse,
  } = useSidebarLayout(panels.length);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }
    onMeasure(element.getBoundingClientRect().height);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        onMeasure(entry.contentRect.height);
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [onMeasure]);

  return (
    <div ref={containerRef} className="flex flex-1 flex-col overflow-hidden">
      {panels.map((panel, index) => (
        <div key={panel.title} className="contents">
          <SidebarSection
            title={panel.title}
            actions={panel.actions}
            collapsed={collapsed[index] ?? false}
            onToggleCollapse={() => toggleCollapse(index)}
            height={initialized ? heights[index] : undefined}
          >
            {panel.content}
          </SidebarSection>
          {index < panels.length - 1 ? (
            <ResizeHandle
              interactive={isHandleInteractive(collapsed, index)}
              onResizeStart={resizeStart}
              onResize={(delta) => resize(index, delta)}
              onResizeEnd={resizeEnd}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}
