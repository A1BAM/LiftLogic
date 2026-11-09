const dateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric', month: '2-digit', day: '2-digit'
});

/** Returns a stable key for the calendar day in the user's local timezone. */
export function getLocalDateKey(timestamp: number): string {
  return dateKeyFormatter.format(timestamp);
}

export function getLocalDayBounds(timestamp = Date.now()): { start: number; end: number } {
  const date = new Date(timestamp);
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
  return { start, end };
}

/**
 * How long ago a day was, in the words you would actually use: "today",
 * "yesterday", "4 days ago". Counts calendar days, not elapsed hours, so a
 * session at 11pm and one at 1am read as different days.
 */
export function daysAgoLabel(timestamp: number, now = Date.now()): string {
  const { start: todayStart } = getLocalDayBounds(now);
  const { start: thenStart } = getLocalDayBounds(timestamp);
  const days = Math.round((todayStart - thenStart) / 86400000);

  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'last week';
  return `${Math.floor(days / 7)} weeks ago`;
}
