import { isDateOnly } from './fields';

/**
 * An entry's date as the list shows it, e.g. `Jan 12, 2026`: a date and time on
 * the local day, a date-only value as written (it parses as UTC midnight, which
 * is the day before west of UTC).
 */
export function formatDate(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: isDateOnly(iso) ? 'UTC' : undefined,
  });
}
