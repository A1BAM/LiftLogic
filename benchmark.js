const importedLogs = Array.from({ length: 50 }).map((_, i) => ({ id: i }));

async function mockFetch() {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (Math.random() < 0.1) reject(new Error('Network error'));
      else resolve();
    }, 50); // 50ms per fetch
  });
}

async function runSequential() {
    let errorCount = 0;
    const start = performance.now();
    for (const log of importedLogs) {
      try {
        await mockFetch();
      } catch (e) {
        errorCount++;
      }
    }
    return { time: performance.now() - start, errors: errorCount };
}

async function runParallel() {
    let errorCount = 0;
    const start = performance.now();
    const results = await Promise.allSettled(importedLogs.map(log => mockFetch()));
    for (const result of results) {
        if (result.status === 'rejected') {
            errorCount++;
        }
    }
    return { time: performance.now() - start, errors: errorCount };
}

async function benchmark() {
    console.log("Running Sequential benchmark...");
    const seq = await runSequential();
    console.log(`Sequential: ${seq.time.toFixed(2)}ms, Errors: ${seq.errors}`);

    console.log("Running Parallel benchmark...");
    const par = await runParallel();
    console.log(`Parallel: ${par.time.toFixed(2)}ms, Errors: ${par.errors}`);
}
benchmark();
