function getDynamicScore(word, len, targetDifficulty) {
  let baseScore = wordScores[word] || 0;
  if (!targetDifficulty || targetDifficulty === "medium") {
    return baseScore;
  }

  let difficulty = 0.5;
  if (typeof dictionary !== 'undefined' && dictionary) {
    const entry = dictionary[len.toString()][word];
    if (entry && typeof entry === 'object' && 'difficulty' in entry) {
      difficulty = entry.difficulty;
    }
  }

  const easyMult = (typeof CRUCIGEN_CONFIG !== 'undefined' && CRUCIGEN_CONFIG.difficultyWeights && CRUCIGEN_CONFIG.difficultyWeights.easyBiasMultiplier) || 100;
  const hardMult = (typeof CRUCIGEN_CONFIG !== 'undefined' && CRUCIGEN_CONFIG.difficultyWeights && CRUCIGEN_CONFIG.difficultyWeights.hardBiasMultiplier) || 100;

  if (targetDifficulty === "easy") {
    // Spinge fortemente sulle parole facili (valore basso di difficulty)
    return (1.0 - difficulty) * easyMult + baseScore;
  } else if (targetDifficulty === "hard") {
    // Spinge fortemente sulle parole difficili (valore alto di difficulty)
    return difficulty * hardMult + baseScore;
  }

  return baseScore;
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

    const temp = slots[slotIndex];
    slots[slotIndex] = slots[bestIdx];
    slots[bestIdx] = temp;

    const currentSlot = slots[slotIndex];

    // Ordina TUTTI i candidati in base al punteggio dinamico di difficoltà desiderato prima di applicare la finestra di jitter.
    // In questo modo, le parole effettivamente più facili (o difficili) emergono indipendentemente dalla loro lettera iniziale.
    bestCandidates.sort((a, b) => getDynamicScore(b, currentSlot.length, targetDifficulty) - getDynamicScore(a, currentSlot.length, targetDifficulty));

    const jitterWindow = CRUCIGEN_CONFIG.candidateJitterWindow || 50;
    if (bestCandidates.length > jitterWindow) {
      const topPart = bestCandidates.slice(0, jitterWindow);
      // Applica un piccolo jitter per variare gli schemi generati
      topPart.sort((a, b) => (getDynamicScore(b, currentSlot.length, targetDifficulty) + Math.random() * 3) - (getDynamicScore(a, currentSlot.length, targetDifficulty) + Math.random() * 3));
      bestCandidates = topPart.concat(bestCandidates.slice(jitterWindow));
    } else {
      bestCandidates.sort((a, b) => (getDynamicScore(b, currentSlot.length, targetDifficulty) + Math.random() * 3) - (getDynamicScore(a, currentSlot.length, targetDifficulty) + Math.random() * 3));
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
    const dictEntry = dictionary[slot.length.toString()][slot.word];
    let clueText = "Nessuna definizione disponibile.";
    let pos = (dictEntry && typeof dictEntry === 'object' && dictEntry.pos) ? dictEntry.pos : null;

    if (dictEntry) {
      const clues = Array.isArray(dictEntry) ? dictEntry : (dictEntry.clues || []);
      if (clues.length > 0) {
        clueText = clues[Math.floor(Math.random() * clues.length)];
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
    const dictEntry = dictionary[slot.length.toString()][slot.word];
    if (dictEntry && typeof dictEntry === 'object' && 'difficulty' in dictEntry) {
      totalDifficulty += dictEntry.difficulty;
      wordCount++;
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
