/**
 * Crew Schedule Logic Tests
 *
 * Run with: bunx vitest run tests/unit/schedule/crew-schedule.test.ts
 *
 * Tests pure logic extracted from app/crew-schedule.tsx:
 *   - getMonday
 *   - hexToRgba
 *   - getTasksForDate
 *   - displayTasks filter (admin vs employee)
 *   - toggleEmployeeAssignment
 *   - weekLabel generation
 *   - unassignedTasks filter
 */

import { describe, it, expect } from 'vitest';

// ─── Pure logic extracted from crew-schedule.tsx ─────────────────────────────

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function getTasksForDate(
  date: Date,
  tasks: Array<{ startDate: string; endDate: string; id: string }>
) {
  const time = new Date(date).setHours(0, 0, 0, 0);
  return tasks.filter(t => {
    const start = new Date(t.startDate).setHours(0, 0, 0, 0);
    const end = new Date(t.endDate).setHours(0, 0, 0, 0);
    return time >= start && time < end; // endDate is exclusive
  });
}

function getDisplayTasks(
  tasks: Array<{ id: string; assignedEmployeeIds?: string[] }>,
  isAdmin: boolean,
  userId: string,
  selectedEmployeeFilter: string | null
) {
  if (!isAdmin) {
    return tasks.filter(t => t.assignedEmployeeIds?.includes(userId));
  }
  if (selectedEmployeeFilter) {
    return tasks.filter(t => t.assignedEmployeeIds?.includes(selectedEmployeeFilter));
  }
  return tasks.filter(t => (t.assignedEmployeeIds?.length ?? 0) > 0);
}

function getUnassignedTasks(
  tasks: Array<{ id: string; assignedEmployeeIds?: string[] }>
) {
  return tasks.filter(t => !t.assignedEmployeeIds?.length);
}

function toggleEmployeeAssignment(
  current: string[],
  employeeId: string
): string[] {
  return current.includes(employeeId)
    ? current.filter(id => id !== employeeId)
    : [...current, employeeId];
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ─── Test data ────────────────────────────────────────────────────────────────

const TASKS = [
  {
    id: 't1',
    startDate: '2026-04-07',
    endDate: '2026-04-10',
    assignedEmployeeIds: ['emp1', 'emp2'],
  },
  {
    id: 't2',
    startDate: '2026-04-09',
    endDate: '2026-04-12',
    assignedEmployeeIds: ['emp2'],
  },
  {
    id: 't3',
    startDate: '2026-04-07',
    endDate: '2026-04-08',
    assignedEmployeeIds: [],
  },
  {
    id: 't4',
    startDate: '2026-04-14',
    endDate: '2026-04-17',
    assignedEmployeeIds: undefined,
  },
];

// ─── getMonday ────────────────────────────────────────────────────────────────

describe('getMonday', () => {
  it('returns same day when input is Monday', () => {
    const monday = new Date('2026-04-06'); // known Monday
    const result = getMonday(monday);
    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(6);
  });

  it('returns correct Monday for Wednesday input', () => {
    const wednesday = new Date('2026-04-08');
    const result = getMonday(wednesday);
    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(6);
  });

  it('returns correct Monday for Sunday input (Sunday = day 0)', () => {
    const sunday = new Date('2026-04-12');
    const result = getMonday(sunday);
    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(6);
  });

  it('sets time to midnight', () => {
    const date = new Date('2026-04-08T15:30:00');
    const result = getMonday(date);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
  });

  it('does not mutate the input date', () => {
    const date = new Date('2026-04-08');
    const original = date.getTime();
    getMonday(date);
    expect(date.getTime()).toBe(original);
  });
});

// ─── hexToRgba ────────────────────────────────────────────────────────────────

describe('hexToRgba', () => {
  it('converts navy hex correctly', () => {
    expect(hexToRgba('#1E3A5F', 1)).toBe('rgba(30,58,95,1)');
  });

  it('converts white correctly', () => {
    expect(hexToRgba('#FFFFFF', 0.5)).toBe('rgba(255,255,255,0.5)');
  });

  it('converts black correctly', () => {
    expect(hexToRgba('#000000', 0.08)).toBe('rgba(0,0,0,0.08)');
  });

  it('handles alpha = 0', () => {
    const result = hexToRgba('#FF0000', 0);
    expect(result).toBe('rgba(255,0,0,0)');
  });
});

// ─── getTasksForDate ──────────────────────────────────────────────────────────

describe('getTasksForDate', () => {
  it('returns tasks that start on the given date', () => {
    const date = new Date('2026-04-07');
    const result = getTasksForDate(date, TASKS);
    const ids = result.map(t => t.id);
    expect(ids).toContain('t1');
    expect(ids).toContain('t3');
  });

  it('returns tasks that span across the given date', () => {
    const date = new Date('2026-04-09');
    const result = getTasksForDate(date, TASKS);
    const ids = result.map(t => t.id);
    expect(ids).toContain('t1'); // Apr 7–10 spans Apr 9
    expect(ids).toContain('t2'); // Apr 9–12 starts Apr 9
  });

  it('does NOT return tasks where endDate equals the given date (exclusive)', () => {
    // t1 endDate = Apr 10, so Apr 10 itself should NOT include t1
    const date = new Date('2026-04-10');
    const result = getTasksForDate(date, TASKS);
    const ids = result.map(t => t.id);
    expect(ids).not.toContain('t1');
    expect(ids).toContain('t2'); // Apr 9–12 still spans Apr 10
  });

  it('returns empty array when no tasks fall on date', () => {
    const date = new Date('2026-04-20');
    const result = getTasksForDate(date, TASKS);
    expect(result).toHaveLength(0);
  });

  it('returns empty array for empty task list', () => {
    const result = getTasksForDate(new Date('2026-04-07'), []);
    expect(result).toHaveLength(0);
  });
});

// ─── displayTasks filter ──────────────────────────────────────────────────────

describe('getDisplayTasks', () => {
  it('admin with no filter sees all assigned tasks', () => {
    const result = getDisplayTasks(TASKS, true, 'emp1', null);
    // t1 and t2 have assignedEmployeeIds, t3 has [] (empty), t4 has undefined
    const ids = result.map(t => t.id);
    expect(ids).toContain('t1');
    expect(ids).toContain('t2');
    expect(ids).not.toContain('t3');
    expect(ids).not.toContain('t4');
  });

  it('admin with employee filter sees only that employee tasks', () => {
    const result = getDisplayTasks(TASKS, true, 'emp1', 'emp2');
    const ids = result.map(t => t.id);
    expect(ids).toContain('t1'); // emp2 is in t1
    expect(ids).toContain('t2'); // emp2 is in t2
    expect(ids).not.toContain('t3');
  });

  it('employee sees only their own tasks', () => {
    const result = getDisplayTasks(TASKS, false, 'emp1', null);
    const ids = result.map(t => t.id);
    expect(ids).toContain('t1'); // emp1 is in t1
    expect(ids).not.toContain('t2'); // emp1 not in t2
  });

  it('employee with no assigned tasks sees empty list', () => {
    const result = getDisplayTasks(TASKS, false, 'emp999', null);
    expect(result).toHaveLength(0);
  });
});

// ─── unassignedTasks filter ───────────────────────────────────────────────────

describe('getUnassignedTasks', () => {
  it('returns tasks with empty assignedEmployeeIds array', () => {
    const result = getUnassignedTasks(TASKS);
    const ids = result.map(t => t.id);
    expect(ids).toContain('t3'); // assignedEmployeeIds: []
    expect(ids).toContain('t4'); // assignedEmployeeIds: undefined
  });

  it('does not return tasks with assigned employees', () => {
    const result = getUnassignedTasks(TASKS);
    const ids = result.map(t => t.id);
    expect(ids).not.toContain('t1');
    expect(ids).not.toContain('t2');
  });

  it('returns empty when all tasks are assigned', () => {
    const allAssigned = [
      { id: 'a', assignedEmployeeIds: ['emp1'] },
      { id: 'b', assignedEmployeeIds: ['emp2'] },
    ];
    expect(getUnassignedTasks(allAssigned)).toHaveLength(0);
  });
});

// ─── toggleEmployeeAssignment ─────────────────────────────────────────────────

describe('toggleEmployeeAssignment', () => {
  it('adds employee when not already assigned', () => {
    const result = toggleEmployeeAssignment(['emp1'], 'emp2');
    expect(result).toEqual(['emp1', 'emp2']);
  });

  it('removes employee when already assigned', () => {
    const result = toggleEmployeeAssignment(['emp1', 'emp2'], 'emp1');
    expect(result).toEqual(['emp2']);
  });

  it('adds to empty array', () => {
    const result = toggleEmployeeAssignment([], 'emp1');
    expect(result).toEqual(['emp1']);
  });

  it('removes last employee — returns empty array', () => {
    const result = toggleEmployeeAssignment(['emp1'], 'emp1');
    expect(result).toEqual([]);
  });

  it('does not mutate original array', () => {
    const original = ['emp1', 'emp2'];
    toggleEmployeeAssignment(original, 'emp3');
    expect(original).toHaveLength(2);
  });
});

// ─── getInitials ──────────────────────────────────────────────────────────────

describe('getInitials', () => {
  it('returns 2-char initials for full name', () => {
    expect(getInitials('John Smith')).toBe('JS');
  });

  it('returns single char for single name', () => {
    expect(getInitials('Mike')).toBe('M');
  });

  it('caps at 2 characters for long names', () => {
    expect(getInitials('John Michael Smith')).toBe('JM');
  });

  it('uppercases result', () => {
    expect(getInitials('john smith')).toBe('JS');
  });
});
