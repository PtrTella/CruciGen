// scratch/test_math.js
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../src/js/config.js');
const configContent = fs.readFileSync(configPath, 'utf8');

// Load config by evaluating the file content in local context
eval(configContent + '; global.CRUCIGEN_CONFIG = CRUCIGEN_CONFIG;');

console.log("=== TESTING MATHEMATICAL CONFIG FUNCTIONS ===");

const sizes = [9, 11, 13, 15];
const difficulties = ['easy', 'medium', 'hard'];

console.log("\n--- getBacktrackingSteps ---");
sizes.forEach(size => {
  difficulties.forEach(diff => {
    const steps = CRUCIGEN_CONFIG.getBacktrackingSteps(size, diff);
    console.log(`Size: ${size}, Difficulty: ${diff} => Steps: ${steps}`);
  });
});

console.log("\n--- getBlackSquarePercent ---");
sizes.forEach(size => {
  difficulties.forEach(diff => {
    const percent = CRUCIGEN_CONFIG.getBlackSquarePercent(size, diff);
    console.log(`Size: ${size}, Difficulty: ${diff} => Percent: ${(percent * 100).toFixed(2)}% (${percent})`);
  });
});

console.log("\n--- Validation Tests ---");
try {
  CRUCIGEN_CONFIG.getBacktrackingSteps(9, 'invalid_diff');
  console.error("FAIL: Expected getBacktrackingSteps to throw on invalid difficulty");
} catch (e) {
  console.log(`PASS: getBacktrackingSteps threw expected error: ${e.message}`);
}

try {
  CRUCIGEN_CONFIG.getBlackSquarePercent(9, 'invalid_diff');
  console.error("FAIL: Expected getBlackSquarePercent to throw on invalid difficulty");
} catch (e) {
  console.log(`PASS: getBlackSquarePercent threw expected error: ${e.message}`);
}

console.log("\n=== ALL MATH CONFIG TESTS COMPLETED ===");
