/**
 * Module 3 Extension — Office/Business Clock-In unit tests
 * Run with: bun run tests/module3-clock-office.test.ts
 *
 * Tests pure logic for:
 *   - Active entry detection (project vs office mode)
 *   - One-active-entry-at-a-time conflict check
 *   - Clock-in payload validation (projectId OR officeRole required)
 *   - "In office" count for dashboard badge
 *   - Category list selection (construction vs office)
 */

// ---------------------------------------------------------------------------
// Types (inlined)
// ---------------------------------------------------------------------------

interface MockClockEntry {
  id: string;
  employeeId: string;
  projectId?: string;
  officeRole?: string;
  clockIn: string;
  clockOut?: string;
}

// ---------------------------------------------------------------------------
// Pure logic extracted from clock.tsx / ClockInOutComponent.tsx
// ---------------------------------------------------------------------------

function findActiveProjectEntry(entries: MockClockEntry[], employeeId: string, projectId: string): MockClockEntry | undefined {
  return entries.find(e => e.employeeId === employeeId && e.projectId === projectId && !e.clockOut);
}

function findActiveOfficeEntry(entries: MockClockEntry[], employeeId: string, officeRole: string): MockClockEntry | undefined {
  return entries.find(e => e.employeeId === employeeId && e.officeRole === officeRole && !e.clockOut);
}

function isAlreadyClockedIn(entries: MockClockEntry[], employeeId: string): boolean {
  return entries.some(e => e.employeeId === employeeId && !e.clockOut);
}

function getInOfficeCount(entries: MockClockEntry[]): number {
  return entries.filter(e => e.officeRole && !e.clockOut).length;
}

function validateClockInPayload(payload: { companyId?: string; employeeId?: string; projectId?: string; officeRole?: string }): { valid: boolean; reason?: string } {
  if (!payload.companyId || !payload.employeeId) return { valid: false, reason: 'Missing companyId or employeeId' };
  if (!payload.projectId && !payload.officeRole) return { valid: false, reason: 'Must provide either projectId or officeRole' };
  return { valid: true };
}

const WORK_CATEGORIES = ['Framing', 'Drywall', 'Electrical', 'Plumbing', 'Painting', 'Flooring', 'Roofing', 'HVAC', 'Carpentry', 'Concrete', 'Demolition', 'Site Work', 'General Labor', 'Other'];
const OFFICE_CATEGORIES = ['Admin Work', 'Client Meeting', 'Bookkeeping', 'Sales Call', 'Planning', 'Correspondence', 'HR / Payroll', 'Other'];

function getCategoriesForMode(isOfficeMode: boolean): string[] {
  return isOfficeMode ? OFFICE_CATEGORIES : WORK_CATEGORIES;
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

type Row = { section: string; scenario: string; result: string; ok: boolean };
const rows: Row[] = [];
let currentSection = '';
let passed = 0;
let failed = 0;

function section(name: string) { currentSection = name; }

function test(name: string, fn: () => void) {
  try {
    fn();
    rows.push({ section: currentSection, scenario: name, result: '✓ Pass', ok: true });
    passed++;
  } catch (e: any) {
    rows.push({ section: currentSection, scenario: name, result: `✗ FAIL: ${e.message}`, ok: false });
    failed++;
  }
}

function expect(actual: any) {
  return {
    toBe(expected: any) {
      if (actual !== expected)
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy, got ${JSON.stringify(actual)}`);
    },
    toBeFalsy() {
      if (actual) throw new Error(`Expected falsy, got ${JSON.stringify(actual)}`);
    },
    toBe_defined() {
      if (actual === undefined) throw new Error('Expected defined, got undefined');
    },
    toBeUndefined() {
      if (actual !== undefined) throw new Error(`Expected undefined, got ${JSON.stringify(actual)}`);
    },
  };
}

function printTable() {
  const COL1 = 70;
  const COL2 = 17;
  const hr    = `├${'─'.repeat(COL1 + 2)}┼${'─'.repeat(COL2 + 2)}┤`;
  const hrTop = `┌${'─'.repeat(COL1 + 2)}┬${'─'.repeat(COL2 + 2)}┐`;
  const hrBot = `└${'─'.repeat(COL1 + 2)}┴${'─'.repeat(COL2 + 2)}┘`;
  const hrSec = `├${'═'.repeat(COL1 + 2)}╪${'═'.repeat(COL2 + 2)}┤`;
  const pad   = (s: string, w: number) => s.length >= w ? s.slice(0, w) : s + ' '.repeat(w - s.length);
  const row   = (a: string, b: string) => `│ ${pad(a, COL1)} │ ${pad(b, COL2)} │`;

  console.log('\n' + hrTop);
  console.log(row('Scenario', 'Result'));
  let lastSection = '';
  for (const r of rows) {
    if (r.section !== lastSection) {
      console.log(hrSec);
      console.log(row(`[ ${r.section} ]`, ''));
      console.log(hr);
      lastSection = r.section;
    } else {
      console.log(hr);
    }
    console.log(row(r.scenario, r.result));
  }
  console.log(hrBot);
  console.log(`\n  ${passed} passed, ${failed} failed\n`);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USER_A = 'user-aaa';
const USER_B = 'user-bbb';
const PROJECT_1 = 'proj-111';
const PROJECT_2 = 'proj-222';

const makeEntry = (id: string, employeeId: string, opts: Partial<MockClockEntry> = {}): MockClockEntry => ({
  id, employeeId, clockIn: '2026-04-14T09:00:00Z', ...opts,
});

// ---------------------------------------------------------------------------
// SECTION 1: Active entry detection — project mode
// ---------------------------------------------------------------------------

section('ACTIVE ENTRY DETECTION — Project mode');

const entries_proj: MockClockEntry[] = [
  makeEntry('e1', USER_A, { projectId: PROJECT_1 }),               // open
  makeEntry('e2', USER_A, { projectId: PROJECT_2, clockOut: '2026-04-14T17:00:00Z' }), // closed
  makeEntry('e3', USER_B, { projectId: PROJECT_1 }),               // other user
];

test('Finds open entry for correct user + project', () =>
  expect(findActiveProjectEntry(entries_proj, USER_A, PROJECT_1)?.id).toBe('e1'));

test('Returns undefined for closed entry', () =>
  expect(findActiveProjectEntry(entries_proj, USER_A, PROJECT_2)).toBeUndefined());

test('Does not match other user\'s entry', () =>
  expect(findActiveProjectEntry(entries_proj, USER_A, PROJECT_1)?.employeeId).toBe(USER_A));

test('Returns undefined when no entries at all', () =>
  expect(findActiveProjectEntry([], USER_A, PROJECT_1)).toBeUndefined());

// ---------------------------------------------------------------------------
// SECTION 2: Active entry detection — office mode
// ---------------------------------------------------------------------------

section('ACTIVE ENTRY DETECTION — Office mode');

const entries_office: MockClockEntry[] = [
  makeEntry('o1', USER_A, { officeRole: 'Bookkeeper' }),             // open
  makeEntry('o2', USER_A, { officeRole: 'Accountant', clockOut: '2026-04-14T17:00:00Z' }), // closed
  makeEntry('o3', USER_B, { officeRole: 'Bookkeeper' }),             // other user
];

test('Finds open office entry for correct user + role', () =>
  expect(findActiveOfficeEntry(entries_office, USER_A, 'Bookkeeper')?.id).toBe('o1'));

test('Returns undefined for closed office entry', () =>
  expect(findActiveOfficeEntry(entries_office, USER_A, 'Accountant')).toBeUndefined());

test('Does not match different role', () =>
  expect(findActiveOfficeEntry(entries_office, USER_A, 'Sales')).toBeUndefined());

test('Does not match other user\'s office entry', () =>
  expect(findActiveOfficeEntry(entries_office, USER_A, 'Bookkeeper')?.employeeId).toBe(USER_A));

// ---------------------------------------------------------------------------
// SECTION 3: Conflict check — already clocked in
// ---------------------------------------------------------------------------

section('CONFLICT CHECK — One active entry at a time');

const entries_mix: MockClockEntry[] = [
  makeEntry('m1', USER_A, { projectId: PROJECT_1 }),
  makeEntry('m2', USER_B, { officeRole: 'Sales', clockOut: '2026-04-14T17:00:00Z' }),
];

test('User A is already clocked in (project entry open)', () =>
  expect(isAlreadyClockedIn(entries_mix, USER_A)).toBe(true));

test('User B is NOT clocked in (only closed entry)', () =>
  expect(isAlreadyClockedIn(entries_mix, USER_B)).toBe(false));

test('Empty entries → not clocked in', () =>
  expect(isAlreadyClockedIn([], USER_A)).toBe(false));

test('User with only closed entries → not clocked in', () => {
  const closed = [makeEntry('c1', USER_A, { projectId: PROJECT_1, clockOut: '2026-04-14T17:00:00Z' })];
  expect(isAlreadyClockedIn(closed, USER_A)).toBe(false);
});

// ---------------------------------------------------------------------------
// SECTION 4: API validation
// ---------------------------------------------------------------------------

section('API VALIDATION — projectId OR officeRole required');

test('Missing both projectId and officeRole → INVALID', () =>
  expect(validateClockInPayload({ companyId: 'c1', employeeId: 'u1' }).valid).toBe(false));

test('Has projectId, no officeRole → VALID', () =>
  expect(validateClockInPayload({ companyId: 'c1', employeeId: 'u1', projectId: PROJECT_1 }).valid).toBe(true));

test('Has officeRole, no projectId → VALID', () =>
  expect(validateClockInPayload({ companyId: 'c1', employeeId: 'u1', officeRole: 'Bookkeeper' }).valid).toBe(true));

test('Has both projectId and officeRole → VALID (API accepts, DB will store both)', () =>
  expect(validateClockInPayload({ companyId: 'c1', employeeId: 'u1', projectId: PROJECT_1, officeRole: 'Bookkeeper' }).valid).toBe(true));

test('Missing companyId → INVALID', () =>
  expect(validateClockInPayload({ employeeId: 'u1', projectId: PROJECT_1 }).valid).toBe(false));

test('Missing employeeId → INVALID', () =>
  expect(validateClockInPayload({ companyId: 'c1', projectId: PROJECT_1 }).valid).toBe(false));

test('Empty payload → INVALID', () =>
  expect(validateClockInPayload({}).valid).toBe(false));

// ---------------------------------------------------------------------------
// SECTION 5: In-office count for dashboard badge
// ---------------------------------------------------------------------------

section('IN-OFFICE COUNT — Dashboard badge');

const entries_count: MockClockEntry[] = [
  makeEntry('i1', USER_A, { officeRole: 'Bookkeeper' }),              // in office open
  makeEntry('i2', USER_B, { officeRole: 'Sales' }),                   // in office open
  makeEntry('i3', 'user-ccc', { officeRole: 'Accountant', clockOut: '2026-04-14T17:00:00Z' }), // clocked out
  makeEntry('i4', 'user-ddd', { projectId: PROJECT_1 }),              // project entry, not office
];

test('Counts only open office entries', () =>
  expect(getInOfficeCount(entries_count)).toBe(2));

test('All clocked out → count is 0', () => {
  const allOut = [makeEntry('x1', USER_A, { officeRole: 'Sales', clockOut: '2026-04-14T17:00:00Z' })];
  expect(getInOfficeCount(allOut)).toBe(0);
});

test('Empty entries → count is 0', () =>
  expect(getInOfficeCount([])).toBe(0));

test('Only project entries → count is 0', () => {
  const projOnly = [makeEntry('p1', USER_A, { projectId: PROJECT_1 })];
  expect(getInOfficeCount(projOnly)).toBe(0);
});

// ---------------------------------------------------------------------------
// SECTION 6: Category list by mode
// ---------------------------------------------------------------------------

section('CATEGORY LIST — Construction vs Office');

test('Project mode → returns construction categories', () =>
  expect(getCategoriesForMode(false).includes('Framing')).toBe(true));

test('Project mode → does not include office categories', () =>
  expect(getCategoriesForMode(false).includes('Bookkeeping')).toBe(false));

test('Office mode → returns office categories', () =>
  expect(getCategoriesForMode(true).includes('Bookkeeping')).toBe(true));

test('Office mode → does not include construction categories', () =>
  expect(getCategoriesForMode(true).includes('Framing')).toBe(false));

test('Both modes include "Other"', () => {
  expect(getCategoriesForMode(false).includes('Other')).toBe(true);
  expect(getCategoriesForMode(true).includes('Other')).toBe(true);
});

// ---------------------------------------------------------------------------

printTable();
if (failed > 0) process.exit(1);
