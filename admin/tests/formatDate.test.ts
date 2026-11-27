import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { formatDate } from '../src/core/entryMeta';

describe('formatDate west of UTC', () => {
  const zone = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = 'America/Los_Angeles';
  });
  afterAll(() => {
    if (zone === undefined) delete process.env.TZ;
    else process.env.TZ = zone;
  });

  it('runs behind UTC', () => expect(new Date('2026-01-12T12:00:00Z').getTimezoneOffset()).toBe(480));
  it('keeps the day of a date-only value', () => expect(formatDate('2026-01-12')).toBe('Jan 12, 2026'));
  it('shows a date and time on the local day', () =>
    expect(formatDate('2026-01-12T03:00:00.000Z')).toBe('Jan 11, 2026'));
  it('shows nothing without a value', () => expect(formatDate(undefined)).toBe(''));
  it('keeps the start of an unreadable value', () => expect(formatDate('sometime soon')).toBe('sometime s'));
});
