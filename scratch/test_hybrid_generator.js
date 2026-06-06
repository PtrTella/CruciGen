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

// Define the hybrid evaluateGridFitness
function evaluateHybridFitness(grid, rows, cols) {
  const lengthScores = CRUCIGEN_CONFIG.lengthScores;

  let score = 0;
  let totalWhiteCells = 0;

  // Analisi slot Orizzontali
  for (let r = 0; r < rows; r++) {
    let len = 0;
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === ' ') {
        len++;
        totalWhiteCells++;
      } else {
        if (len > 0) {
          score += (lengthScores[len] !== undefined ? lengthScores[len] : 0);
          len = 0;
        }
      }
    }
    if (len > 0) score += (lengthScores[len] !== undefined ? lengthScores[len] : 0);
  }

  // Analisi slot Verticali
  for (let c = 0; c < cols; c++) {
    let len = 0;
    for (let r = 0; r < rows; r++) {
      if (grid[r][c] === ' ') {
        len++;
      } else {
        if (len > 0) {
          score += (lengthScores[len] !== undefined ? lengthScores[len] : 0);
          len = 0;
        }
      }
    }
    if (len > 0) score += (lengthScores[len] !== undefined ? lengthScores[len] : 0);
  }

  if (totalWhiteCells === 0) return -Infinity;

  // 1. Penalizzazione per aree interamente bianche (3x3 per 9x9/11x11, 4x4 per griglie superiori)
  const blockSize = rows <= 11 ? 3 : 4;
  let whiteBlockPenalty = 0;
  for (let r = 0; r <= rows - blockSize; r++) {
    for (let c = 0; c <= cols - blockSize; c++) {
      let allWhite = true;
      for (let dr = 0; dr < blockSize; dr++) {
        for (let dc = 0; dc < blockSize; dc++) {
          if (grid[r + dr][c + dc] === '#') {
            allWhite = false;
            break;
          }
        }
        if (!allWhite) break;
      }
      if (allWhite) {
        whiteBlockPenalty += 150; // Aumentiamo la penalizzazione
      }
    }
  }
  score -= whiteBlockPenalty;

  // 2. Penalizzazione per caselle nere sui bordi esterni
  let borderBlackSquares = 0;
  for (let c = 0; c < cols; c++) {
    if (grid[0][c] === '#') borderBlackSquares++;
    if (grid[rows - 1][c] === '#') borderBlackSquares++;
  }
  for (let r = 1; r < rows - 1; r++) {
    if (grid[r][0] === '#') borderBlackSquares++;
    if (grid[r][cols - 1] === '#') borderBlackSquares++;
  }
  score -= borderBlackSquares * 25;

  // 3. Penalizzazione per agglomerati o muri di caselle nere (caselle nere con 2+ vicini neri)
  let blackClumpPenalty = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === '#') {
        let adjacentBlacks = 0;
        const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (let [dr, dc] of dirs) {
          let nr = r + dr;
          let nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc] === '#') {
            adjacentBlacks++;
          }
        }
        if (adjacentBlacks >= 2) {
          blackClumpPenalty += 20 * adjacentBlacks;
        }
      }
    }
  }
  score -= blackClumpPenalty;

  return score;
}

// Custom generateGridTopology using hybrid fitness and incremental candidates
function generateHybridTopology(rows, cols) {
  const maxAttempts = 200; // Generate 200 valid candidates
  let bestGrid = null;
  let bestScore = -Infinity;

  for (let i = 0; i < maxAttempts; i++) {
    const grid = generateSingleTopologyCandidate(rows, cols, 3);
    if (grid) {
      const score = evaluateHybridFitness(grid, rows, cols);
      if (score > bestScore) {
        bestScore = score;
        bestGrid = grid;
      }
    }
  }

  // Fallback if minSlotLength=3 fails
  if (!bestGrid) {
    for (let i = 0; i < maxAttempts; i++) {
      const grid = generateSingleTopologyCandidate(rows, cols, 2);
      if (grid) {
        const score = evaluateHybridFitness(grid, rows, cols);
        if (score > bestScore) {
          bestScore = score;
          bestGrid = grid;
        }
      }
    }
  }

  return bestGrid;
}

console.log("=== Testing Hybrid Generator (Incremental Candidates + Improved Fitness) ===");
for (const size of [9, 11, 13, 15]) {
  console.log(`\n--- Size ${size}x${size} ---`);
  
  const startTopology = Date.now();
  const topology = generateHybridTopology(size, size);
  const timeTopology = Date.now() - startTopology;
  
  if (!topology) {
    console.log("Failed to generate topology");
    continue;
  }
  
  console.log("Topology generated:");
  console.log(topology.map(row => row.join(' ')).join('\n'));
  
  const startSolver = Date.now();
  const result = generateCrossword(topology, "easy");
  const timeSolver = Date.now() - startSolver;
  
  if (result) {
    console.log(`Solved successfully in ${timeSolver}ms! Steps: ${result.steps} | Difficulty: ${(result.difficulty * 100).toFixed(1)}%`);
  } else {
    console.log(`Solving FAILED in ${timeSolver}ms!`);
  }
}
