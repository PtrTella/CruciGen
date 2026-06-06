// src/js/modules/ui.js
// Gestore dell'interfaccia utente (rendering, evidenziazioni, caricamento).

import { dom } from "./dom.js";
import { state } from "./state.js";
import { log } from "./logger.js";

// Controlli del loader
export function showLoader(text) {
  dom.loaderText.innerText = text;
  dom.loader.classList.remove("hidden");
}

export function hideLoader() {
  dom.loader.classList.add("hidden");
}

// Rendering della griglia
export function renderGrid() {
  dom.gridContainer.innerHTML = "";
  const { rows, cols } = state.currentCrossword.gridSize;

  dom.gridContainer.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
  dom.gridContainer.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const char = state.currentCrossword.solution[r][c];
      const cellNum = state.currentCrossword.numberGrid[r][c];

      const cellEl = document.createElement("div");
      cellEl.classList.add("cell");
      cellEl.dataset.row = r;
      cellEl.dataset.col = c;

      if (char === "#") {
        cellEl.classList.add("black");
      } else {
        const inputEl = document.createElement("input");
        inputEl.type = "text";
        inputEl.maxLength = 2;
        inputEl.classList.add("cell-input");
        inputEl.dataset.row = r;
        inputEl.dataset.col = c;
        inputEl.dataset.oldVal = "";

        inputEl.setAttribute("autocomplete", "off");
        inputEl.setAttribute("autocorrect", "off");
        inputEl.setAttribute("spellcheck", "false");

        if (state.gameMode === "encrypted") {
          const cipherNum = state.cipherMap[char.toUpperCase()];
          cellEl.dataset.cipher = cipherNum;
          inputEl.dataset.cipher = cipherNum;

          const cipherEl = document.createElement("span");
          cipherEl.classList.add("cipher-num");
          cipherEl.innerText = cipherNum;
          cellEl.appendChild(cipherEl);

          if (state.revealedNumbers.has(cipherNum)) {
            cellEl.classList.add("pre-filled");
            if (state.startWordCoordinates.has(`${r},${c}`)) {
              cellEl.classList.add("starting-word");
            }
            inputEl.value = char;
            inputEl.dataset.oldVal = char;
            inputEl.readOnly = true;
          } else if (state.userMapping[cipherNum]) {
            inputEl.value = state.userMapping[cipherNum];
            inputEl.dataset.oldVal = state.userMapping[cipherNum];
          }
        } else {
          if (cellNum) {
            const numEl = document.createElement("span");
            numEl.classList.add("cell-num");
            numEl.innerText = cellNum;
            cellEl.appendChild(numEl);
          }
        }

        cellEl.appendChild(inputEl);
      }

      dom.gridContainer.appendChild(cellEl);
    }
  }
}

// Rendering delle definizioni
export function renderClues() {
  updateDifficultyBadge();

  if (state.gameMode === "encrypted") {
    dom.cluesHorizontalCard.classList.add("hidden");
    dom.cluesVerticalCard.classList.add("hidden");
    dom.encryptedLegendCard.classList.remove("hidden");

    if (dom.mobileClueBar) {
      dom.mobileClueBar.style.display = "none";
    }

    renderLegend();
  } else {
    dom.cluesHorizontalCard.classList.remove("hidden");
    dom.cluesVerticalCard.classList.remove("hidden");
    dom.encryptedLegendCard.classList.add("hidden");

    if (dom.mobileClueBar && window.innerWidth <= 600) {
      dom.mobileClueBar.style.display = "flex";
    }

    dom.listHorizontal.innerHTML = "";
    dom.listVertical.innerHTML = "";

    state.currentCrossword.horizontalClues.forEach(clue => {
      const li = document.createElement("li");
      li.dataset.num = clue.num;
      li.dataset.dir = "H";
      
      li.innerHTML = `<span class="clue-num">${clue.num}</span> ${clue.clue}`;
      li.addEventListener("click", () => handleClueClick(clue, "H"));
      dom.listHorizontal.appendChild(li);
    });

    state.currentCrossword.verticalClues.forEach(clue => {
      const li = document.createElement("li");
      li.dataset.num = clue.num;
      li.dataset.dir = "V";

      li.innerHTML = `<span class="clue-num">${clue.num}</span> ${clue.clue}`;
      li.addEventListener("click", () => handleClueClick(clue, "V"));
      dom.listVertical.appendChild(li);
    });
  }
}

export function focusFirstCell() {
  const { rows, cols } = state.currentCrossword.gridSize;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (state.currentCrossword.solution[r][c] !== "#") {
        state.activeCell = { r, c };
        state.activeDirection = "H";
        focusCell(r, c);
        return;
      }
    }
  }
}

export function focusCell(r, c) {
  const input = document.querySelector(`.cell-input[data-row="${r}"][data-col="${c}"]`);
  if (input) {
    input.focus();
    updateHighlights(r, c);
  }
}

export function updateHighlights(row, col) {
  // Rimuovi le evidenziazioni esistenti
  document.querySelectorAll(".cell").forEach(el => {
    el.classList.remove("highlight-active", "highlight-word", "error", "verified");
  });
  document.querySelectorAll(".clues-list li").forEach(el => {
    el.classList.remove("highlight-active-clue", "highlight-word-clue");
  });
  document.querySelectorAll(".legend-item").forEach(el => {
    el.classList.remove("highlight-active");
  });

  // Gestione in modalità crittografata
  if (state.gameMode === "encrypted") {
    const activeCellEl = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
    if (activeCellEl) {
      activeCellEl.classList.add("highlight-active");
    }

    const char = state.currentCrossword.solution[row][col];
    if (char !== "#") {
      const cipherNum = state.cipherMap[char.toUpperCase()];

      document.querySelectorAll(".cell[data-cipher]").forEach(cellEl => {
        const cNum = parseInt(cellEl.dataset.cipher);
        if (cNum === cipherNum) {
          const r = parseInt(cellEl.dataset.row);
          const c = parseInt(cellEl.dataset.col);
          if (r !== row || c !== col) {
            cellEl.classList.add("highlight-word");
          }
        }
      });

      const legendItem = document.querySelector(`.legend-item[data-cipher="${cipherNum}"]`);
      if (legendItem) {
        legendItem.classList.add("highlight-active");
      }
    }
    return;
  }

  // Evidenzia la cella attiva
  const activeCellEl = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
  if (activeCellEl) {
    activeCellEl.classList.add("highlight-active");
  }

  // Trova gli slot attivi
  const hClue = getClueForCell(row, col, "H");
  const vClue = getClueForCell(row, col, "V");

  const currentClue = state.activeDirection === "H" ? hClue : vClue;
  const crossClue = state.activeDirection === "H" ? vClue : hClue;

  // Evidenzia le celle della parola nello slot attivo
  if (currentClue) {
    for (let i = 0; i < currentClue.length; i++) {
      const r = state.activeDirection === "H" ? currentClue.row : currentClue.row + i;
      const c = state.activeDirection === "H" ? currentClue.col + i : currentClue.col;
      const cellEl = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
      if (cellEl && (r !== row || c !== col)) {
        cellEl.classList.add("highlight-word");
      }
    }

    // Evidenzia l'elemento della lista
    const listId = state.activeDirection === "H" ? "clues-horizontal-list" : "clues-vertical-list";
    const clueLi = document.querySelector(`#${listId} li[data-num="${currentClue.num}"]`);
    if (clueLi) {
      clueLi.classList.add("highlight-active-clue");
      if (window.innerWidth > 768 && !state.isTyping) {
        clueLi.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }

    // Aggiorna la barra degli indizi per mobile
    dom.mobileBadge.innerText = state.activeDirection === "H" ? "ORIZ" : "VERT";
    dom.mobileBadge.className = `clue-direction-badge ${state.activeDirection === "H" ? "" : "vert"}`;
    
    dom.mobileClueText.innerText = `${currentClue.num}. ${currentClue.clue}`;
  }

  // Evidenzia l'indizio d'incrocio nell'altra lista
  if (crossClue) {
    const listId = state.activeDirection === "H" ? "clues-vertical-list" : "clues-horizontal-list";
    const clueLi = document.querySelector(`#${listId} li[data-num="${crossClue.num}"]`);
    if (clueLi) {
      clueLi.classList.add("highlight-word-clue");
    }
  }
}

export function getClueForCell(r, c, dir) {
  if (!state.currentCrossword) return null;
  const list = dir === "H" ? state.currentCrossword.horizontalClues : state.currentCrossword.verticalClues;
  return list.find(clue => {
    if (dir === "H") {
      return r === clue.row && c >= clue.col && c < clue.col + clue.length;
    } else {
      return c === clue.col && r >= clue.row && r < clue.row + clue.length;
    }
  });
}

export function handleClueClick(clue, dir) {
  state.activeDirection = dir;
  state.activeCell = { r: clue.row, c: clue.col };
  focusCell(clue.row, clue.col);
}

export function renderLegend() {
  dom.legendGridContainer.innerHTML = "";
  
  const totalCiphers = Object.keys(state.cipherRevMap).length;
  
  for (let i = 1; i <= totalCiphers; i++) {
    const legendItem = document.createElement("div");
    legendItem.classList.add("legend-item");
    legendItem.dataset.cipher = i;
    
    const numEl = document.createElement("span");
    numEl.classList.add("legend-num");
    numEl.innerText = i;
    legendItem.appendChild(numEl);
    
    const inputEl = document.createElement("input");
    inputEl.type = "text";
    inputEl.maxLength = 1;
    inputEl.classList.add("legend-input");
    inputEl.dataset.cipher = i;
    
    if (state.revealedNumbers.has(i)) {
      inputEl.value = state.cipherRevMap[i];
      inputEl.disabled = true;
    } else if (state.userMapping[i]) {
      inputEl.value = state.userMapping[i];
    }
    
    legendItem.appendChild(inputEl);
    dom.legendGridContainer.appendChild(legendItem);
  }
}

export function animateClueWordReveal(bestClue) {
  const word = bestClue.word.toUpperCase();
  const cells = bestClue.cells;

  log(`Avvio animazione di digitazione indizio iniziale: "${word}"`);

  // Pulisci timer esistenti
  state.animationTimeouts.forEach(clearTimeout);
  state.animationTimeouts = [];

  // 1. Digita la parola iniziale lettera per lettera
  cells.forEach(([r, c], i) => {
    const timeoutId = setTimeout(() => {
      const cellEl = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
      if (!cellEl) return;
      const inputEl = cellEl.querySelector("input");
      if (!inputEl) return;

      cellEl.classList.add("pre-filled", "starting-word", "cell-glow-animate");
      inputEl.value = word[i];
      inputEl.dataset.oldVal = word[i];
      inputEl.readOnly = true;
    }, i * 300);

    state.animationTimeouts.push(timeoutId);
  });

  // 2. Quando la digitazione è completata, propaga le lettere a tutto lo schema
  const propagationTimeoutId = setTimeout(() => {
    log("Digitazione parola indizio completata. Propagazione delle lettere nel resto dello schema...");

    // Popola lo stato
    for (let char of word) {
      const num = state.cipherMap[char];
      state.revealedNumbers.add(num);
      state.userMapping[num] = char;
    }

    // Aggiorna la Legenda
    document.querySelectorAll(".legend-input").forEach(li => {
      const cipher = parseInt(li.dataset.cipher);
      if (state.revealedNumbers.has(cipher)) {
        li.value = state.cipherRevMap[cipher];
        li.disabled = true;
      }
    });

    // Propaga alle altre caselle con animazione
    for (let char of word) {
      const num = state.cipherMap[char];
      document.querySelectorAll(`.cell-input[data-cipher="${num}"]`).forEach(inputEl => {
        const cellEl = inputEl.closest(".cell");
        const r = parseInt(inputEl.dataset.row);
        const c = parseInt(inputEl.dataset.col);

        // Se non fa parte della parola iniziale, la popoliamo ora con animazione
        if (!state.startWordCoordinates.has(`${r},${c}`)) {
          cellEl.classList.add("pre-filled");
          inputEl.value = char;
          inputEl.dataset.oldVal = char;
          inputEl.readOnly = true;
          
          inputEl.classList.add("cipher-spread-animate");
          cellEl.classList.add("cell-glow-animate");
        }
      });
    }
  }, cells.length * 300);

  state.animationTimeouts.push(propagationTimeoutId);
}

// Aggiorna il badge di difficoltà complessiva dello schema
export function updateDifficultyBadge() {
  if (!dom.difficultyBadge) return;
  
  if (!state.currentCrossword || state.currentCrossword.difficulty === undefined) {
    dom.difficultyBadge.classList.add("hidden");
    return;
  }
  
  const diff = state.currentCrossword.difficulty;
  
  // Rimuovi vecchie classi di difficoltà
  dom.difficultyBadge.classList.remove("easy", "medium", "hard", "hidden");
  
  let label = "";
  let className = "";
  
  // Soglie allineate con CRUCIGEN_CONFIG.difficultyThresholds
  const thresholds = (typeof CRUCIGEN_CONFIG !== 'undefined' && CRUCIGEN_CONFIG.difficultyThresholds)
    ? CRUCIGEN_CONFIG.difficultyThresholds
    : { easy: 0.35, hard: 0.65 };

  if (diff < thresholds.easy) {
    label = "Facile";
    className = "easy";
  } else if (diff < thresholds.hard) {
    label = "Medio";
    className = "medium";
  } else {
    label = "Difficile";
    className = "hard";
  }
  
  const percent = Math.round(diff * 100);
  
  dom.difficultyBadge.innerHTML = `<i class="fa-solid fa-gauge-high"></i> Difficoltà: <strong>${label} (${percent}%)</strong>`;
  dom.difficultyBadge.classList.add(className);
}
