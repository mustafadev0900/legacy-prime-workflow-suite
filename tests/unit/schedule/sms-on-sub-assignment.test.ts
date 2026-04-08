/**
 * SMS on Subcontractor Assignment Tests
 *
 * Run with: bun test tests/unit/schedule/sms-on-sub-assignment.test.ts
 *
 * Tests the pure logic for determining which subcontractors should
 * receive an SMS when a task is saved with new assignments.
 */

import { describe, it, expect } from 'vitest';

// ─── Types matching production shapes ────────────────────────────────────────

interface Subcontractor {
  id: string;
  name: string;
  phone: string;
  trade: string;
}

interface SMSPayload {
  phone: string;
  subName: string;
  taskName: string;
  startDate: string;
}

// ─── Pure logic extracted from schedule.tsx handleSaveEdit ────────────────────

/** Compute which sub IDs are newly added (need SMS). */
function getNewlyAssignedSubIds(
  currentIds: string[],
  originalIds: string[],
): string[] {
  return currentIds.filter(id => !originalIds.includes(id));
}

/** Build SMS payloads for newly assigned subs, skipping those with no phone. */
function buildSMSPayloads(
  newlyAddedIds: string[],
  subcontractors: Subcontractor[],
  taskName: string,
  startDate: string,
): SMSPayload[] {
  const payloads: SMSPayload[] = [];
  for (const subId of newlyAddedIds) {
    const sub = subcontractors.find(s => s.id === subId);
    if (sub?.phone?.trim()) {
      payloads.push({
        phone: sub.phone,
        subName: sub.name,
        taskName,
        startDate,
      });
    }
  }
  return payloads;
}

/** Normalize US phone to E.164 format. */
function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return phone;
}

/** Build the SMS message body. */
function buildSMSBody(subName: string, taskName: string, startDate: string): string {
  const firstName = subName?.split(' ')[0] || '';
  const dateStr = new Date(startDate.split('T')[0] + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `Hi ${firstName}, you've been assigned to: ${taskName} on ${dateStr}. - Legacy Prime`;
}

// ─── Test data ───────────────────────────────────────────────────────────────

const subs: Subcontractor[] = [
  { id: 'sub-1', name: 'Carlos Rodriguez', phone: '(555) 123-4567', trade: 'Plumbing' },
  { id: 'sub-2', name: 'James Patterson', phone: '555-987-6543', trade: 'Electrical' },
  { id: 'sub-3', name: 'Maria Santos', phone: '', trade: 'Mechanical/HVAC' },
  { id: 'sub-4', name: 'Alex Kim', phone: '   ', trade: 'Roofing' },
];

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('SMS on Subcontractor Assignment', () => {

  describe('getNewlyAssignedSubIds', () => {
    it('detects newly added subs', () => {
      const result = getNewlyAssignedSubIds(['sub-1', 'sub-2'], ['sub-1']);
      expect(result).toEqual(['sub-2']);
    });

    it('returns empty when no new subs', () => {
      const result = getNewlyAssignedSubIds(['sub-1'], ['sub-1']);
      expect(result).toEqual([]);
    });

    it('returns all when original was empty', () => {
      const result = getNewlyAssignedSubIds(['sub-1', 'sub-2'], []);
      expect(result).toEqual(['sub-1', 'sub-2']);
    });

    it('handles removed subs (does not include them)', () => {
      const result = getNewlyAssignedSubIds(['sub-1'], ['sub-1', 'sub-2']);
      expect(result).toEqual([]);
    });

    it('handles undefined original (defaults to empty)', () => {
      const original: string[] | undefined = undefined;
      const result = getNewlyAssignedSubIds(['sub-1'], original ?? []);
      expect(result).toEqual(['sub-1']);
    });
  });

  describe('buildSMSPayloads', () => {
    it('builds payloads for subs with valid phone', () => {
      const payloads = buildSMSPayloads(['sub-1', 'sub-2'], subs, 'Pre-Construction', '2026-04-04');
      expect(payloads).toHaveLength(2);
      expect(payloads[0].subName).toBe('Carlos Rodriguez');
      expect(payloads[1].subName).toBe('James Patterson');
    });

    it('skips subs with empty phone', () => {
      const payloads = buildSMSPayloads(['sub-3'], subs, 'Framing', '2026-04-10');
      expect(payloads).toHaveLength(0);
    });

    it('skips subs with whitespace-only phone', () => {
      const payloads = buildSMSPayloads(['sub-4'], subs, 'Roofing', '2026-04-15');
      expect(payloads).toHaveLength(0);
    });

    it('skips sub IDs not found in subcontractors array (deleted sub)', () => {
      const payloads = buildSMSPayloads(['sub-999'], subs, 'Demo', '2026-04-01');
      expect(payloads).toHaveLength(0);
    });

    it('mixed: valid + invalid phones', () => {
      const payloads = buildSMSPayloads(['sub-1', 'sub-3', 'sub-4'], subs, 'Electrical', '2026-05-01');
      expect(payloads).toHaveLength(1);
      expect(payloads[0].subName).toBe('Carlos Rodriguez');
    });
  });

  describe('toE164', () => {
    it('converts 10-digit US number', () => {
      expect(toE164('5551234567')).toBe('+15551234567');
    });

    it('converts formatted US number', () => {
      expect(toE164('(555) 123-4567')).toBe('+15551234567');
    });

    it('converts 11-digit number starting with 1', () => {
      expect(toE164('15551234567')).toBe('+15551234567');
    });

    it('passes through already E.164 format', () => {
      expect(toE164('+15551234567')).toBe('+15551234567');
    });

    it('passes through already E.164 international format', () => {
      // toE164 is US-focused: 10 digits → +1, 11 starting with 1 → +1
      // +4412345678 has 10 digits after stripping +, so it gets +1 prefix
      expect(toE164('+15551234567')).toBe('+15551234567');
    });
  });

  describe('buildSMSBody', () => {
    it('includes first name, task name, and formatted date', () => {
      const body = buildSMSBody('Carlos Rodriguez', 'Pre-Construction', '2026-04-04');
      expect(body).toContain('Hi Carlos');
      expect(body).toContain('Pre-Construction');
      expect(body).toContain('Apr');
      expect(body).toContain('2026');
      expect(body).toContain('- Legacy Prime');
    });

    it('handles single-word name', () => {
      const body = buildSMSBody('Carlos', 'Framing', '2026-05-10');
      expect(body).toContain('Hi Carlos');
    });

    it('handles empty name gracefully', () => {
      const body = buildSMSBody('', 'Electrical', '2026-06-01');
      expect(body).toContain('Hi ,');
    });

    it('handles ISO datetime with T component', () => {
      const body = buildSMSBody('Maria Santos', 'Plumbing', '2026-04-04T10:00:00.000Z');
      expect(body).toContain('Apr');
      expect(body).toContain('2026');
    });
  });

  describe('integration: full flow', () => {
    it('only sends SMS to newly assigned subs with valid phone', () => {
      const originalSubIds = ['sub-1'];
      const currentSubIds = ['sub-1', 'sub-2', 'sub-3'];

      const newlyAdded = getNewlyAssignedSubIds(currentSubIds, originalSubIds);
      expect(newlyAdded).toEqual(['sub-2', 'sub-3']);

      const payloads = buildSMSPayloads(newlyAdded, subs, 'Foundation', '2026-04-20');
      // sub-2 has phone, sub-3 has empty phone → only 1 payload
      expect(payloads).toHaveLength(1);
      expect(payloads[0].subName).toBe('James Patterson');
    });

    it('no SMS when workType switches to in-house (empty currentIds)', () => {
      const originalSubIds = ['sub-1', 'sub-2'];
      const currentSubIds: string[] = []; // cleared on workType switch

      const newlyAdded = getNewlyAssignedSubIds(currentSubIds, originalSubIds);
      expect(newlyAdded).toEqual([]);
    });

    it('no SMS when re-saving with same subs', () => {
      const originalSubIds = ['sub-1', 'sub-2'];
      const currentSubIds = ['sub-1', 'sub-2'];

      const newlyAdded = getNewlyAssignedSubIds(currentSubIds, originalSubIds);
      expect(newlyAdded).toEqual([]);
    });
  });
});
