// src/js/worker/generator.js
// Generatore procedurale di geometrie simmetriche con vincoli gaussiani per il Web Worker.

function generateGridTopology(rows, cols, targetDifficulty) {
  let bestGrid = null;
  let bestScore = -Infinity;
  const maxAttempts = (typeof CRUCIGEN_CONFIG !== 'undefined' && CRUCIGEN_CONFIG.gridTopologyCandidates) || 300;

  // Percentuale assoluta di caselle nere per ogni difficoltà, letta dal config
  const cfg = (typeof CRUCIGEN_CONFIG !== 'undefined') ? CRUCIGEN_CONFIG : {};
  const percentByDiff = cfg.blackSquarePercentByDifficulty || { easy: 0.23, medium: 0.17, hard: 0.12 };
  const blackPercent = percentByDiff[targetDifficulty] || percentByDiff.medium || 0.17;
  const blackSquareTarget = Math.floor(rows * cols * blackPercent);


  for (let i = 0; i < maxAttempts; i++) {
    let grid = Array(rows).fill(null).map(() => Array(cols).fill(' '));
    let blackSquares = 0;

    while (blackSquares < blackSquareTarget) {
      let r = Math.floor(Math.random() * rows);
      let c = Math.floor(Math.random() * cols);

      if (grid[r][c] === ' ') {
        grid[r][c] = '#';
        // Applica simmetria rotazionale speculare a 180° (stile classico)
        if (grid[rows - 1 - r][cols - 1 - c] === ' ') {
          grid[rows - 1 - r][cols - 1 - c] = '#';
          blackSquares++;
        }
        blackSquares++;
      }
    }

    // Ripara le celle bianche isolate (senza parole orizzontali NÉ verticali)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] === ' ') {
          let isH1 = (c === 0 || grid[r][c - 1] === '#') && (c === cols - 1 || grid[r][c + 1] === '#');
          let isV1 = (r === 0 || grid[r - 1][c] === '#') && (r === rows - 1 || grid[r + 1][c] === '#');
          if (isH1 && isV1) {
            grid[r][c] = '#';
          }
        }
      }
    }

    let score = evaluateGridFitness(grid, rows, cols, targetDifficulty);
    if (score > bestScore) {
      bestScore = score;
      bestGrid = grid;
    }
  }

  return bestGrid;
}

// Logica completa di valutazione della griglia (Gaussiana + Flood Fill di connettività + penalty ibride)
function evaluateGridFitness(grid, rows, cols, targetDifficulty) {
  // Centro della Gaussiana = fraction × cols, adattato alla dimensione reale della griglia.
  // Le frazioni sono in config.js → lengthCenterFractions.
  const cfg = (typeof CRUCIGEN_CONFIG !== 'undefined') ? CRUCIGEN_CONFIG : {};
  const fractions = cfg.lengthCenterFractions || { easy: 0.50, medium: 0.67, hard: 0.80 };
  const fraction  = fractions[targetDifficulty] || fractions.medium;
  const center    = Math.max(3, Math.round(cols * fraction));
  const lengthScores = generateGaussScores(center);   // generateGaussScores è in config.js

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
          score += lengthScores[len] !== undefined ? lengthScores[len] : 0;
          len = 0;
        }
      }
    }
    if (len > 0) score += lengthScores[len] !== undefined ? lengthScores[len] : 0;
  }

  // Analisi slot Verticali
  for (let c = 0; c < cols; c++) {
    let len = 0;
    for (let r = 0; r < rows; r++) {
      if (grid[r][c] === ' ') {
        len++;
      } else {
        if (len > 0) {
          score += lengthScores[len] !== undefined ? lengthScores[len] : 0;
          len = 0;
        }
      }
    }
    if (len > 0) score += lengthScores[len] !== undefined ? lengthScores[len] : 0;
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

  // 1. Penalizzazione per aree interamente bianche (3x3 per griglie <= 11, 4x4 per griglie >= 13)
  const blockSize = rows <= 11 ? 3 : 4;
  for (let r = 0; r <= rows - blockSize; r++) {
    for (let c = 0; c <= cols - blockSize; c++) {
      let allWhite = true;
      outer: for (let dr = 0; dr < blockSize; dr++) {
        for (let dc = 0; dc < blockSize; dc++) {
          if (grid[r + dr][c + dc] === '#') { allWhite = false; break outer; }
        }
      }
      if (allWhite) score -= 150;
    }
  }

  // 2. Penalizzazione per caselle nere sui bordi esterni
  for (let c = 0; c < cols; c++) {
    if (grid[0][c] === '#') score -= 25;
    if (grid[rows - 1][c] === '#') score -= 25;
  }
  for (let r = 1; r < rows - 1; r++) {
    if (grid[r][0] === '#') score -= 25;
    if (grid[r][cols - 1] === '#') score -= 25;
  }

  // 3. Penalizzazione per agglomerati di caselle nere adiacenti
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === '#') {
        let adj = 0;
        for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc] === '#') adj++;
        }
        if (adj >= 2) score -= 20 * adj;
      }
    }
  }

  return score;
}
