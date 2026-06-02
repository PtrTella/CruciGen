// worker.js
// Web Worker for generating the crossword layout using backtracking search.

let dictionary = null;

// Normalizes accented characters (just in case)
function normalizeChar(c) {
  const map = {
    'À':'A','Á':'A','Â':'A','Ä':'A',
    'È':'E','É':'E','Ê':'E','Ë':'E',
    'Ì':'I','Í':'I','Î':'I','Ï':'I',
    'Ò':'O','Ó':'O','Ô':'O','Ö':'O',
    'Ù':'U','Ú':'U','Û':'U','Ü':'U',
    'Ç':'C','Ñ':'N'
  };
  return map[c] || c;
}

self.onmessage = function(e) {
  const { action, template, dict } = e.data;

  if (action === "init") {
    dictionary = dict;
    self.postMessage({ status: "ready" });
    return;
  }

  if (action === "generate") {
    if (!dictionary) {
      self.postMessage({ status: "error", message: "Dictionary not initialized" });
      return;
    }

    try {
      const result = generateCrossword(template);
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

function generateCrossword(template) {
  const rows = template.length;
  const cols = template[0].length;
  
  // 1. Initialize grid state
  const grid = [];
  for (let r = 0; r < rows; r++) {
    grid.push([]);
    for (let c = 0; c < cols; c++) {
      grid[r].push(template[r][c] === '#' ? '#' : ' ');
    }
  }

  // 2. Find slots and assign numbers
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

      // Collect horizontal slot
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

      // Collect vertical slot
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

  // Pre-calculate slot cell indexes for matching patterns
  slots.forEach(slot => {
    slot.patternIndices = slot.cells.map(([r, c]) => ({ r, c }));
  });

  // 3. Backtracking Solver with MRV and Randomization
  let steps = 0;
  const maxSteps = 30000; // Limit steps to avoid hanging
  const usedWords = new Set();

  function solve(slotIndex) {
    steps++;
    if (steps > maxSteps) return false; // Hard cutoff

    if (slotIndex === slots.length) return true;

    // Pick slot with Minimum Remaining Values (MRV) among unfilled slots
    let bestIdx = -1;
    let minCandidates = Infinity;
    let bestCandidates = [];

    for (let i = slotIndex; i < slots.length; i++) {
      const slot = slots[i];
      
      // Get current pattern in the grid for this slot
      let pattern = "";
      for (const { r, c } of slot.patternIndices) {
        pattern += grid[r][c];
      }

      // Find possible candidate words from dictionary
      const candidates = getCandidates(slot.length, pattern);
      if (candidates.length < minCandidates) {
        minCandidates = candidates.length;
        bestIdx = i;
        bestCandidates = candidates;
      }
      if (minCandidates === 0) return false; // Early pruning
    }

    if (bestIdx === -1) return false;

    // Swap best slot to current index
    const temp = slots[slotIndex];
    slots[slotIndex] = slots[bestIdx];
    slots[bestIdx] = temp;

    const currentSlot = slots[slotIndex];
    
    // Shuffle candidates to ensure randomness of the crossword
    shuffle(bestCandidates);

    for (const candidate of bestCandidates) {
      if (usedWords.has(candidate)) continue;

      // Apply choice
      usedWords.add(candidate);
      currentSlot.word = candidate;
      
      // Fill grid
      const oldChars = [];
      for (let j = 0; j < currentSlot.length; j++) {
        const { r, c } = currentSlot.patternIndices[j];
        oldChars.push(grid[r][c]);
        grid[r][c] = candidate[j];
      }

      // Recurse
      if (solve(slotIndex + 1)) return true;

      // Backtrack
      usedWords.delete(candidate);
      currentSlot.word = null;
      for (let j = 0; j < currentSlot.length; j++) {
        const { r, c } = currentSlot.patternIndices[j];
        grid[r][c] = oldChars[j];
      }
    }

    // Restore order of slots on failure
    const tempBack = slots[slotIndex];
    slots[slotIndex] = slots[bestIdx];
    slots[bestIdx] = tempBack;

    return false;
  }

  // Helper to match pattern (e.g. "C A" -> matches "CASA")
  function getCandidates(len, pattern) {
    const lenStr = len.toString();
    if (!dictionary[lenStr]) return [];

    const candidates = [];
    const keys = Object.keys(dictionary[lenStr]);
    
    for (const word of keys) {
      let matches = true;
      for (let i = 0; i < len; i++) {
        if (pattern[i] !== ' ' && pattern[i] !== word[i]) {
          matches = false;
          break;
        }
      }
      if (matches) {
        candidates.push(word);
      }
    }
    return candidates;
  }

  // Shuffle in-place
  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  // Run solver (sort slots by length/intersections initially)
  slots.sort((a, b) => b.length - a.length);

  const solved = solve(0);
  if (!solved) return null;

  // 4. Format the final output
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

  // Sort clues by number
  horizontalClues.sort((a, b) => a.num - b.num);
  verticalClues.sort((a, b) => a.num - b.num);

  return {
    solution,
    numberGrid,
    horizontalClues,
    verticalClues,
    gridSize: { rows, cols }
  };
}
