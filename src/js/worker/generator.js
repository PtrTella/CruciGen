// src/js/worker/generator.js
// Generatore procedurale di geometrie simmetriche con vincoli gaussiani per il Web Worker.

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

// Logica completa di valutazione della griglia (Gaussiana + Flood Fill di connettività)
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
