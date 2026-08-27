const dateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric', month: '2-digit', day: '2-digit'
});

// Cache formatted local date keys to avoid repeated expensive Intl.DateTimeFormat formatting operations
const dateKeyCache = new Map<string, string>();
const MAX_CACHE_SIZE = 500;

/** Returns a stable key for the calendar day in the user's local timezone. */
export function getLocalDateKey(timestamp: number): string {
  const d = new Date(timestamp);
  const cacheKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  let formatted = dateKeyCache.get(cacheKey);
  if (!formatted) {
    if (dateKeyCache.size >= MAX_CACHE_SIZE) {
      dateKeyCache.clear();
    }
    formatted = dateKeyFormatter.format(timestamp);
    dateKeyCache.set(cacheKey, formatted);
  }
  return formatted;
}

// Cached day bounds to eliminate repeated Date allocations on consecutive calls for the same day
let cachedBounds: { start: number; end: number } | null = null;

export function getLocalDayBounds(timestamp = Date.now()): { start: number; end: number } {
  // Fast path: reuse cached day bounds if timestamp falls within the cached day range
  if (
    cachedBounds &&
    timestamp >= cachedBounds.start &&
    timestamp < cachedBounds.end
  ) {
    return cachedBounds;
  }

  const date = new Date(timestamp);
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();

  cachedBounds = { start, end };
  return cachedBounds;
}
