const fs = require('fs');
const content = fs.readFileSync('liftlogic/hooks/useWorkoutData.ts', 'utf-8');
console.log(`Lines: ${content.split('\n').length}`);
