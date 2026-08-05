async function saveDefinitionToCloud(exercise) {
  // simulate network request latency of 50ms
  return new Promise(resolve => setTimeout(resolve, 50));
}

async function runSequential(exercises) {
  const start = performance.now();
  // Properly simulate the N+1 pattern which awaits one by one or in a loop
  for (const exercise of exercises) {
    await saveDefinitionToCloud(exercise);
  }
  return performance.now() - start;
}

async function saveDefinitionsToCloud(exercises) {
  // simulate bulk network request latency of 50ms
  return new Promise(resolve => setTimeout(resolve, 50));
}

async function runParallel(exercises) {
  const start = performance.now();
  await saveDefinitionsToCloud(exercises);
  return performance.now() - start;
}

async function main() {
  const exercises = Array(20).fill({ id: 'test' });

  console.log('Running benchmark...');

  const seqTime = await runSequential(exercises);
  console.log(`Sequential baseline: ${seqTime.toFixed(2)}ms`);

  const parTime = await runParallel(exercises);
  console.log(`Parallel optimized: ${parTime.toFixed(2)}ms`);

  console.log(`Improvement: ${(seqTime / parTime).toFixed(2)}x faster`);
}

main();
