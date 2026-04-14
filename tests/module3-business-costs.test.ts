/**
 * Module 3 — Business & Overhead Costs unit tests
 * Run with: bun run tests/module3-business-costs.test.ts
 *
 * Tests pure logic extracted from:
 *   - components/CompactBusinessCosts.tsx  (metric calculations)
 *   - api/add-expense.ts                  (validation rules)
 *   - app/(tabs)/expenses.tsx             (isCompanyExpense state logic)
 */

// ---------------------------------------------------------------------------
// Types (inlined — no path-alias required)
// ---------------------------------------------------------------------------

interface MockExpense {
  id: string;
  isCompanyCost: boolean;
  amount: number;
  date: string; // ISO date string
}

// ---------------------------------------------------------------------------
// Pure logic extracted from CompactBusinessCosts.tsx
// ---------------------------------------------------------------------------

function getThisMonthTotal(expenses: MockExpense[], now: Date): number {
  return expenses
    .filter(e => e.isCompanyCost)
    .filter(e => {
      const d = new Date(e.date);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    })
    .reduce((sum, e) => sum + e.amount, 0);
}

function getOverheadPerMonth(expenses: MockExpense[], now: Date): number {
  const businessExpenses = expenses.filter(e => e.isCompanyCost);
  if (businessExpenses.length === 0) return 0;
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const recent = businessExpenses.filter(e => new Date(e.date) >= sixMonthsAgo);
  if (recent.length === 0) return 0;
  const total = recent.reduce((sum, e) => sum + e.amount, 0);
  return total / 6;
}

function getMinMonthly(expenses: MockExpense[]): number {
  const businessExpenses = expenses.filter(e => e.isCompanyCost);
  if (businessExpenses.length === 0) return 0;
  const byMonth: Record<string, number> = {};
  businessExpenses.forEach(e => {
    const d = new Date(e.date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    byMonth[key] = (byMonth[key] || 0) + e.amount;
  });
  const months = Object.values(byMonth);
  return months.length > 0 ? Math.min(...months) : 0;
}

function getRecRate(overheadPerMonth: number, hoursWorked: number): number {
  if (hoursWorked <= 0 || overheadPerMonth <= 0) return 0;
  return overheadPerMonth / hoursWorked;
}

function fmt(n: number): string {
  return n === 0 ? '$0' : `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ---------------------------------------------------------------------------
// Pure logic extracted from add-expense.ts / expenses.tsx validation
// ---------------------------------------------------------------------------

interface ExpensePayload {
  projectId?: string;
  type?: string;
  subcategory?: string;
  amount?: number;
  store?: string;
  isCompanyCost?: boolean;
}

function validateExpensePayload(payload: ExpensePayload): { valid: boolean; reason?: string } {
  const { projectId, type, subcategory, amount, store, isCompanyCost } = payload;
  if ((!projectId && !isCompanyCost) || !type || !subcategory || !amount || !store) {
    return { valid: false, reason: 'Missing required fields' };
  }
  return { valid: true };
}

// ---------------------------------------------------------------------------
// Test runner (same pattern as chatbot-permissions.test.ts)
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
    toBeCloseTo(expected: number, decimals = 2) {
      const factor = Math.pow(10, decimals);
      if (Math.round(actual * factor) !== Math.round(expected * factor))
        throw new Error(`Expected ~${expected}, got ${actual}`);
    },
    toBeGreaterThan(expected: number) {
      if (actual <= expected)
        throw new Error(`Expected ${actual} > ${expected}`);
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
// Fixtures — pinned to April 2026 so tests never drift
// ---------------------------------------------------------------------------

const NOW = new Date('2026-04-14T12:00:00Z');

const makeExpense = (id: string, amount: number, date: string, isCompanyCost = true): MockExpense =>
  ({ id, isCompanyCost, amount, date });

// This month
const APR_1  = makeExpense('e1', 1200, '2026-04-01'); // rent
const APR_2  = makeExpense('e2',  300, '2026-04-10'); // utilities
// Last month
const MAR_1  = makeExpense('e3', 1500, '2026-03-05');
// 5 months ago (within 6-month window)
const NOV_1  = makeExpense('e4', 2000, '2025-11-15');
// 7 months ago (outside 6-month window)
const SEP_1  = makeExpense('e5',  800, '2025-09-01');
// Regular project expense (isCompanyCost = false)
const REG_1  = makeExpense('e6', 9999, '2026-04-05', false);

// ---------------------------------------------------------------------------
// SECTION 1: thisMonthTotal
// ---------------------------------------------------------------------------

section('THIS MONTH TOTAL');

test('Empty expenses → $0', () =>
  expect(getThisMonthTotal([], NOW)).toBe(0));

test('Only regular (non-business) expenses → $0', () =>
  expect(getThisMonthTotal([REG_1], NOW)).toBe(0));

test('Business expense outside current month → $0', () =>
  expect(getThisMonthTotal([MAR_1], NOW)).toBe(0));

test('Single business expense this month → correct amount', () =>
  expect(getThisMonthTotal([APR_1], NOW)).toBe(1200));

test('Multiple business expenses this month → summed correctly', () =>
  expect(getThisMonthTotal([APR_1, APR_2], NOW)).toBe(1500));

test('Mix of business + regular + old expenses → only this-month business counted', () =>
  expect(getThisMonthTotal([APR_1, APR_2, MAR_1, NOV_1, REG_1], NOW)).toBe(1500));

// ---------------------------------------------------------------------------
// SECTION 2: overheadPerMonth (6-month rolling average)
// ---------------------------------------------------------------------------

section('OVERHEAD PER MONTH (6-month avg)');

test('Empty expenses → $0', () =>
  expect(getOverheadPerMonth([], NOW)).toBe(0));

test('All expenses older than 6 months → $0', () =>
  expect(getOverheadPerMonth([SEP_1], NOW)).toBe(0));

test('Only regular (non-business) expenses → $0', () =>
  expect(getOverheadPerMonth([REG_1], NOW)).toBe(0));

test('Single expense within window → total / 6', () =>
  // MAR_1 = $1500, divided by 6 = $250
  expect(getOverheadPerMonth([MAR_1], NOW)).toBeCloseTo(250, 2));

test('Multiple months within window → total / 6', () => {
  // APR_1 ($1200) + APR_2 ($300) + MAR_1 ($1500) + NOV_1 ($2000) = $5000 / 6 ≈ 833.33
  const result = getOverheadPerMonth([APR_1, APR_2, MAR_1, NOV_1], NOW);
  expect(result).toBeCloseTo(833.33, 2);
});

test('Old expense (>6 months) is excluded from average', () => {
  // With SEP_1 excluded: $5000 / 6 ≈ 833.33 (same as above)
  const withOld = getOverheadPerMonth([APR_1, APR_2, MAR_1, NOV_1, SEP_1], NOW);
  const withoutOld = getOverheadPerMonth([APR_1, APR_2, MAR_1, NOV_1], NOW);
  expect(withOld).toBeCloseTo(withoutOld, 2);
});

// ---------------------------------------------------------------------------
// SECTION 3: minMonthly
// ---------------------------------------------------------------------------

section('MIN MONTHLY SPEND');

test('Empty expenses → $0', () =>
  expect(getMinMonthly([])).toBe(0));

test('Only regular (non-business) expenses → $0', () =>
  expect(getMinMonthly([REG_1])).toBe(0));

test('Single month → that month total', () =>
  expect(getMinMonthly([APR_1, APR_2])).toBe(1500));

test('Multiple months → lowest month wins', () => {
  // APR: $1500, MAR: $1500, NOV: $2000, SEP: $800 → min = $800
  expect(getMinMonthly([APR_1, APR_2, MAR_1, NOV_1, SEP_1])).toBe(800);
});

test('Two expenses same month aggregate before comparing', () => {
  // APR: $1200 + $300 = $1500, MAR: $1500 → min = $1500
  expect(getMinMonthly([APR_1, APR_2, MAR_1])).toBe(1500);
});

// ---------------------------------------------------------------------------
// SECTION 4: recRate (Recommended Rate)
// ---------------------------------------------------------------------------

section('RECOMMENDED RATE');

test('hoursWorked = 0 → $0/hr (avoid divide by zero)', () =>
  expect(getRecRate(1000, 0)).toBe(0));

test('overheadPerMonth = 0 → $0/hr', () =>
  expect(getRecRate(0, 160)).toBe(0));

test('Both zero → $0/hr', () =>
  expect(getRecRate(0, 0)).toBe(0));

test('$1600 overhead / 160 hrs → $10/hr', () =>
  expect(getRecRate(1600, 160)).toBeCloseTo(10, 2));

test('$5000 overhead / 80 hrs → $62.50/hr', () =>
  expect(getRecRate(5000, 80)).toBeCloseTo(62.5, 2));

test('Higher hours → lower rate (overhead stays fixed)', () => {
  const low  = getRecRate(3000, 100);
  const high = getRecRate(3000, 200);
  expect(low).toBeGreaterThan(high);
});

// ---------------------------------------------------------------------------
// SECTION 5: Expense validation (isCompanyCost bypass)
// ---------------------------------------------------------------------------

section('EXPENSE VALIDATION — isCompanyCost bypass');

const BASE = { type: 'Materials', subcategory: 'Lumber', amount: 500, store: 'Home Depot' };

test('No projectId, isCompanyCost=false → INVALID (project required)', () =>
  expect(validateExpensePayload({ ...BASE }).valid).toBe(false));

test('No projectId, isCompanyCost=true → VALID (business expense)', () =>
  expect(validateExpensePayload({ ...BASE, isCompanyCost: true }).valid).toBe(true));

test('Has projectId, isCompanyCost=false → VALID (normal project expense)', () =>
  expect(validateExpensePayload({ ...BASE, projectId: 'proj-123' }).valid).toBe(true));

test('Has projectId, isCompanyCost=true → VALID (either condition passes)', () =>
  expect(validateExpensePayload({ ...BASE, projectId: 'proj-123', isCompanyCost: true }).valid).toBe(true));

test('Missing type → INVALID regardless of isCompanyCost', () =>
  expect(validateExpensePayload({ ...BASE, isCompanyCost: true, type: undefined }).valid).toBe(false));

test('Missing subcategory → INVALID', () =>
  expect(validateExpensePayload({ ...BASE, isCompanyCost: true, subcategory: undefined }).valid).toBe(false));

test('Missing amount → INVALID', () =>
  expect(validateExpensePayload({ ...BASE, isCompanyCost: true, amount: undefined }).valid).toBe(false));

test('Missing store → INVALID', () =>
  expect(validateExpensePayload({ ...BASE, isCompanyCost: true, store: undefined }).valid).toBe(false));

test('Completely empty payload → INVALID', () =>
  expect(validateExpensePayload({}).valid).toBe(false));

// ---------------------------------------------------------------------------
// SECTION 6: fmt() display formatting
// ---------------------------------------------------------------------------

section('CURRENCY FORMATTING (fmt)');

test('0 → "$0" (special case, no decimals)', () =>
  expect(fmt(0)).toBe('$0'));

test('1000 → "$1,000"', () =>
  expect(fmt(1000)).toBe('$1,000'));

test('1500.75 rounds to "$1,501"', () =>
  expect(fmt(1500.75)).toBe('$1,501'));

test('10000 → "$10,000"', () =>
  expect(fmt(10000)).toBe('$10,000'));

test('250 → "$250"', () =>
  expect(fmt(250)).toBe('$250'));

// ---------------------------------------------------------------------------

printTable();
if (failed > 0) process.exit(1);
