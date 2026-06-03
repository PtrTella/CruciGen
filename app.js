// app.js

let worker = null;
let currentCrossword = null; // Store output from solver
let activeCell = { r: 0, c: 0 };
let activeDirection = "H"; // "H" = Orizzontali, "V" = Verticali
let dictionaryLoaded = false;
let isTyping = false;
let backspaceProcessedInKeydown = false;


// DOM Elements
let gridContainer, selectSize, btnNew, btnVerify, btnClear, btnReveal, themeToggle, loader, loaderText, listHorizontal, listVertical, mobileClueBar, mobileBadge, mobileClueText;

// Initialize application
function initApp() {
  gridContainer = document.getElementById("crossword-grid-container");
  selectSize = document.getElementById("select-size");
  btnNew = document.getElementById("btn-new");
  btnVerify = document.getElementById("btn-verify");
  btnClear = document.getElementById("btn-clear");
  btnReveal = document.getElementById("btn-reveal");
  themeToggle = document.getElementById("theme-toggle");
  loader = document.getElementById("loader");
  loaderText = document.getElementById("loader-text");
  listHorizontal = document.getElementById("clues-horizontal-list");
  listVertical = document.getElementById("clues-vertical-list");
  mobileClueBar = document.getElementById("mobile-clue-bar");
  mobileBadge = document.getElementById("mobile-badge");
  mobileClueText = document.getElementById("mobile-clue-text");

  initTheme();
  setupEventListeners();
  initWorker();
  loadDictionary();
  registerServiceWorker();
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}

// Register Service Worker for PWA
function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("sw.js")
      .then((reg) => {
        log("Service Worker registrato con successo!");
      })
      .catch((err) => {
        log(`Impossibile registrare il Service Worker: ${err.message}`);
      });
  }
}


// Custom Log utility
function log(msg) {
  const time = new Date().toLocaleTimeString();
  const formatted = `[${time}] ${msg}`;
  console.log(formatted);

  const pre = document.getElementById("console-log-pre");
  if (pre) {
    if (pre.textContent === "CruciGen System Initialized. Waiting for action...") {
      pre.textContent = formatted;
    } else {
      pre.textContent += `\n${formatted}`;
    }
    const body = document.getElementById("console-body");
    if (body) {
      body.scrollTop = body.scrollHeight;
    }
  }
}

// Theme Management
// Theme Management
function initTheme() {
  let savedTheme = "light";
  try {
    savedTheme = localStorage.getItem("theme") || "dark";
  } catch (e) {
    console.warn("Storage access not allowed:", e);
  }
  if (savedTheme === "light") {
    document.body.classList.remove("dark-mode");
    document.body.classList.add("light-mode");
    themeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
  } else {
    document.body.classList.add("dark-mode");
    document.body.classList.remove("light-mode");
    themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
  }
}

let generationAttempts = 0;

// Initialize Web Worker
function initWorker() {
  log("Inizializzazione Web Worker...");
  worker = new Worker("worker.js?v=" + new Date().getTime());

  worker.onerror = (err) => {
    log(`[WORKER ERROR] ${err.message} in ${err.filename}:${err.lineno}`);
  };

  worker.onmessage = (e) => {
    const { status, result, message } = e.data;
    log(`Messaggio ricevuto dal worker: status = "${status}"`);

    if (status === "ready") {
      log("Dizionario registrato nel Web Worker con successo!");
      dictionaryLoaded = true;
      generateNewCrossword();
    } else if (status === "success") {
      log(`Generazione completata con successo in ${result.steps} passi di backtracking!`);
      hideLoader();
      currentCrossword = result;
      renderGrid();
      renderClues();
      focusFirstCell();
    } else if (status === "failed") {
      log(`[WARNING] Il risolutore ha fallito l'incastro per questo layout.`);
      const maxAtt = (typeof CRUCIGEN_CONFIG !== 'undefined' && CRUCIGEN_CONFIG.maxGenerationAttempts) || 5;
      if (generationAttempts < maxAtt) {
        generationAttempts++;
        log(`Tentativo di generazione #${generationAttempts + 1} con un layout/trasformazione alternativo...`);
        generateNewCrossword(true);
      } else {
        log("[ERRORE] Raggiunto il limite massimo di tentativi di generazione.");
        hideLoader();
        alert("Impossibile generare lo schema. Riprova.");
      }
    } else if (status === "error") {
      log(`[WORKER CRITICAL ERROR] ${message}`);
      hideLoader();
      alert("Errore critico durante la generazione dello schema.");
    }
  };
}

// Load Dictionary JSON
async function loadDictionary() {
  log("Avvio caricamento dizionario (dictionary.json)...");
  showLoader("Caricamento dizionario italiano...");
  try {
    const response = await fetch("dictionary.json?v=" + new Date().getTime());
    log(`Stato risposta fetch dizionario: ${response.status}`);
    const dict = await response.json();

    let totalWords = 0;
    for (const len in dict) {
      totalWords += Object.keys(dict[len]).length;
    }
    log(`Dizionario caricato. Totale parole indicizzate: ${totalWords}`);

    worker.postMessage({ action: "init", dict });
  } catch (err) {
    log(`[ERRORE DIZIONARIO] ${err.message}`);
    loaderText.innerText = "Errore nel caricamento del dizionario.";
  }
}

function generateNewCrossword(isRetry = false) {
  if (!dictionaryLoaded) return;
  showLoader("Generazione schema in corso...");

  // CORREZIONE: Controlla esplicitamente che non sia il flag booleano true
  if (isRetry !== true) {
    generationAttempts = 0;
  }

  const size = parseInt(selectSize ? selectSize.value : 9) || 9;
  log(`Richiesta nuova topologia ${size}x${size} al Web Worker...`);
  worker.postMessage({ action: "generate", rows: size, cols: size });
}

// Loader controls
function showLoader(text) {
  loaderText.innerText = text;
  loader.classList.remove("hidden");
}

function hideLoader() {
  loader.classList.add("hidden");
}

// Render grid
function renderGrid() {
  gridContainer.innerHTML = "";
  const { rows, cols } = currentCrossword.gridSize;

  gridContainer.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
  gridContainer.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const char = currentCrossword.solution[r][c];
      const cellNum = currentCrossword.numberGrid[r][c];

      const cellEl = document.createElement("div");
      cellEl.classList.add("cell");
      cellEl.dataset.row = r;
      cellEl.dataset.col = c;

      if (char === "#") {
        cellEl.classList.add("black");
      } else {
        if (cellNum) {
          const numEl = document.createElement("span");
          numEl.classList.add("cell-num");
          numEl.innerText = cellNum;
          cellEl.appendChild(numEl);
        }

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

        cellEl.appendChild(inputEl);
      }

      gridContainer.appendChild(cellEl);
    }
  }
}

// Render definitions list
function renderClues() {
  listHorizontal.innerHTML = "";
  listVertical.innerHTML = "";

  currentCrossword.horizontalClues.forEach(clue => {
    const li = document.createElement("li");
    li.dataset.num = clue.num;
    li.dataset.dir = "H";
    li.innerHTML = `<span class="clue-num">${clue.num}</span> ${clue.clue}`;
    li.addEventListener("click", () => handleClueClick(clue, "H"));
    listHorizontal.appendChild(li);
  });

  currentCrossword.verticalClues.forEach(clue => {
    const li = document.createElement("li");
    li.dataset.num = clue.num;
    li.dataset.dir = "V";
    li.innerHTML = `<span class="clue-num">${clue.num}</span> ${clue.clue}`;
    li.addEventListener("click", () => handleClueClick(clue, "V"));
    listVertical.appendChild(li);
  });
}

function focusFirstCell() {
  const { rows, cols } = currentCrossword.gridSize;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (currentCrossword.solution[r][c] !== "#") {
        activeCell = { r, c };
        activeDirection = "H";
        focusCell(r, c);
        return;
      }
    }
  }
}

function focusCell(r, c) {
  const input = document.querySelector(`.cell-input[data-row="${r}"][data-col="${c}"]`);
  if (input) {
    input.focus();
    updateHighlights(r, c);
  }
}

function updateHighlights(row, col) {
  // Remove existing highlights
  document.querySelectorAll(".cell").forEach(el => {
    el.classList.remove("highlight-active", "highlight-word", "error", "verified");
  });
  document.querySelectorAll(".clues-list li").forEach(el => {
    el.classList.remove("highlight-active-clue", "highlight-word-clue");
  });

  // Highlight active cell
  const activeCellEl = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
  if (activeCellEl) {
    activeCellEl.classList.add("highlight-active");
  }

  // Find active slots
  const hClue = getClueForCell(row, col, "H");
  const vClue = getClueForCell(row, col, "V");

  const currentClue = activeDirection === "H" ? hClue : vClue;
  const crossClue = activeDirection === "H" ? vClue : hClue;

  // Highlight word cells in active slot
  if (currentClue) {
    for (let i = 0; i < currentClue.length; i++) {
      const r = activeDirection === "H" ? currentClue.row : currentClue.row + i;
      const c = activeDirection === "H" ? currentClue.col + i : currentClue.col;
      const cellEl = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
      if (cellEl && (r !== row || c !== col)) {
        cellEl.classList.add("highlight-word");
      }
    }

    // Highlight list item
    const listId = activeDirection === "H" ? "clues-horizontal-list" : "clues-vertical-list";
    const clueLi = document.querySelector(`#${listId} li[data-num="${currentClue.num}"]`);
    if (clueLi) {
      clueLi.classList.add("highlight-active-clue");
      if (window.innerWidth > 768 && !isTyping) {
        clueLi.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }

    // Update mobile clue bar
    mobileBadge.innerText = activeDirection === "H" ? "ORIZ" : "VERT";
    mobileBadge.className = `clue-direction-badge ${activeDirection === "H" ? "" : "vert"}`;
    mobileClueText.innerText = `${currentClue.num}. ${currentClue.clue}`;
  }

  // Highlight intersection word clue in the other list
  if (crossClue) {
    const listId = activeDirection === "H" ? "clues-vertical-list" : "clues-horizontal-list";
    const clueLi = document.querySelector(`#${listId} li[data-num="${crossClue.num}"]`);
    if (clueLi) {
      clueLi.classList.add("highlight-word-clue");
    }
  }
}

function getClueForCell(r, c, dir) {
  if (!currentCrossword) return null;
  const list = dir === "H" ? currentCrossword.horizontalClues : currentCrossword.verticalClues;
  return list.find(clue => {
    if (dir === "H") {
      return r === clue.row && c >= clue.col && c < clue.col + clue.length;
    } else {
      return c === clue.col && r >= clue.row && r < clue.row + clue.length;
    }
  });
}

function handleClueClick(clue, dir) {
  activeDirection = dir;
  activeCell = { r: clue.row, c: clue.col };
  focusCell(clue.row, clue.col);
}

// Navigation helpers
function moveFocus(dr, dc) {
  const { rows, cols } = currentCrossword.gridSize;
  let nr = activeCell.r + dr;
  let nc = activeCell.c + dc;

  while (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
    if (currentCrossword.solution[nr][nc] !== "#") {
      activeCell = { r: nr, c: nc };
      focusCell(nr, nc);
      return;
    }
    nr += dr;
    nc += dc;
  }
}

// Event handlers
function setupEventListeners() {
  btnNew.addEventListener("click", generateNewCrossword);

  btnVerify.addEventListener("click", () => {
    if (!currentCrossword) return;
    const { rows, cols } = currentCrossword.gridSize;
    let allCorrect = true;
    let anyFilled = false;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (currentCrossword.solution[r][c] === "#") continue;

        const cellEl = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
        const input = cellEl.querySelector("input");
        const val = input.value.toUpperCase();

        if (val) {
          anyFilled = true;
          if (val === currentCrossword.solution[r][c]) {
            cellEl.classList.add("verified");
          } else {
            cellEl.classList.add("error");
            allCorrect = false;
          }
        } else {
          allCorrect = false;
        }
      }
    }

    if (anyFilled && allCorrect) {
      log("Cruciverba risolto con successo!");
      alert("Complimenti! Hai completato correttamente il cruciverba! 🎉");
    } else {
      log("Verifica completata: presenti errori o lettere mancanti.");
    }
  });

  btnClear.addEventListener("click", () => {
    if (confirm("Vuoi davvero svuotare lo schema corrente?")) {
      document.querySelectorAll(".cell-input").forEach(input => {
        input.value = "";
        input.dataset.oldVal = "";
      });
      updateHighlights(activeCell.r, activeCell.c);
      log("Griglia svuotata.");
    }
  });

  btnReveal.addEventListener("click", () => {
    if (confirm("Vuoi mostrare la soluzione completa dello schema?")) {
      const { rows, cols } = currentCrossword.gridSize;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (currentCrossword.solution[r][c] !== "#") {
            const input = document.querySelector(`.cell-input[data-row="${r}"][data-col="${c}"]`);
            input.value = currentCrossword.solution[r][c];
            input.dataset.oldVal = currentCrossword.solution[r][c];
          }
        }
      }
      updateHighlights(activeCell.r, activeCell.c);
      log("Soluzione dello schema rivelata.");
    }
  })  // Grid delegation
  gridContainer.addEventListener("click", (e) => {
    const input = e.target.closest(".cell-input");
    if (!input) return;

    const r = parseInt(input.dataset.row);
    const c = parseInt(input.dataset.col);

    if (activeCell.r === r && activeCell.c === c) {
      activeDirection = activeDirection === "H" ? "V" : "H";
    } else {
      activeCell = { r, c };
    }
    input.setSelectionRange(input.value.length, input.value.length);
    updateHighlights(r, c);
  });

  gridContainer.addEventListener("focusin", (e) => {
    const input = e.target;
    if (input.classList.contains("cell-input")) {
      input.setSelectionRange(input.value.length, input.value.length);
    }
  });

  gridContainer.addEventListener("input", (e) => {
    const input = e.target;
    if (!input.classList.contains("cell-input")) return;

    const oldVal = input.dataset.oldVal || "";

    // Handle Space bar toggle logic (both PC and mobile keyboards)
    if (e.data === " " || input.value === oldVal + " " || input.value === " ") {
      input.value = oldVal;
      activeDirection = activeDirection === "H" ? "V" : "H";
      updateHighlights(parseInt(input.dataset.row), parseInt(input.dataset.col));
      return;
    }

    isTyping = true;

    // Support backspace via inputType on mobile keyboards
    if (e.inputType === "deleteContentBackward" || e.inputType === "deleteContentForward") {
      if (backspaceProcessedInKeydown) {
        isTyping = false;
        return;
      }

      // Se la casella conteneva una lettera prima della cancellazione, svuotala e basta
      if (oldVal) {
        input.value = "";
        input.dataset.oldVal = "";
        isTyping = false;
        return;
      }

      // Se era già vuota, torna indietro di una casella e svuotala
      input.value = "";
      if (activeDirection === "H") {
        moveFocus(0, -1);
      } else {
        moveFocus(-1, 0);
      }
      const prevInput = document.querySelector(`.cell-input[data-row="${activeCell.r}"][data-col="${activeCell.c}"]`);
      if (prevInput) {
        prevInput.value = "";
        prevInput.dataset.oldVal = "";
      }
      isTyping = false;
      return;
    }

    // Sanitize value (uppercase, remove spaces)
    let val = input.value.trim().toUpperCase().replace(/\s/g, "");
    if (val.length > 1) {
      // Se si scrive su una cella già riempita, sovrascrivi con l'ultimo carattere digitato
      if (val.startsWith(oldVal)) {
        val = val.substring(oldVal.length);
      } else if (val.endsWith(oldVal)) {
        val = val.substring(0, val.length - oldVal.length);
      } else {
        val = val.substring(val.length - 1);
      }
    }
    input.value = val;
    input.dataset.oldVal = val;

    if (input.value) {
      if (activeDirection === "H") {
        moveFocus(0, 1);
      } else {
        moveFocus(1, 0);
      }
    }
    isTyping = false;
  });

  gridContainer.addEventListener("keydown", (e) => {
    const input = e.target;
    if (!input.classList.contains("cell-input")) return;

    const r = parseInt(input.dataset.row);
    const c = parseInt(input.dataset.col);

    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        moveFocus(0, 1);
        break;
      case "ArrowLeft":
        e.preventDefault();
        moveFocus(0, -1);
        break;
      case "ArrowDown":
        e.preventDefault();
        moveFocus(1, 0);
        break;
      case "ArrowUp":
        e.preventDefault();
        moveFocus(-1, 0);
        break;
      case "Backspace":
        e.preventDefault();
        backspaceProcessedInKeydown = true;
        setTimeout(() => {
          backspaceProcessedInKeydown = false;
        }, 0);

        const currentVal = input.value;
        if (currentVal) {
          input.value = "";
          input.dataset.oldVal = "";
        } else {
          if (activeDirection === "H") {
            moveFocus(0, -1);
          } else {
            moveFocus(-1, 0);
          }
          const prevInput = document.querySelector(`.cell-input[data-row="${activeCell.r}"][data-col="${activeCell.c}"]`);
          if (prevInput) {
            prevInput.value = "";
            prevInput.dataset.oldVal = "";
          }
        }
        break;
      case " ":
        e.preventDefault();
        activeDirection = activeDirection === "H" ? "V" : "H";
        updateHighlights(r, c);
        break;
    }
  });

  // Previeni menu contestuale (copia/incolla/condividi) sulle caselle
  gridContainer.addEventListener("contextmenu", (e) => {
    if (e.target.classList.contains("cell-input")) {
      e.preventDefault();
    }
  });

  // Impedisce la selezione nativa del testo per bloccare i popup di sistema
  gridContainer.addEventListener("select", (e) => {
    if (e.target.classList.contains("cell-input")) {
      e.preventDefault();
      e.target.selectionStart = e.target.selectionEnd;
    }
  });

  gridContainer.addEventListener("selectstart", (e) => {
    if (e.target.classList.contains("cell-input")) {
      e.preventDefault();
    }
  });

  // Intercetta eventi prima dell'inserimento per prevenire incollaggi nativi
  gridContainer.addEventListener("beforeinput", (e) => {
    if (e.target.classList.contains("cell-input")) {
      if (e.inputType === "insertFromPaste" || e.inputType === "insertFromDrop") {
        e.preventDefault();
      }
    }
  });

  // Listener globale per prevenire visualizzazione dei popup iOS/Android
  document.addEventListener("selectionchange", () => {
    const active = document.activeElement;
    if (active && active.classList.contains("cell-input")) {
      if (active.selectionStart !== active.selectionEnd) {
        active.selectionStart = active.selectionEnd;
      }
    }
  });

  // Mobile Clue Bar Direction Toggle button
  const btnToggleDirMobile = document.getElementById("btn-toggle-direction-mobile");
  if (btnToggleDirMobile) {
    btnToggleDirMobile.addEventListener("click", (e) => {
      e.stopPropagation();
      activeDirection = activeDirection === "H" ? "V" : "H";
      updateHighlights(activeCell.r, activeCell.c);
      log(`Direzione cambiata a: ${activeDirection === "H" ? "Orizzontali" : "Verticali"}`);
    });
  }

  // Console Panel Toggle
  const consoleHeader = document.getElementById("console-header-toggle");
  const consoleBody = document.getElementById("console-body");
  const consoleIcon = document.getElementById("console-toggle-icon");
  const btnClearConsole = document.getElementById("btn-clear-console");

  consoleHeader.addEventListener("click", () => {
    const isCollapsed = consoleBody.classList.toggle("collapsed");
    consoleIcon.className = isCollapsed ? "fa-solid fa-chevron-up" : "fa-solid fa-chevron-down";
  });

  btnClearConsole.addEventListener("click", (e) => {
    e.stopPropagation(); // prevent collapse
    const pre = document.getElementById("console-log-pre");
    if (pre) pre.textContent = "[Console svuotata]";
  });

  themeToggle.addEventListener("click", () => {
    const isLight = document.body.classList.toggle("light-mode");
    document.body.classList.toggle("dark-mode", !isLight);
    try {
      localStorage.setItem("theme", isLight ? "light" : "dark");
    } catch (e) {
      console.warn("Storage write not allowed:", e);
    }
    themeToggle.innerHTML = isLight ? '<i class="fa-solid fa-moon"></i>' : '<i class="fa-solid fa-sun"></i>';
    log(`Tema cambiato in modalità ${isLight ? "Chiara" : "Scura"}`);
  });
}
