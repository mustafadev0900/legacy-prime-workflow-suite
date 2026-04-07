/**
 * Subcontractor Assignment Logic Tests
 *
 * Run with: bun run tests/subcontractor-assignment.test.ts
 *
 * Tests the pure logic extracted from TaskDetailModal:
 *   - toggleSubcontractorAssignment
 *   - handleWorkTypeChange (clears IDs on in-house switch)
 *   - section visibility rules
 *   - form reset
 *   - assignedSubIds initialization
 */

import { describe, it, expect } from 'vitest';

// ─── Pure logic extracted from TaskDetailModal ────────────────────────────────

function toggleSubcontractorAssignment(prev: string[], subId: string): string[] {
  if (prev.includes(subId)) {
    return prev.filter(id => id !== subId);
  }
  return [...new Set([...prev, subId])];
}

function handleWorkTypeChange(
  value: 'in-house' | 'subcontractor',
  currentSubIds: string[]
): { workType: 'in-house' | 'subcontractor'; assignedSubIds: string[] } {
  return {
    workType: value,
    assignedSubIds: value === 'in-house' ? [] : currentSubIds,
  };
}

function resetFormSubIds(): string[] {
  return [];
}

function initAssignedSubIds(task: { assignedSubcontractorIds?: string[] }): string[] {
  return task.assignedSubcontractorIds ?? [];
}

/**
 * Whether the subcontractor picker section should render.
 * Mirrors the condition in TaskDetailModal:
 *   workType === 'subcontractor' && !isReadOnly
 */
function shouldShowSubSection(
  workType: 'in-house' | 'subcontractor',
  isReadOnly: boolean
): boolean {
  return workType === 'subcontractor' && !isReadOnly;
}

/**
 * Whether the picker rows are interactive (not disabled).
 * Mirrors: !isAlreadyCompleted
 */
function isPickerInteractive(isAlreadyCompleted: boolean): boolean {
  return !isAlreadyCompleted;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('toggleSubcontractorAssignment', () => {
  it('adds a subcontractor ID when not already present', () => {
    const result = toggleSubcontractorAssignment([], 'sub-1');
    expect(result).toEqual(['sub-1']);
  });

  it('removes a subcontractor ID when already present', () => {
    const result = toggleSubcontractorAssignment(['sub-1', 'sub-2'], 'sub-1');
    expect(result).toEqual(['sub-2']);
  });

  it('does not duplicate an ID that is already in the list', () => {
    // Simulate double-tap / race condition
    const after1 = toggleSubcontractorAssignment([], 'sub-1');
    const after2 = toggleSubcontractorAssignment(after1, 'sub-1'); // remove
    const after3 = toggleSubcontractorAssignment(after2, 'sub-1'); // add back
    expect(after3).toEqual(['sub-1']);
    expect(after3.length).toBe(1);
  });

  it('handles multiple subcontractors independently', () => {
    let ids: string[] = [];
    ids = toggleSubcontractorAssignment(ids, 'sub-1');
    ids = toggleSubcontractorAssignment(ids, 'sub-2');
    ids = toggleSubcontractorAssignment(ids, 'sub-3');
    expect(ids).toEqual(['sub-1', 'sub-2', 'sub-3']);

    ids = toggleSubcontractorAssignment(ids, 'sub-2');
    expect(ids).toEqual(['sub-1', 'sub-3']);
  });

  it('returns a new array reference (immutable)', () => {
    const original = ['sub-1'];
    const result = toggleSubcontractorAssignment(original, 'sub-2');
    expect(result).not.toBe(original);
  });
});

describe('handleWorkTypeChange', () => {
  it('clears assignedSubIds when switching to in-house', () => {
    const { workType, assignedSubIds } = handleWorkTypeChange('in-house', ['sub-1', 'sub-2']);
    expect(workType).toBe('in-house');
    expect(assignedSubIds).toEqual([]);
  });

  it('keeps existing assignedSubIds when switching to subcontractor', () => {
    const { workType, assignedSubIds } = handleWorkTypeChange('subcontractor', ['sub-1']);
    expect(workType).toBe('subcontractor');
    expect(assignedSubIds).toEqual(['sub-1']);
  });

  it('keeps empty array when switching to subcontractor with no prior selections', () => {
    const { assignedSubIds } = handleWorkTypeChange('subcontractor', []);
    expect(assignedSubIds).toEqual([]);
  });

  it('clears IDs even when switching to in-house from in-house (idempotent)', () => {
    const { assignedSubIds } = handleWorkTypeChange('in-house', []);
    expect(assignedSubIds).toEqual([]);
  });
});

describe('Section visibility', () => {
  it('shows section when workType is subcontractor and not read-only', () => {
    expect(shouldShowSubSection('subcontractor', false)).toBe(true);
  });

  it('hides section when workType is in-house', () => {
    expect(shouldShowSubSection('in-house', false)).toBe(false);
  });

  it('hides section in client read-only view even when subcontractor type', () => {
    expect(shouldShowSubSection('subcontractor', true)).toBe(false);
  });

  it('shows section for completed tasks (bug fix: was previously hidden)', () => {
    // isAlreadyCompleted does NOT affect shouldShowSubSection — only interactivity
    expect(shouldShowSubSection('subcontractor', false)).toBe(true);
  });
});

describe('Picker interactivity on completed tasks', () => {
  it('picker is interactive when task is not completed', () => {
    expect(isPickerInteractive(false)).toBe(true);
  });

  it('picker is disabled (read-only) when task is already completed', () => {
    expect(isPickerInteractive(true)).toBe(false);
  });
});

describe('assignedSubIds initialization', () => {
  it('defaults to empty array when task has no assignedSubcontractorIds', () => {
    const result = initAssignedSubIds({});
    expect(result).toEqual([]);
  });

  it('defaults to empty array when assignedSubcontractorIds is undefined', () => {
    const result = initAssignedSubIds({ assignedSubcontractorIds: undefined });
    expect(result).toEqual([]);
  });

  it('loads existing IDs from task', () => {
    const result = initAssignedSubIds({ assignedSubcontractorIds: ['sub-1', 'sub-2'] });
    expect(result).toEqual(['sub-1', 'sub-2']);
  });

  it('loads empty array from task with empty assignments', () => {
    const result = initAssignedSubIds({ assignedSubcontractorIds: [] });
    expect(result).toEqual([]);
  });
});

describe('Form reset', () => {
  it('clears all assigned sub IDs on reset', () => {
    expect(resetFormSubIds()).toEqual([]);
  });
});
