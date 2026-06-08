export const PANEL_SCROLLBAR_MIN_THUMB_SIZE = 20;

export type PanelScrollbarMetrics = {
  isOverflowing: boolean;
  clientHeight: number;
  scrollHeight: number;
  scrollTop: number;
  maxScrollTop: number;
  trackHeight: number;
  thumbHeight: number;
  maxThumbTop: number;
  thumbTop: number;
};

export function getPanelScrollbarMetrics({
  clientHeight,
  scrollHeight,
  scrollTop,
  minThumbSize = PANEL_SCROLLBAR_MIN_THUMB_SIZE,
}: {
  clientHeight: number;
  scrollHeight: number;
  scrollTop: number;
  minThumbSize?: number;
}): PanelScrollbarMetrics {
  const safeClientHeight = Math.max(0, clientHeight);
  const safeScrollHeight = Math.max(safeClientHeight, scrollHeight);
  const maxScrollTop = Math.max(0, safeScrollHeight - safeClientHeight);
  const clampedScrollTop = clamp(scrollTop, 0, maxScrollTop);
  const isOverflowing = safeScrollHeight > safeClientHeight && safeClientHeight > 0;

  if (!isOverflowing) {
    return {
      isOverflowing: false,
      clientHeight: safeClientHeight,
      scrollHeight: safeScrollHeight,
      scrollTop: clampedScrollTop,
      maxScrollTop,
      trackHeight: safeClientHeight,
      thumbHeight: 0,
      maxThumbTop: 0,
      thumbTop: 0,
    };
  }

  const thumbHeight = Math.min(
    safeClientHeight,
    Math.max((safeClientHeight / safeScrollHeight) * safeClientHeight, minThumbSize),
  );
  const maxThumbTop = Math.max(0, safeClientHeight - thumbHeight);
  const thumbTop =
    maxScrollTop === 0 ? 0 : clamp((clampedScrollTop / maxScrollTop) * maxThumbTop, 0, maxThumbTop);

  return {
    isOverflowing,
    clientHeight: safeClientHeight,
    scrollHeight: safeScrollHeight,
    scrollTop: clampedScrollTop,
    maxScrollTop,
    trackHeight: safeClientHeight,
    thumbHeight,
    maxThumbTop,
    thumbTop,
  };
}

export function getScrollTopForThumbTop({
  thumbTop,
  clientHeight,
  scrollHeight,
  minThumbSize = PANEL_SCROLLBAR_MIN_THUMB_SIZE,
}: {
  thumbTop: number;
  clientHeight: number;
  scrollHeight: number;
  minThumbSize?: number;
}) {
  const metrics = getPanelScrollbarMetrics({
    clientHeight,
    scrollHeight,
    scrollTop: 0,
    minThumbSize,
  });

  if (!metrics.isOverflowing || metrics.maxThumbTop === 0) {
    return 0;
  }

  return clamp((thumbTop / metrics.maxThumbTop) * metrics.maxScrollTop, 0, metrics.maxScrollTop);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
