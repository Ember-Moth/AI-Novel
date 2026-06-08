import {
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  type PanelScrollbarMetrics,
  getPanelScrollbarMetrics,
  getScrollTopForThumbTop,
} from "@/features/project/components/panelScrollbarMath";

const SCROLLBAR_HIDE_DELAY_MS = 700;

const EMPTY_METRICS: PanelScrollbarMetrics = {
  isOverflowing: false,
  clientHeight: 0,
  scrollHeight: 0,
  scrollTop: 0,
  maxScrollTop: 0,
  trackHeight: 0,
  thumbHeight: 0,
  maxThumbTop: 0,
  thumbTop: 0,
};

export function PanelScrollArea({ children }: { children: ReactNode }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStateRef = useRef<{ pointerId: number; startY: number; startThumbTop: number } | null>(
    null,
  );
  const [metrics, setMetrics] = useState<PanelScrollbarMetrics>(EMPTY_METRICS);
  const [isHovered, setIsHovered] = useState(false);
  const [isScrollActive, setIsScrollActive] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const updateMetrics = () => {
    const viewport = viewportRef.current;
    if (!viewport) {
      setMetrics(EMPTY_METRICS);
      return;
    }

    setMetrics(
      getPanelScrollbarMetrics({
        clientHeight: viewport.clientHeight,
        scrollHeight: viewport.scrollHeight,
        scrollTop: viewport.scrollTop,
      }),
    );
  };

  const showScrollbar = () => {
    setIsScrollActive(true);
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = setTimeout(() => {
      setIsScrollActive(false);
      hideTimerRef.current = null;
    }, SCROLLBAR_HIDE_DELAY_MS);
  };

  useEffect(() => {
    updateMetrics();
  }, [children]);

  useEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) {
      return;
    }

    updateMetrics();

    const observer = new ResizeObserver(() => {
      updateMetrics();
    });

    observer.observe(viewport);
    observer.observe(content);

    return () => observer.disconnect();
  }, []);

  useEffect(
    () => () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    },
    [],
  );

  const handleScroll = () => {
    updateMetrics();
    showScrollbar();
  };

  const handlePointerEnter = () => {
    setIsHovered(true);
  };

  const handlePointerLeave = () => {
    setIsHovered(false);
  };

  const handleThumbPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startThumbTop: metrics.thumbTop,
    };
    setIsDragging(true);
    showScrollbar();
  };

  const handleThumbPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    const dragState = dragStateRef.current;
    if (!viewport || !dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const nextThumbTop = dragState.startThumbTop + (event.clientY - dragState.startY);
    viewport.scrollTop = getScrollTopForThumbTop({
      thumbTop: nextThumbTop,
      clientHeight: metrics.clientHeight,
      scrollHeight: metrics.scrollHeight,
    });
    updateMetrics();
  };

  const handleThumbPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current?.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragStateRef.current = null;
    setIsDragging(false);
    showScrollbar();
  };

  const isVisible = metrics.isOverflowing && (isHovered || isScrollActive || isDragging);

  return (
    <div
      className="group/scrollarea relative flex-1 min-h-0"
      data-dragging={isDragging}
      data-hovered={isHovered}
      data-visible={isVisible}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      <div
        ref={viewportRef}
        className="scrollbar-none h-full overflow-x-auto overflow-y-auto"
        onScroll={handleScroll}
      >
        <div ref={contentRef}>{children}</div>
      </div>
      {metrics.isOverflowing ? (
        <div
          className="hidden fine-pointer:scrollbar-overlay group-data-[visible=true]/scrollarea:opacity-100"
          aria-hidden
        >
          <div
            className="scrollbar-overlay-thumb group-data-[hovered=true]/scrollarea:scrollbar-overlay-thumb-hover group-data-[dragging=true]/scrollarea:scrollbar-overlay-thumb-dragging"
            style={{
              top: `${metrics.thumbTop}px`,
              height: `${metrics.thumbHeight}px`,
            }}
            onPointerDown={handleThumbPointerDown}
            onPointerMove={handleThumbPointerMove}
            onPointerUp={handleThumbPointerUp}
            onPointerCancel={handleThumbPointerUp}
          />
        </div>
      ) : null}
    </div>
  );
}
