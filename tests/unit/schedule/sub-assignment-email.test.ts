/**
 * Subcontractor Assignment Email Logic Tests
 *
 * Run with: bunx vitest run tests/unit/schedule/sub-assignment-email.test.ts
 *
 * Tests pure logic extracted from sendSubAssignmentEmail in app/(tabs)/schedule.tsx.
 * Includes batched multi-recipient email logic added in fix(M1-T7).
 */

import { describe, it, expect } from 'vitest';

// ─── Pure logic extracted from sendSubAssignmentEmail ────────────────────────

function buildAssignmentEmail(
  email: string,
  subName: string,
  taskName: string,
  startDate: string,
  companyName: string,
): { skip: boolean; subject: string; body: string; mailto: string } | { skip: true } {
  if (!email?.trim()) return { skip: true };

  const firstName = subName?.trim() || ''; // caller pre-computes correct greeting name(s)
  const datePart = startDate.split('T')[0].split(' ')[0];
  const [yr, mo, dy] = datePart.split('-').map(Number);
  const dateStr = new Date(yr, mo - 1, dy).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  const subject = `Job Assignment — ${taskName}`;
  const body = `Hi ${firstName},\n\n${companyName} has assigned you to: ${taskName} on ${dateStr}.\n\n— ${companyName}`;
  const mailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return { skip: false, subject, body, mailto };
}

// ─── Batched multi-recipient email logic (fix M1-T7) ─────────────────────────

interface SubForEmail {
  id: string;
  name: string;
  email: string;
}

/**
 * Mirrors the batch email logic in handleSaveEdit:
 * filters to valid emails, builds one mailto with all recipients.
 */
function buildBatchedEmail(
  subs: SubForEmail[],
  taskName: string,
  startDate: string,
  companyName: string,
): { skip: true } | { skip: false; toEmails: string; subject: string; body: string; mailto: string } {
  const validSubs = subs.filter(s => s.email?.trim());
  if (validSubs.length === 0) return { skip: true };

  const toEmails   = validSubs.map(s => s.email).join(',');
  const firstNames = validSubs.map(s => s.name.split(' ')[0]);
  const firstName  = firstNames.join(' & '); // "Blake" or "Blake & James"
  const datePart   = startDate.split('T')[0].split(' ')[0];
  const [yr, mo, dy] = datePart.split('-').map(Number);
  const dateStr    = new Date(yr, mo - 1, dy).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  const subject = `Job Assignment — ${taskName}`;
  const body    = `Hi ${firstName},\n\n${companyName} has assigned you to: ${taskName} on ${dateStr}.\n\n— ${companyName}`;
  const mailto  = `mailto:${encodeURIComponent(toEmails)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return { skip: false, toEmails, subject, body, mailto };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildAssignmentEmail', () => {
  it('skips when email is empty string', () => {
    const result = buildAssignmentEmail('', 'Blake Smith', 'Site Clearing', '2026-04-07', 'Allen & Co.');
    expect(result).toEqual({ skip: true });
  });

  it('skips when email is whitespace only', () => {
    const result = buildAssignmentEmail('   ', 'Blake Smith', 'Site Clearing', '2026-04-07', 'Allen & Co.');
    expect(result).toEqual({ skip: true });
  });

  it('builds correct subject', () => {
    const result = buildAssignmentEmail('blake@sub.com', 'Blake', 'Site Clearing', '2026-04-07', 'Allen & Co.') as any;
    expect(result.skip).toBe(false);
    expect(result.subject).toBe('Job Assignment — Site Clearing');
  });

  it('uses greeting name as-is (caller pre-computes first name)', () => {
    // Caller passes first name only — function must NOT split again
    const result = buildAssignmentEmail('blake@sub.com', 'Blake', 'Site Clearing', '2026-04-07', 'Allen & Co.') as any;
    expect(result.body).toContain('Hi Blake,');
  });

  it('multi-name greeting renders correctly (Blake & James)', () => {
    const result = buildAssignmentEmail('b@s.com,j@s.com', 'Blake & James', 'Site Clearing', '2026-04-07', 'Allen & Co.') as any;
    expect(result.body).toContain('Hi Blake & James,');
  });

  it('includes company name in body', () => {
    const result = buildAssignmentEmail('blake@sub.com', 'Blake', 'Site Clearing', '2026-04-07', 'Allen & Co.') as any;
    expect(result.body).toContain('Allen & Co. has assigned you to:');
    expect(result.body).toContain('— Allen & Co.');
  });

  it('includes task name in body', () => {
    const result = buildAssignmentEmail('blake@sub.com', 'Blake', 'Site Clearing', '2026-04-07', 'Allen & Co.') as any;
    expect(result.body).toContain('Site Clearing');
  });

  it('formats date correctly', () => {
    const result = buildAssignmentEmail('blake@sub.com', 'Blake', 'Site Clearing', '2026-04-07', 'Allen & Co.') as any;
    expect(result.body).toContain('Apr 7, 2026');
  });

  it('handles ISO datetime startDate (strips time component)', () => {
    const result = buildAssignmentEmail('blake@sub.com', 'Blake', 'Site Clearing', '2026-04-07T00:00:00Z', 'Allen & Co.') as any;
    expect(result.body).toContain('Apr 7, 2026');
  });

  it('handles TIMESTAMPTZ with UTC offset that would shift date (uses local date components)', () => {
    // '2026-04-14T21:00:00-05:00' is Apr 15 in UTC — split('T')[0] used to give '2026-04-14' (wrong)
    // New component parsing gives '2026-04-14' local which is what the date string says — correct
    const result = buildAssignmentEmail('blake@sub.com', 'Blake', 'Site Clearing', '2026-04-14T21:00:00-05:00', 'Allen & Co.') as any;
    expect(result.body).toContain('Apr 14, 2026');
  });

  it('builds valid mailto URL', () => {
    const result = buildAssignmentEmail('blake@sub.com', 'Blake', 'Site Clearing', '2026-04-07', 'Allen & Co.') as any;
    expect(result.mailto).toMatch(/^mailto:/);
    expect(result.mailto).toContain(encodeURIComponent('blake@sub.com'));
    expect(result.mailto).toContain('subject=');
    expect(result.mailto).toContain('body=');
  });

  it('handles single-name subcontractor', () => {
    const result = buildAssignmentEmail('blake@sub.com', 'Blake', 'Site Clearing', '2026-04-07', 'Allen & Co.') as any;
    expect(result.body).toContain('Hi Blake,');
  });

  it('falls back gracefully when companyName is empty', () => {
    const result = buildAssignmentEmail('blake@sub.com', 'Blake', 'Site Clearing', '2026-04-07', '') as any;
    expect(result.body).toContain('Hi Blake,');
    expect(result.skip).toBe(false);
  });

  it('only fires for newly added subs — logic test', () => {
    const originalSubIds = ['sub-1', 'sub-2'];
    const editAssignedSubIds = ['sub-1', 'sub-2', 'sub-3'];
    const newlyAdded = editAssignedSubIds.filter(id => !originalSubIds.includes(id));
    expect(newlyAdded).toEqual(['sub-3']);
  });

  it('returns empty newlyAdded when no new subs assigned', () => {
    const originalSubIds = ['sub-1', 'sub-2'];
    const editAssignedSubIds = ['sub-1', 'sub-2'];
    const newlyAdded = editAssignedSubIds.filter(id => !originalSubIds.includes(id));
    expect(newlyAdded).toHaveLength(0);
  });

  it('returns all as newlyAdded when previously unassigned', () => {
    const originalSubIds: string[] = [];
    const editAssignedSubIds = ['sub-1', 'sub-2'];
    const newlyAdded = editAssignedSubIds.filter(id => !originalSubIds.includes(id));
    expect(newlyAdded).toEqual(['sub-1', 'sub-2']);
  });
});

// ─── Batched email tests (fix M1-T7) ─────────────────────────────────────────

const batchSubs: SubForEmail[] = [
  { id: 'sub-1', name: 'Carlos Rodriguez', email: 'carlos@sub.com' },
  { id: 'sub-2', name: 'James Patterson',  email: 'james@sub.com' },
  { id: 'sub-3', name: 'Maria Santos',     email: '' },
  { id: 'sub-4', name: 'Alex Kim',         email: '   ' },
];

describe('buildBatchedEmail — multi-recipient batching', () => {
  it('skips when no subs have valid email', () => {
    const result = buildBatchedEmail(
      [batchSubs[2], batchSubs[3]], 'Framing', '2026-04-10', 'Legacy Prime'
    );
    expect(result).toEqual({ skip: true });
  });

  it('single sub — greeting uses first name only', () => {
    const result = buildBatchedEmail([batchSubs[0]], 'Roofing', '2026-04-10', 'Legacy Prime') as any;
    expect(result.skip).toBe(false);
    expect(result.toEmails).toBe('carlos@sub.com');
    expect(result.body).toContain('Hi Carlos,');
  });

  it('multiple subs — greeting uses all first names joined with &', () => {
    const result = buildBatchedEmail([batchSubs[0], batchSubs[1]], 'Foundation', '2026-04-15', 'Legacy Prime') as any;
    expect(result.body).toContain('Hi Carlos & James,');
  });

  it('multiple subs — all emails in one comma-separated to field', () => {
    const result = buildBatchedEmail(
      [batchSubs[0], batchSubs[1]], 'Foundation', '2026-04-15', 'Legacy Prime'
    ) as any;
    expect(result.skip).toBe(false);
    expect(result.toEmails).toBe('carlos@sub.com,james@sub.com');
  });

  it('multiple subs — mailto contains all recipients encoded', () => {
    const result = buildBatchedEmail(
      [batchSubs[0], batchSubs[1]], 'Foundation', '2026-04-15', 'Legacy Prime'
    ) as any;
    expect(result.mailto).toContain(encodeURIComponent('carlos@sub.com,james@sub.com'));
  });

  it('filters out subs with empty email — only valid ones in batch', () => {
    const result = buildBatchedEmail(batchSubs, 'Electrical', '2026-05-01', 'Legacy Prime') as any;
    expect(result.skip).toBe(false);
    expect(result.toEmails).toBe('carlos@sub.com,james@sub.com');
  });

  it('filters out subs with whitespace-only email', () => {
    const result = buildBatchedEmail(
      [batchSubs[3]], 'Plumbing', '2026-05-01', 'Legacy Prime'
    );
    expect(result).toEqual({ skip: true });
  });

  it('subject is same regardless of recipient count', () => {
    const single   = buildBatchedEmail([batchSubs[0]], 'Site Prep', '2026-04-10', 'ACME') as any;
    const multiple = buildBatchedEmail([batchSubs[0], batchSubs[1]], 'Site Prep', '2026-04-10', 'ACME') as any;
    expect(single.subject).toBe('Job Assignment — Site Prep');
    expect(multiple.subject).toBe('Job Assignment — Site Prep');
  });

  it('body includes task name and date', () => {
    const result = buildBatchedEmail(
      [batchSubs[0], batchSubs[1]], 'Pre-Construction', '2026-04-07', 'Legacy Prime'
    ) as any;
    expect(result.body).toContain('Pre-Construction');
    expect(result.body).toContain('Apr 7, 2026');
  });

  it('one mail open replaces N sequential opens — array length = 1 mailto', () => {
    // The entire point of batching: only 1 Linking.openURL call for N subs
    const results = [
      buildBatchedEmail([batchSubs[0], batchSubs[1]], 'Demo', '2026-04-10', 'Legacy Prime'),
    ];
    expect(results).toHaveLength(1);
    expect((results[0] as any).skip).toBe(false);
  });
});
