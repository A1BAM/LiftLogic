const logs = [];
const now = Date.now();
const startOfToday = new Date().setHours(0, 0, 0, 0);

for (let i = 0; i < 5000; i++) {
  logs.push({
    id: `log-${i}`,
    exerciseId: `ex-${i % 20}`,
    timestamp: now - i * 1000 * 60 * 30, // Every 30 mins, so some are today
    weight: 100,
    reps: 10
  });
}

const exerciseIds = Array.from({ length: 20 }, (_, i) => `ex-${i}`);

function getLogsForExercise_Original(id, logs) {
  return logs.filter(l => l.exerciseId === id).sort((a, b) => b.timestamp - a.timestamp);
}

function getTodaysLogs_Original(id, logs) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfDay = startOfDay + 24 * 60 * 60 * 1000;

  return getLogsForExercise_Original(id, logs)
    .filter(l => l.timestamp >= startOfDay && l.timestamp < endOfDay)
    .reverse();
}

const start = performance.now();
for (let j = 0; j < 100; j++) {
  exerciseIds.forEach(id => {
    getTodaysLogs_Original(id, logs);
  });
}
const end = performance.now();
console.log(`Original getTodaysLogs: ${(end - start).toFixed(2)}ms`);

// Optimized
const logsByExercise = new Map();
logs.forEach(log => {
  if (!logsByExercise.has(log.exerciseId)) logsByExercise.set(log.exerciseId, []);
  logsByExercise.get(log.exerciseId).push(log);
});
logsByExercise.forEach(list => list.sort((a, b) => b.timestamp - a.timestamp));

function getTodaysLogs_Optimized(id, logsByExercise) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfDay = startOfDay + 24 * 60 * 60 * 1000;

  const exerciseLogs = logsByExercise.get(id) || [];
  const results = [];
  // Since exerciseLogs is sorted newest first, we can iterate and stop early
  // Actually, for today's logs we need to check both bounds, but we can definitely stop if we go BEFORE today.
  for (const log of exerciseLogs) {
    if (log.timestamp < startOfDay) break;
    if (log.timestamp < endOfDay) {
      results.push(log);
    }
  }
  return results.reverse();
}

const startOpt = performance.now();
for (let j = 0; j < 100; j++) {
  exerciseIds.forEach(id => {
    getTodaysLogs_Optimized(id, logsByExercise);
  });
}
const endOpt = performance.now();
console.log(`Optimized getTodaysLogs: ${(endOpt - startOpt).toFixed(2)}ms`);
console.log(`Improvement: ${( (end - start) / (endOpt - startOpt) ).toFixed(2)}x faster`);
