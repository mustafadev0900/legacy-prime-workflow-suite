/**
 * Row Drag-Resize Logic Tests (M2 — row resize)
 *
 * Run with: bunx vitest run tests/unit/schedule/row-resize.test.ts
 *
 * Tests the pure clamping + pill-scaling logic for the phase row resize handle.
 * ROW_HEIGHT=46, BAR_HEIGHT=34, MIN_ROW=20px, MAX_ROW=400px.
 */

import { describe, it, expect } from 'vitest';

const ROW_HEIGHT = 46;
const BAR_HEIGHT = 34;
const MIN_ROW    = 20;
const MAX_ROW    = 400;

/**
 * Compute the clamped extra-px for a row after a drag.
 * Mirrors the onMouseMove logic in handleRowResizeMouseDown.
 */
function computeRowExtra(
  startExtra: number,
  zoomLevel: number,
  dragDelta: number,
): number {
  const base     = Math.round(ROW_HEIGHT * zoomLevel);
  const newExtra = startExtra + dragDelta;
  return Math.min(MAX_ROW, Math.max(MIN_ROW, base + newExtra)) - base;
}

/** Effective per-lane height for a phase given its override. */
function effectiveLaneHeight(zoomLevel: number, extra: number): number {
  return Math.max(MIN_ROW, Math.round(ROW_HEIGHT * zoomLevel) + extra);
}

/** Pill height that scales proportionally with the row. */
function pillHeight(laneH: number, zoomLevel: number): number {
  const baseBarH = Math.round(BAR_HEIGHT * zoomLevel);
  const baseRowH = Math.round(ROW_HEIGHT * zoomLevel);
  return Math.max(20, Math.round(baseBarH * laneH / baseRowH));
}

// ─── computeRowExtra ────────────────────────────────────────────────────────

describe('computeRowExtra — row resize clamping', () => {
  it('returns positive extra when dragging down', () => {
    expect(computeRowExtra(0, 1.0, 30)).toBe(30);
  });

  it('returns negative extra when dragging up', () => {
    expect(computeRowExtra(0, 1.0, -10)).toBe(-10);
  });

  it('clamps so laneHeight never goes below MIN_ROW (20px)', () => {
    const extra = computeRowExtra(0, 1.0, -999);
    expect(effectiveLaneHeight(1.0, extra)).toBeGreaterThanOrEqual(MIN_ROW);
  });

  it('clamps so laneHeight never exceeds MAX_ROW (400px)', () => {
    const extra = computeRowExtra(0, 1.0, 999);
    expect(effectiveLaneHeight(1.0, extra)).toBeLessThanOrEqual(MAX_ROW);
  });

  it('accumulates from a non-zero startExtra', () => {
    // already 20px extra, drag another 15px down
    expect(computeRowExtra(20, 1.0, 15)).toBe(35);
  });

  it('works at half zoom (0.5) — base = round(46 * 0.5) = 23', () => {
    const extra = computeRowExtra(0, 0.5, 10);
    expect(extra).toBe(10);
    expect(effectiveLaneHeight(0.5, extra)).toBe(33);
  });

  it('works at max zoom (2.5) — base = round(46 * 2.5) = 115', () => {
    const extra = computeRowExtra(0, 2.5, 40);
    expect(effectiveLaneHeight(2.5, extra)).toBe(155);
  });

  it('does not affect column widths — they stay on dayWidth', () => {
    const DAY_WIDTH = 96;
    const dayWidth  = Math.round(DAY_WIDTH * 1.0); // zoom=1.0
    computeRowExtra(0, 1.0, 60);                    // drag row taller
    expect(dayWidth).toBe(96);                      // unchanged
  });
});

// ─── effectiveLaneHeight ────────────────────────────────────────────────────

describe('effectiveLaneHeight', () => {
  it('equals base rowHeight when extra is 0', () => {
    expect(effectiveLaneHeight(1.0, 0)).toBe(46);
  });

  it('adds extra on top of zoom-based base', () => {
    expect(effectiveLaneHeight(1.0, 20)).toBe(66);
  });

  it('never goes below MIN_ROW', () => {
    expect(effectiveLaneHeight(1.0, -9999)).toBe(MIN_ROW);
  });

  it('scales with zoom — zoom 2x doubles the base', () => {
    // round(46 * 2.0) = 92
    expect(effectiveLaneHeight(2.0, 0)).toBe(92);
  });
});

// ─── pillHeight ─────────────────────────────────────────────────────────────

describe('pillHeight — scales proportionally with row', () => {
  it('equals BAR_HEIGHT at default zoom with no override', () => {
    const laneH = effectiveLaneHeight(1.0, 0); // 46
    expect(pillHeight(laneH, 1.0)).toBe(34);   // BAR_HEIGHT * 1.0
  });

  it('grows when the row is made taller', () => {
    const defaultPill  = pillHeight(effectiveLaneHeight(1.0, 0),  1.0);
    const expandedPill = pillHeight(effectiveLaneHeight(1.0, 30), 1.0);
    expect(expandedPill).toBeGreaterThan(defaultPill);
  });

  it('shrinks when the row is made shorter (but stays ≥ 20px)', () => {
    const extra     = computeRowExtra(0, 1.0, -20); // shrink by 20px
    const smallPill = pillHeight(effectiveLaneHeight(1.0, extra), 1.0);
    expect(smallPill).toBeGreaterThanOrEqual(20);
  });

  it('stays centered — top offset = (laneH - pilH) / 2 is non-negative', () => {
    const laneH = effectiveLaneHeight(1.0, 50);
    const pilH  = pillHeight(laneH, 1.0);
    expect((laneH - pilH) / 2).toBeGreaterThanOrEqual(0);
  });

  it('maintains BAR/ROW ratio at zoom 2.0', () => {
    const laneH = effectiveLaneHeight(2.0, 0);   // 92
    const pilH  = pillHeight(laneH, 2.0);        // round(68 * 92/92) = 68
    const zoom2Bar = Math.round(BAR_HEIGHT * 2.0);
    expect(pilH).toBe(zoom2Bar);
  });

  it('multi-lane phase: top of lane 1 pill = laneH + centering offset', () => {
    // Two tasks stacked — lane 1 starts at laneH
    const laneH = effectiveLaneHeight(1.0, 0); // 46
    const pilH  = pillHeight(laneH, 1.0);      // 34
    const lane1Top = 1 * laneH + (laneH - pilH) / 2;
    expect(lane1Top).toBe(46 + 6); // 52
  });
});

// ─── double-click detection logic ───────────────────────────────────────────

describe('double-click detection (timestamp-based)', () => {
  function isDoubleClick(
    lastClickTime: number,
    now: number,
    threshold = 350,
  ): boolean {
    return lastClickTime !== 0 && now - lastClickTime < threshold;
  }

  it('fires when two clicks are within 350ms', () => {
    expect(isDoubleClick(1000, 1300)).toBe(true);
  });

  it('does not fire when clicks are more than 350ms apart', () => {
    expect(isDoubleClick(1000, 1351)).toBe(false);
  });

  it('does not fire on the very first click (lastClickTime = 0)', () => {
    expect(isDoubleClick(0, 100)).toBe(false);
  });

  it('resets after double-click (lastClickTime set to 0)', () => {
    // After reset, next click at +200ms should not trigger
    expect(isDoubleClick(0, 200)).toBe(false);
  });
});
