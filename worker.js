// worker.js
// Web Worker per la generazione dinamica della topologia e risoluzione via backtracking search.

importScripts("config.js");


let dictionary = null;
let wordScores = {};
let dictionaryKeys = {};

// Struttura dati Trie per l'indicizzazione efficiente
class TrieNode {
  constructor() {
    this.children = {};
    this.isWord = false;
  }
}

let trieRoots = {}; // Una radice ad albero per ogni lunghezza di parola

function insertWord(word, length) {
  if (!trieRoots[length]) trieRoots[length] = new TrieNode();
  let node = trieRoots[length];
  for (let char of word) {
    if (!node.children[char]) node.children[char] = new TrieNode();
    node = node.children[char];
  }
  node.isWord = true;
}

self.onmessage = function (e) {
  // CORREZIONE 1: Estraiamo anche rows e cols inviati da app.js
  const { action, template, dict, rows, cols } = e.data;

  if (action === "init") {
    dictionary = dict;
    wordScores = {};
    dictionaryKeys = {};
    trieRoots = {};

    for (const len in dictionary) {
      const lengthInt = parseInt(len);
      // Pre-calculate scores
      for (const word in dictionary[len]) {
        wordScores[word] = calculateWordScore(word, lengthInt);
      }

      // Sort words by score descending
      const sortedWords = Object.keys(dictionary[len]).sort((a, b) => wordScores[b] - wordScores[a]);
      dictionaryKeys[len] = sortedWords;

      // Insert into Trie in sorted order (so high scoring letter paths are traversed first)
      for (const word of sortedWords) {
        insertWord(word, lengthInt);
      }
    }
    self.postMessage({ status: "ready" });
    return;
  }

  if (action === "generate") {
    if (!dictionary) {
      self.postMessage({ status: "error", message: "Dictionary not initialized" });
      return;
    }

    try {
      let actualTemplate = template;

      // Se non viene passato un template precompilato, lo generiamo proceduralmente
      if (!actualTemplate && rows && cols) {
        actualTemplate = generateGridTopology(rows, cols);
      }

      if (!actualTemplate) {
        self.postMessage({ status: "error", message: "Impossibile generare o ricevere una topologia valida." });
        return;
      }

      const result = generateCrossword(actualTemplate);
      if (result) {
        self.postMessage({ status: "success", result });
      } else {
        self.postMessage({ status: "failed" });
      }
    } catch (err) {
      self.postMessage({ status: "error", message: err.toString() });
    }
  }
};

// Generatore procedurale di geometrie simmetriche con vincoli gaussiani
function generateGridTopology(rows, cols) {
  let bestGrid = null;
  let bestScore = -Infinity;
  const maxAttempts = CRUCIGEN_CONFIG.gridTopologyCandidates || 300;

  for (let i = 0; i < maxAttempts; i++) {
    let grid = Array(rows).fill(null).map(() => Array(cols).fill(' '));

    // Target ideale di caselle nere usando la configurazione globale
    const blackSquareTarget = Math.floor((rows * cols) * CRUCIGEN_CONFIG.blackSquareTargetMultiplier);
    let blackSquares = 0;

    while (blackSquares < blackSquareTarget) {
      let r = Math.floor(Math.random() * rows);
      let c = Math.floor(Math.random() * cols);

      if (grid[r][c] === ' ') {
        grid[r][c] = '#';
        // Applica simmetria rotazionale speculare a 180° (Stile classico)
        if (grid[rows - 1 - r][cols - 1 - c] === ' ') {
          grid[rows - 1 - r][cols - 1 - c] = '#';
          blackSquares++;
        }
        blackSquares++;
      }
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] === ' ') {
          let isH1 = (c === 0 || grid[r][c - 1] === '#') && (c === cols - 1 || grid[r][c + 1] === '#');
          let isV1 = (r === 0 || grid[r - 1][c] === '#') && (r === rows - 1 || grid[r + 1][c] === '#');

          // AND Logico: Ripara solo se è un quadrato bianco intrappolato ovunque
          if (isH1 && isV1) {
            grid[r][c] = '#';
          }
        }
      }
    }

    let score = evaluateGridFitness(grid, rows, cols);
    if (score > bestScore) {
      bestScore = score;
      bestGrid = grid;
    }
  }
  return bestGrid;
}

// CORREZIONE 3: Logica completa di valutazione della griglia (Gaussiana + Flood Fill di connettività)
function evaluateGridFitness(grid, rows, cols) {
  const lengthScores = CRUCIGEN_CONFIG.lengthScores;

  let score = 0;
  let totalWhiteCells = 0;
  let firstWhite = null;

  // Analisi slot Orizzontali
  for (let r = 0; r < rows; r++) {
    let len = 0;
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === ' ') {
        len++;
        totalWhiteCells++;
        if (!firstWhite) firstWhite = { r, c };
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

  // FLOOD FILL / BFS: Verifica che la griglia non abbia "isole" di lettere isolate
  let visitedCount = 0;
  let visited = Array(rows).fill(null).map(() => Array(cols).fill(false));
  let queue = [firstWhite];
  visited[firstWhite.r][firstWhite.c] = true;

  while (queue.length > 0) {
    let { r, c } = queue.shift();
    visitedCount++;

    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (let [dr, dc] of dirs) {
      let nr = r + dr;
      let nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        if (grid[nr][nc] === ' ' && !visited[nr][nc]) {
          visited[nr][nc] = true;
          queue.push({ r: nr, c: nc });
        }
      }
    }
  }

  // Se alcune caselle bianche rimangono isolate dal resto del flusso, penalizzazione massima
  if (visitedCount < totalWhiteCells) {
    return -Infinity;
  }

  return score;
}

function generateCrossword(template) {
  const rows = template.length;
  const cols = template[0].length;

  const grid = [];
  for (let r = 0; r < rows; r++) {
    grid.push([]);
    for (let c = 0; c < cols; c++) {
      grid[r].push(template[r][c] === '#' ? '#' : ' ');
    }
  }

  const slots = [];
  let nextNumber = 1;
  const numberGrid = Array(rows).fill(null).map(() => Array(cols).fill(null));

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === '#') continue;

      const isHStart = (c === 0 || grid[r][c - 1] === '#') && (c + 1 < cols && grid[r][c + 1] !== '#');
      const isVStart = (r === 0 || grid[r - 1][c] === '#') && (r + 1 < rows && grid[r + 1][c] !== '#');

      if (isHStart || isVStart) {
        numberGrid[r][c] = nextNumber++;
      }

      if (isHStart) {
        const cells = [];
        let cc = c;
        while (cc < cols && grid[r][cc] !== '#') {
          cells.push([r, cc]);
          cc++;
        }
        slots.push({
          id: `H_${numberGrid[r][c]}`,
          num: numberGrid[r][c],
          direction: "H",
          length: cells.length,
          cells: cells,
          word: null
        });
      }

      if (isVStart) {
        const cells = [];
        let rr = r;
        while (rr < rows && grid[rr][c] !== '#') {
          cells.push([rr, c]);
          rr++;
        }
        slots.push({
          id: `V_${numberGrid[r][c]}`,
          num: numberGrid[r][c],
          direction: "V",
          length: cells.length,
          cells: cells,
          word: null
        });
      }
    }
  }

  slots.forEach(slot => {
    slot.patternIndices = slot.cells.map(([r, c]) => ({ r, c }));
  });

  let steps = 0;
  // Soglia di passi dinamica in base alle dimensioni della griglia
  const sizeKey = Math.max(rows, cols);
  const maxSteps = (CRUCIGEN_CONFIG.maxStepsBySize && CRUCIGEN_CONFIG.maxStepsBySize[sizeKey]) || 3000;
  const usedWords = new Set();

  function solve(slotIndex) {
    steps++;
    if (steps > maxSteps) return false;
    if (slotIndex === slots.length) return true;

    // Seleziona lo slot usando MRV (Minimum Remaining Values) + Tie-break basato sul grado di incastro
    let bestIdx = -1;
    let minCandidates = Infinity;
    let maxDegree = -1;
    let bestCandidates = [];

    for (let i = slotIndex; i < slots.length; i++) {
      const slot = slots[i];
      let pattern = "";
      let emptyIntersections = 0;

      for (const { r, c } of slot.patternIndices) {
        const char = grid[r][c];
        pattern += char;
        if (char === ' ') emptyIntersections++;
      }

      const candidates = getCandidates(slot.length, pattern);
      if (candidates.length === 0) return false;

      if (candidates.length < minCandidates) {
        minCandidates = candidates.length;
        bestIdx = i;
        bestCandidates = candidates;
        maxDegree = emptyIntersections;
      } else if (candidates.length === minCandidates) {
        if (emptyIntersections > maxDegree) {
          bestIdx = i;
          bestCandidates = candidates;
          maxDegree = emptyIntersections;
        }
      }
    }

    if (bestIdx === -1) return false;

    const temp = slots[slotIndex];
    slots[slotIndex] = slots[bestIdx];
    slots[bestIdx] = temp;

    const currentSlot = slots[slotIndex];

    // Optimization: Since the candidates list is already pre-sorted by score (descending),
    // we only need to sort the top candidates defined by candidateJitterWindow with a random jitter to maintain high speed.
    const jitterWindow = CRUCIGEN_CONFIG.candidateJitterWindow || 50;
    if (bestCandidates.length > jitterWindow) {
      const topPart = bestCandidates.slice(0, jitterWindow);
      topPart.sort((a, b) => (wordScores[b] + Math.random() * 3) - (wordScores[a] + Math.random() * 3));
      bestCandidates = topPart.concat(bestCandidates.slice(jitterWindow));
    } else {
      bestCandidates.sort((a, b) => (wordScores[b] + Math.random() * 3) - (wordScores[a] + Math.random() * 3));
    }

    for (const candidate of bestCandidates) {
      if (usedWords.has(candidate)) continue;

      usedWords.add(candidate);
      currentSlot.word = candidate;

      const oldChars = [];
      for (let j = 0; j < currentSlot.length; j++) {
        const { r, c } = currentSlot.patternIndices[j];
        oldChars.push(grid[r][c]);
        grid[r][c] = candidate[j];
      }

      if (solve(slotIndex + 1)) return true;
      if (steps > maxSteps) return false;

      usedWords.delete(candidate);
      currentSlot.word = null;
      for (let j = 0; j < currentSlot.length; j++) {
        const { r, c } = currentSlot.patternIndices[j];
        grid[r][c] = oldChars[j];
      }
    }

    const tempBack = slots[slotIndex];
    slots[slotIndex] = slots[bestIdx];
    slots[bestIdx] = tempBack;

    return false;
  }

  // Ricerca dei candidati con pattern matching integrato direttamente nell'albero Trie O(L)
  function getCandidates(len, pattern) {
    const root = trieRoots[len];
    if (!root) return [];

    const results = [];

    function search(node, index, currentWord) {
      if (index === len) {
        if (node.isWord) results.push(currentWord);
        return;
      }

      const char = pattern[index];
      if (char === ' ') {
        for (const letter in node.children) {
          search(node.children[letter], index + 1, currentWord + letter);
        }
      } else {
        if (node.children[char]) {
          search(node.children[char], index + 1, currentWord + char);
        }
      }
    }

    search(root, 0, "");
    return results;
  }

  slots.sort((a, b) => b.length - a.length);
  const solved = solve(0);
  if (!solved) return null;

  const solution = grid.map(row => row.join(''));
  const horizontalClues = [];
  const verticalClues = [];

  slots.forEach(slot => {
    const dictInfo = dictionary[slot.length.toString()][slot.word];
    const clueText = dictInfo ? dictInfo[0] : "Nessuna definizione disponibile.";
    const originalWord = dictInfo ? dictInfo[1] : slot.word.toLowerCase();

    const clueObj = {
      num: slot.num,
      word: slot.word,
      originalWord: originalWord,
      clue: clueText,
      row: slot.cells[0][0],
      col: slot.cells[0][1],
      length: slot.length
    };

    if (slot.direction === "H") {
      horizontalClues.push(clueObj);
    } else {
      verticalClues.push(clueObj);
    }
  });

  horizontalClues.sort((a, b) => a.num - b.num);
  verticalClues.sort((a, b) => a.num - b.num);

  return {
    solution,
    numberGrid,
    horizontalClues,
    verticalClues,
    gridSize: { rows, cols },
    steps
  };
}

// CORREZIONE 2: Sintassi della funzione ripulita dai log spuri della console
function calculateWordScore(word, len) {
  let score = 0;
  const vowels = (word.match(/[AEIOU]/g) || []).length;
  const vowelRatio = vowels / len;

  if (vowelRatio >= 0.4 && vowelRatio <= 0.6) {
    score += 15;
  } else if (vowelRatio >= 0.3 && vowelRatio <= 0.7) {
    score += 5;
  }

  const uniqueLetters = new Set(word).size;
  score += (uniqueLetters / len) * 10;
  return score;
}