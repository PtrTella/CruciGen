const fs = require('fs');
const path = require('path');

global.self = global;

const dictionaryPath = '/Users/tella/Workspace/CruciGen/src/assets/dictionary.json';
const dictionary = JSON.parse(fs.readFileSync(dictionaryPath, 'utf8'));

global.dictionary = dictionary;
global.wordScores = {};
global.trieRoots = {};

const scripts = [
  'config.js',
  'worker/trie.js',
  'worker/utils.js',
  'worker/generator.js',
  'worker/solver.js'
];
const concatenated = scripts.map(s => fs.readFileSync(path.join('/Users/tella/Workspace/CruciGen/src/js', s), 'utf8')).join('\n');
eval(concatenated);

// Initialize Trie and WordScores
for (const len in dictionary) {
  const lengthInt = parseInt(len);
  for (const word in dictionary[len]) {
    wordScores[word] = calculateWordScore(word, lengthInt);
  }
  const sortedWords = Object.keys(dictionary[len]).sort((a, b) => wordScores[b] - wordScores[a]);
  for (const word of sortedWords) {
    insertWord(word, lengthInt);
  }
}

console.log("=== Testing Solver with Calibrated Dictionary ===");
for (const size of [9, 11, 13, 15]) {
  const startTopology = Date.now();
  const topology = generateGridTopology(size, size);
  const timeTopology = Date.now() - startTopology;
  
  if (!topology) {
    console.log(`Size ${size}x${size}: Topology generation returned null!`);
    continue;
  }
  
  let blackCount = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (topology[r][c] === '#') blackCount++;
    }
  }
  
  console.log(`Size ${size}x${size}: Topology generated in ${timeTopology}ms with ${blackCount} black squares`);
  
  const startSolver = Date.now();
  const result = generateCrossword(topology, "easy");
  const timeSolver = Date.now() - startSolver;
  
  if (result) {
    console.log(`Size ${size}x${size}: Solved successfully in ${timeSolver}ms! Steps: ${result.steps} | Difficulty: ${(result.difficulty * 100).toFixed(1)}%`);
  } else {
    console.log(`Size ${size}x${size}: Solving FAILED in ${timeSolver}ms!`);
  }
}
