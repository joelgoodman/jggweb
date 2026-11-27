import { describe, it, expect } from 'vitest';
import { calendarDate } from '../src/core/fields';

describe('calendarDate', () => {
  it('keeps a date-only value', () => expect(calendarDate('2024-02-22')).toBe('2024-02-22'));
  it('gives the writer’s local date for a date and time', () => {
    const local = new Date(2024, 1, 22, 23, 30);
    expect(calendarDate(local.toISOString())).toBe('2024-02-22');
    expect(calendarDate(new Date(2024, 1, 22, 0, 15).toISOString())).toBe('2024-02-22');
  });
  it('gives today’s local date for an empty or unreadable value', () => {
    const now = new Date(2024, 1, 22, 23, 59);
    expect(calendarDate('', now)).toBe('2024-02-22');
    expect(calendarDate('soon', now)).toBe('2024-02-22');
  });
});
