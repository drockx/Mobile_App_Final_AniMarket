export type CalendarDateLimits = { minDate?: string; maxDate?: string; excludedDays?: readonly number[] };

/** Date-only values use local time so selecting today works across time zones. */
export function calendarDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function parseCalendarDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  return calendarDateKey(date) === value ? date : null;
}

export function isCalendarDateSelectable(value: string, { minDate, maxDate, excludedDays = [] }: CalendarDateLimits): boolean {
  const date = parseCalendarDate(value);
  return !!date && (!minDate || value >= minDate) && (!maxDate || value <= maxDate) && !excludedDays.includes(date.getDay());
}
