// Punteggio base della parola (vocale ratio + unicità + difficoltà inversamente pesata)
// Usato per ordinamento in medium mode e fallback pool in easy/hard.
function getBaseScore(word) {
  return wordScores[word] || 0;
}


function generateCrossword(template, targetDifficulty) {
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

    // Swap solo se necessario (evita doppio swap quando bestIdx === slotIndex)
    if (bestIdx !== slotIndex) {
      const temp = slots[slotIndex];
      slots[slotIndex] = slots[bestIdx];
      slots[bestIdx] = temp;
    }

    const currentSlot = slots[slotIndex];

    // Strategia a due pool basata sul rating di difficoltà della parola:
    //   easy  → preferred = difficulty < 0.35 (parole comuni/frequenti)
    //   hard  → preferred = difficulty > 0.65 (parole rare/oscure)
    //   medium → ordinamento con jitter standard
    //
    // Il solver prova PRIMA tutte le preferred, poi le fallback solo se necessario.
    // Questo garantisce che il risultato finale sia composto prevalentemente
    // da parole nel livello target, anche attraverso il backtracking.
    const lenStr = currentSlot.length.toString();
    const lenBucket = (typeof dictionary !== 'undefined') ? dictionary[lenStr] : null;

    // Formato compatto: entry = [difficulty, [clues], pos]
    function getWordDifficulty(word) {
      const entry = lenBucket && lenBucket[word];
      if (Array.isArray(entry))         return entry[0];            // nuovo formato
      if (entry && 'difficulty' in entry) return entry.difficulty;  // formato legacy
      return 0.5;
    }

    let orderedCandidates;

    if (targetDifficulty === 'easy' || targetDifficulty === 'hard') {
      const preferred = [];
      const fallback  = [];
      const thresholds = (typeof CRUCIGEN_CONFIG !== 'undefined' && CRUCIGEN_CONFIG.difficultyThresholds) || { easy: 0.35, hard: 0.65 };
      const threshold = targetDifficulty === 'easy' ? thresholds.easy : thresholds.hard;


      for (const word of bestCandidates) {
        const d = getWordDifficulty(word);
        const isPreferred = targetDifficulty === 'easy' ? d < threshold : d > threshold;
        (isPreferred ? preferred : fallback).push(word);
      }

      // Ordina ciascun pool per difficoltà nella direzione target
      const cmp = targetDifficulty === 'easy'
        ? (a, b) => getWordDifficulty(a) - getWordDifficulty(b)   // facili prima
        : (a, b) => getWordDifficulty(b) - getWordDifficulty(a);  // difficili prima

      // Piccolo jitter per varietà tra parole con rating simile
      preferred.sort((a, b) => cmp(a, b) + (Math.random() - Math.random()) * 0.05);
      fallback.sort((a, b) => getBaseScore(b) - getBaseScore(a));

      orderedCandidates = preferred.concat(fallback);
    } else {
      // Medium: ordinamento con jitter standard
      const baseJitter = CRUCIGEN_CONFIG.candidateJitterWindow || 80;
      bestCandidates.sort((a, b) => getBaseScore(b) - getBaseScore(a));
      const topPart = bestCandidates.slice(0, baseJitter);
      topPart.sort((a, b) => (getBaseScore(b) + Math.random() * 3) - (getBaseScore(a) + Math.random() * 3));
      orderedCandidates = topPart.concat(bestCandidates.slice(baseJitter));
    }

    for (const candidate of orderedCandidates) {
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

    // Ripristina lo swap (solo se era stato fatto)
    if (bestIdx !== slotIndex) {
      const tempBack = slots[slotIndex];
      slots[slotIndex] = slots[bestIdx];
      slots[bestIdx] = tempBack;
    }

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
    const lenBucket = dictionary[slot.length.toString()];
    const dictEntry = lenBucket && slot.word ? lenBucket[slot.word] : null;
    let clueText = "Nessuna definizione disponibile.";
    let pos = null;
    if (dictEntry) {
      if (Array.isArray(dictEntry)) {
        pos = dictEntry[2] ?? null;                     // entry[2] = pos
        const clues = dictEntry[1] || [];               // entry[1] = clues
        if (clues.length > 0) clueText = clues[Math.floor(Math.random() * clues.length)];
      } else {
        pos = (typeof dictEntry === 'object' && dictEntry.pos) ? dictEntry.pos : null;
        const clues = dictEntry.clues || [];
        if (clues.length > 0) clueText = clues[Math.floor(Math.random() * clues.length)];
      }
    }

    const clueObj = {
      num: slot.num,
      word: slot.word,
      clue: clueText,
      row: slot.cells[0][0],
      col: slot.cells[0][1],
      length: slot.length,
      cells: slot.cells,
      direction: slot.direction,
      pos: pos
    };

    if (slot.direction === "H") {
      horizontalClues.push(clueObj);
    } else {
      verticalClues.push(clueObj);
    }
  });

  horizontalClues.sort((a, b) => a.num - b.num);
  verticalClues.sort((a, b) => a.num - b.num);

  // Calcola la difficoltà complessiva dello schema come media delle difficoltà delle parole inserite
  let totalDifficulty = 0;
  let wordCount = 0;
  slots.forEach(slot => {
    const lenBucket = dictionary[slot.length.toString()];
    const dictEntry = lenBucket && slot.word ? lenBucket[slot.word] : null;
    if (dictEntry) {
      const diff = Array.isArray(dictEntry) ? dictEntry[0] : dictEntry.difficulty;
      if (typeof diff === 'number') {
        totalDifficulty += diff;
        wordCount++;
      }
    }
  });
  const avgDifficulty = wordCount > 0 ? (totalDifficulty / wordCount) : 0.25;

  return {
    solution,
    numberGrid,
    horizontalClues,
    verticalClues,
    gridSize: { rows, cols },
    steps,
    difficulty: avgDifficulty
  };
}
