const logs = [];
for (let i = 0; i < 5000; i++) {
  logs.push({
    id: `log-${i}`,
    exerciseId: `ex-${i % 20}`,
    timestamp: Date.now() - i * 1000 * 60 * 60,
    weight: 100,
    reps: 10
  });
}

const exerciseIds = Array.from({ length: 20 }, (_, i) => `ex-${i}`);

function getLogsForExercise_Original(id, logs) {
  return logs.filter(l => l.exerciseId === id).sort((a, b) => b.timestamp - a.timestamp);
}

const start = performance.now();
for (let j = 0; j < 100; j++) {
  exerciseIds.forEach(id => {
    getLogsForExercise_Original(id, logs);
  });
}
const end = performance.now();
console.log(`Original: ${(end - start).toFixed(2)}ms`);

// Mocking the Map optimization
const logsByExercise = new Map();
logs.forEach(log => {
  if (!logsByExercise.has(log.exerciseId)) logsByExercise.set(log.exerciseId, []);
  logsByExercise.get(log.exerciseId).push(log);
});
logsByExercise.forEach(list => list.sort((a, b) => b.timestamp - a.timestamp));

function getLogsForExercise_Optimized(id, logsByExercise) {
  return logsByExercise.get(id) || [];
}

const startOpt = performance.now();
for (let j = 0; j < 100; j++) {
  exerciseIds.forEach(id => {
    getLogsForExercise_Optimized(id, logsByExercise);
  });
}
const endOpt = performance.now();
console.log(`Optimized: ${(endOpt - startOpt).toFixed(2)}ms`);
console.log(`Improvement: ${( (end - start) / (endOpt - startOpt) ).toFixed(2)}x faster`);
