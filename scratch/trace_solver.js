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

// Generate one 9x9 topology
const topology = generateGridTopology(9, 9);
console.log("Generated Topology:");
console.log(topology.map(row => row.join(' ')).join('\n'));

// Let's modify generateCrossword to trace search
const oldGenerate = generateCrossword;

// Let's run the solver and see if it fails
const start = Date.now();
const result = generateCrossword(topology, "easy");
const elapsed = Date.now() - start;

if (result) {
  console.log(`Success in ${elapsed}ms! Steps: ${result.steps}`);
} else {
  console.log(`FAILED in ${elapsed}ms!`);
}
