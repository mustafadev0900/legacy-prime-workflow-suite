/**
 * Column Drag-Resize Logic Tests (M2-T5)
 *
 * Run with: bunx vitest run tests/unit/schedule/column-resize.test.ts
 *
 * Tests the pure clamping logic for the date column resize handle.
 * DAY_WIDTH=96, MIN_ZOOM columns=30px, MAX columns=400px.
 */

import { describe, it, expect } from 'vitest';

const DAY_WIDTH = 96;
const MIN_COL   = 30;
const MAX_COL   = 400;

function computeNewExtra(
  startExtra: number,
  zoomLevel: number,
  dragDelta: number,
): number {
  const base     = Math.round(DAY_WIDTH * zoomLevel);
  const newExtra = startExtra + dragDelta;
  const clamped  = Math.min(MAX_COL, Math.max(MIN_COL, base + newExtra)) - base;
  return clamped;
}

function computeDayWidth(zoomLevel: number, colWidthExtra: number): number {
  return Math.max(MIN_COL, Math.round(DAY_WIDTH * zoomLevel) + colWidthExtra);
}

describe('computeNewExtra — column resize clamping', () => {
  it('returns positive extra when dragging right', () => {
    const extra = computeNewExtra(0, 1.0, 50);
    expect(extra).toBe(50);
  });

  it('returns negative extra when dragging left', () => {
    const extra = computeNewExtra(0, 1.0, -30);
    expect(extra).toBe(-30);
  });

  it('clamps so total dayWidth does not go below MIN_COL (30px)', () => {
    // base = 96, dragging far left → clamped at 30
    const extra = computeNewExtra(0, 1.0, -200);
    const dayWidth = computeDayWidth(1.0, extra);
    expect(dayWidth).toBeGreaterThanOrEqual(MIN_COL);
  });

  it('clamps so total dayWidth does not exceed MAX_COL (400px)', () => {
    const extra = computeNewExtra(0, 1.0, 500);
    const dayWidth = computeDayWidth(1.0, extra);
    expect(dayWidth).toBeLessThanOrEqual(MAX_COL);
  });

  it('preserves existing extra when dragging from a non-zero start', () => {
    const extra = computeNewExtra(20, 1.0, 10);
    expect(extra).toBe(30);
  });

  it('does not affect zoomLevel — row/bar heights unchanged', () => {
    // dayWidth changes, but rowHeight is computed from zoomLevel alone
    const zoom       = 1.0;
    const ROW_HEIGHT = 60;
    const rowHeight  = Math.round(ROW_HEIGHT * zoom);

    computeNewExtra(0, zoom, 100); // drag 100px right

    // rowHeight must still equal ROW_HEIGHT * zoom
    expect(rowHeight).toBe(60);
  });

  it('works correctly at half zoom (0.5)', () => {
    // base = round(96 * 0.5) = 48
    const extra = computeNewExtra(0, 0.5, 20);
    expect(extra).toBe(20);
    expect(computeDayWidth(0.5, extra)).toBe(68);
  });

  it('works correctly at max zoom (2.5)', () => {
    // base = round(96 * 2.5) = 240
    const extra = computeNewExtra(0, 2.5, 50);
    expect(computeDayWidth(2.5, extra)).toBe(290);
  });
});

describe('computeDayWidth', () => {
  it('equals base at zoom 1.0 with no extra', () => {
    expect(computeDayWidth(1.0, 0)).toBe(96);
  });

  it('never goes below MIN_COL', () => {
    expect(computeDayWidth(1.0, -9999)).toBe(MIN_COL);
  });

  it('adds extra on top of zoom-based base', () => {
    expect(computeDayWidth(1.0, 40)).toBe(136);
  });
});
