/**
 * Client Schedule View — Hide Feature Tests (M2-T1, T2, T3)
 *
 * Run with: bunx vitest run tests/unit/schedule/client-schedule-view.test.ts
 *
 * Tests the pure filtering and display logic for the shared schedule
 * client view at /schedule-view/[token].tsx.
 *
 * M2-T1: Employee avatars not rendered (no assignedEmployeeIds in client view)
 * M2-T2: Subcontractor work type label hidden from hover tooltip
 * M2-T3: Only visibleToClient !== false tasks shown to client
 */

import { describe, it, expect } from 'vitest';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Task {
  id: string;
  category: string;
  startDate: string;
  endDate: string;
  duration: number;
  color: string;
  workType: 'in-house' | 'subcontractor';
  visibleToClient?: boolean;
  completed?: boolean;
  notes?: string;
  assignedEmployeeIds?: string[];
  assignedSubcontractorIds?: string[];
}

// ─── Pure logic mirroring schedule-view/[token].tsx ──────────────────────────

/**
 * M2-T3: Filter tasks loaded from API to only show client-visible ones.
 * undefined is treated as visible (matches DB default of true).
 */
function filterClientVisibleTasks(tasks: Task[]): Task[] {
  return tasks.filter(t => t.visibleToClient !== false);
}

/**
 * Derive phase names that appear in the client view.
 * A phase only appears if at least one visible task belongs to it.
 */
function deriveVisiblePhaseNames(visibleTasks: Task[]): string[] {
  return [...new Set(visibleTasks.map(t => t.category))];
}

/**
 * M2-T2: Build hover tooltip lines for client view.
 * Work type (Subcontractor/In-House) is intentionally excluded.
 */
function buildTooltipLines(task: Task): string[] {
  const lines: string[] = [];
  lines.push(task.category);
  lines.push(`${task.startDate} · ${task.duration}d`);
  if (task.completed) lines.push('✓ Completed');
  if (task.notes && task.visibleToClient !== false) lines.push(task.notes);
  return lines;
}

/**
 * M2-T1: Client view pill fields — no employee/sub detail fields included.
 */
function buildClientPillData(task: Task): { category: string; duration: number; completed: boolean } {
  return {
    category: task.category,
    duration: task.duration,
    completed: task.completed ?? false,
    // assignedEmployeeIds and assignedSubcontractorIds deliberately excluded
  };
}

// ─── Test data ───────────────────────────────────────────────────────────────

const tasks: Task[] = [
  {
    id: 't1', category: 'Pre-Construction', startDate: '2026-04-07', endDate: '2026-04-09',
    duration: 2, color: '#8B5CF6', workType: 'in-house', visibleToClient: true,
    assignedEmployeeIds: ['emp-1', 'emp-2'], assignedSubcontractorIds: [],
  },
  {
    id: 't2', category: 'Site Preparation', startDate: '2026-04-10', endDate: '2026-04-11',
    duration: 1, color: '#A16207', workType: 'subcontractor', visibleToClient: false,
    assignedEmployeeIds: [], assignedSubcontractorIds: ['sub-1'],
  },
  {
    id: 't3', category: 'Foundation', startDate: '2026-04-12', endDate: '2026-04-14',
    duration: 2, color: '#991B1B', workType: 'in-house', visibleToClient: undefined,
    assignedEmployeeIds: ['emp-3'],
  },
  {
    id: 't4', category: 'Framing', startDate: '2026-04-15', endDate: '2026-04-20',
    duration: 5, color: '#F59E0B', workType: 'subcontractor', visibleToClient: false,
    assignedSubcontractorIds: ['sub-2', 'sub-3'],
  },
  {
    id: 't5', category: 'Roofing', startDate: '2026-04-21', endDate: '2026-04-22',
    duration: 1, color: '#7C3AED', workType: 'subcontractor', visibleToClient: true,
    completed: true, notes: 'Client-safe note',
    assignedSubcontractorIds: ['sub-1'],
  },
];

// ─── M2-T3: filterClientVisibleTasks ─────────────────────────────────────────

describe('M2-T3 — filterClientVisibleTasks', () => {
  it('keeps tasks where visibleToClient is true', () => {
    const visible = filterClientVisibleTasks(tasks);
    expect(visible.map(t => t.id)).toContain('t1');
  });

  it('removes tasks where visibleToClient is false', () => {
    const visible = filterClientVisibleTasks(tasks);
    expect(visible.map(t => t.id)).not.toContain('t2');
    expect(visible.map(t => t.id)).not.toContain('t4');
  });

  it('treats visibleToClient = undefined as visible (default true)', () => {
    const visible = filterClientVisibleTasks(tasks);
    expect(visible.map(t => t.id)).toContain('t3');
  });

  it('returns empty array when all tasks are hidden', () => {
    const allHidden: Task[] = tasks.map(t => ({ ...t, visibleToClient: false }));
    expect(filterClientVisibleTasks(allHidden)).toHaveLength(0);
  });

  it('returns all tasks when all are visible', () => {
    const allVisible: Task[] = tasks.map(t => ({ ...t, visibleToClient: true }));
    expect(filterClientVisibleTasks(allVisible)).toHaveLength(tasks.length);
  });

  it('handles empty task list', () => {
    expect(filterClientVisibleTasks([])).toEqual([]);
  });

  it('does not mutate the original array', () => {
    const original = [...tasks];
    filterClientVisibleTasks(tasks);
    expect(tasks).toHaveLength(original.length);
  });
});

// ─── Phase derivation after filter ───────────────────────────────────────────

describe('Phase visibility after task filter', () => {
  it('phases with all tasks hidden disappear from sidebar', () => {
    const visible = filterClientVisibleTasks(tasks);
    const phases  = deriveVisiblePhaseNames(visible);
    // Site Preparation (t2) and Framing (t4) are hidden
    expect(phases).not.toContain('Site Preparation');
    expect(phases).not.toContain('Framing');
  });

  it('phases with at least one visible task appear', () => {
    const visible = filterClientVisibleTasks(tasks);
    const phases  = deriveVisiblePhaseNames(visible);
    expect(phases).toContain('Pre-Construction');
    expect(phases).toContain('Foundation');
    expect(phases).toContain('Roofing');
  });

  it('empty schedule → no phases → shows empty state', () => {
    const visible = filterClientVisibleTasks(tasks.map(t => ({ ...t, visibleToClient: false })));
    expect(deriveVisiblePhaseNames(visible)).toHaveLength(0);
  });

  it('no duplicate phase names even when multiple tasks in same phase', () => {
    const samePhaseTasks: Task[] = [
      { ...tasks[0], id: 'a', visibleToClient: true },
      { ...tasks[0], id: 'b', visibleToClient: true },
    ];
    const phases = deriveVisiblePhaseNames(filterClientVisibleTasks(samePhaseTasks));
    expect(phases).toHaveLength(1);
  });
});

// ─── M2-T2: Tooltip excludes work type ───────────────────────────────────────

describe('M2-T2 — buildTooltipLines (no work type shown)', () => {
  it('does not include Subcontractor label for subcontractor task', () => {
    const lines = buildTooltipLines(tasks[1]); // Site Preparation, workType: subcontractor
    expect(lines.join(' ')).not.toContain('Subcontractor');
    expect(lines.join(' ')).not.toContain('subcontractor');
  });

  it('does not include In-House label for in-house task', () => {
    const lines = buildTooltipLines(tasks[0]); // Pre-Construction, workType: in-house
    expect(lines.join(' ')).not.toContain('In-House');
    expect(lines.join(' ')).not.toContain('in-house');
  });

  it('shows category name', () => {
    const lines = buildTooltipLines(tasks[0]);
    expect(lines).toContain('Pre-Construction');
  });

  it('shows date and duration', () => {
    const lines = buildTooltipLines(tasks[0]);
    expect(lines.some(l => l.includes('2d') || l.includes('2026-04-07'))).toBe(true);
  });

  it('shows ✓ Completed for completed tasks', () => {
    const lines = buildTooltipLines(tasks[4]); // Roofing, completed: true
    expect(lines).toContain('✓ Completed');
  });

  it('does not show Completed line for incomplete tasks', () => {
    const lines = buildTooltipLines(tasks[0]); // Pre-Construction, completed: undefined
    expect(lines).not.toContain('✓ Completed');
  });

  it('shows notes when visibleToClient is not false', () => {
    const lines = buildTooltipLines(tasks[4]); // Roofing, visibleToClient: true, notes set
    expect(lines).toContain('Client-safe note');
  });

  it('hides notes when visibleToClient is false', () => {
    const taskWithNotes: Task = { ...tasks[1], notes: 'Internal only' };
    const lines = buildTooltipLines(taskWithNotes);
    expect(lines).not.toContain('Internal only');
  });
});

// ─── M2-T1: Pill data excludes employee/sub details ──────────────────────────

describe('M2-T1 — buildClientPillData (no staff details)', () => {
  it('does not expose assignedEmployeeIds', () => {
    const pill = buildClientPillData(tasks[0]);
    expect((pill as any).assignedEmployeeIds).toBeUndefined();
  });

  it('does not expose assignedSubcontractorIds', () => {
    const pill = buildClientPillData(tasks[1]);
    expect((pill as any).assignedSubcontractorIds).toBeUndefined();
  });

  it('includes category, duration, completed', () => {
    const pill = buildClientPillData(tasks[4]);
    expect(pill.category).toBe('Roofing');
    expect(pill.duration).toBe(1);
    expect(pill.completed).toBe(true);
  });

  it('completed defaults to false when undefined', () => {
    const pill = buildClientPillData(tasks[0]);
    expect(pill.completed).toBe(false);
  });
});

// ─── Integration: full client view filter flow ────────────────────────────────

describe('Integration — client view full filter flow', () => {
  it('visible task count is correct after filter', () => {
    // t1 (true), t2 (false), t3 (undefined=visible), t4 (false), t5 (true)
    const visible = filterClientVisibleTasks(tasks);
    expect(visible).toHaveLength(3); // t1, t3, t5
  });

  it('hidden subcontractor task not in visible phases', () => {
    const visible = filterClientVisibleTasks(tasks);
    const phases  = deriveVisiblePhaseNames(visible);
    // t2 is subcontractor + hidden — Site Preparation must not appear
    expect(phases).not.toContain('Site Preparation');
  });

  it('tooltip for visible subcontractor task shows no work type', () => {
    const visible = filterClientVisibleTasks(tasks);
    const subTask = visible.find(t => t.workType === 'subcontractor')!;
    expect(subTask).toBeDefined();
    const lines = buildTooltipLines(subTask);
    expect(lines.join(' ')).not.toMatch(/subcontractor|Subcontractor|In-House/i);
  });

  it('pill data for visible tasks has no staff info', () => {
    const visible = filterClientVisibleTasks(tasks);
    visible.forEach(task => {
      const pill = buildClientPillData(task);
      expect((pill as any).assignedEmployeeIds).toBeUndefined();
      expect((pill as any).assignedSubcontractorIds).toBeUndefined();
    });
  });
});
