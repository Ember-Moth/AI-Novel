import { expect, test } from "bun:test";

import {
  PANEL_SCROLLBAR_MIN_THUMB_SIZE,
  getPanelScrollbarMetrics,
  getScrollTopForThumbTop,
} from "@/features/project/components/panelScrollbarMath";

test("returns no thumb when the panel does not overflow", () => {
  const metrics = getPanelScrollbarMetrics({
    clientHeight: 240,
    scrollHeight: 240,
    scrollTop: 40,
  });

  expect(metrics.isOverflowing).toBe(false);
  expect(metrics.thumbHeight).toBe(0);
  expect(metrics.thumbTop).toBe(0);
});

test("enforces the minimum thumb height for long content", () => {
  const metrics = getPanelScrollbarMetrics({
    clientHeight: 120,
    scrollHeight: 4000,
    scrollTop: 200,
  });

  expect(metrics.isOverflowing).toBe(true);
  expect(metrics.thumbHeight).toBe(PANEL_SCROLLBAR_MIN_THUMB_SIZE);
});

test("maps scrollTop to thumbTop and back consistently", () => {
  const metrics = getPanelScrollbarMetrics({
    clientHeight: 200,
    scrollHeight: 600,
    scrollTop: 100,
  });

  expect(metrics.thumbTop).toBeCloseTo(33.3333, 3);

  const scrollTop = getScrollTopForThumbTop({
    thumbTop: metrics.thumbTop,
    clientHeight: metrics.clientHeight,
    scrollHeight: metrics.scrollHeight,
  });

  expect(scrollTop).toBeCloseTo(100, 3);
});

test("recomputes metrics when the panel height changes", () => {
  const compact = getPanelScrollbarMetrics({
    clientHeight: 200,
    scrollHeight: 800,
    scrollTop: 200,
  });
  const expanded = getPanelScrollbarMetrics({
    clientHeight: 320,
    scrollHeight: 800,
    scrollTop: 200,
  });

  expect(expanded.thumbHeight).toBeGreaterThan(compact.thumbHeight);
  expect(expanded.maxScrollTop).toBeLessThan(compact.maxScrollTop);
  expect(expanded.thumbTop).toBeGreaterThan(compact.thumbTop);
});
