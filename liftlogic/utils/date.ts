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
