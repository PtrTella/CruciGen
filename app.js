// app.js

let worker = null;
let currentCrossword = null; // Store output from solver
let activeCell = { r: 0, c: 0 };
let activeDirection = "H"; // "H" = Orizzontali, "V" = Verticali
let dictionaryLoaded = false;

// DOM Elements
const gridContainer = document.getElementById("crossword-grid-container");
const btnNew = document.getElementById("btn-new");
const btnVerify = document.getElementById("btn-verify");
const btnClear = document.getElementById("btn-clear");
const btnReveal = document.getElementById("btn-reveal");
const themeToggle = document.getElementById("theme-toggle");
const selectSize = document.getElementById("grid-size-select");
const loader = document.getElementById("loader");
const loaderText = document.getElementById("loader-text");
const listHorizontal = document.getElementById("clues-horizontal-list");
const listVertical = document.getElementById("clues-vertical-list");
const mobileClueBar = document.getElementById("mobile-clue-bar");
const mobileBadge = document.getElementById("mobile-badge");
const mobileClueText = document.getElementById("mobile-clue-text");

// Initialize application
window.addEventListener("DOMContentLoaded", () => {
  initWorker();
  initTheme();
  setupEventListeners();
  loadDictionary();
});

// Theme Management
function initTheme() {
  const savedTheme = localStorage.getItem("theme");
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

themeToggle.addEventListener("click", () => {
  const isLight = document.body.classList.toggle("light-mode");
  document.body.classList.toggle("dark-mode", !isLight);
  localStorage.setItem("theme", isLight ? "light" : "dark");
  themeToggle.innerHTML = isLight ? '<i class="fa-solid fa-moon"></i>' : '<i class="fa-solid fa-sun"></i>';
});

// Initialize Web Worker
function initWorker() {
  console.log("Initializing Worker...");
  // Cache bust the worker to ensure updates are loaded
  worker = new Worker("worker.js?v=" + new Date().getTime());
  
  worker.onerror = (err) => {
    console.log("[WORKER ERROR]", err.message, "at", err.filename, ":", err.lineno);
  };
  
  worker.onmessage = (e) => {
    const { status, result, message } = e.data;
    console.log("Received message from worker:", status);
    
    if (status === "ready") {
      console.log("Worker dictionary initialized!");
      dictionaryLoaded = true;
      generateNewCrossword();
    } else if (status === "success") {
      console.log("Worker successfully generated grid!");
      hideLoader();
      currentCrossword = result;
      renderGrid();
      renderClues();
      focusFirstCell();
    } else if (status === "failed") {
      console.log("Worker failed to generate grid.");
      hideLoader();
      alert("Impossibile generare uno schema con i parametri attuali. Riprova.");
    } else if (status === "error") {
      console.log("Worker reported error:", message);
      hideLoader();
      alert("Errore durante la generazione dello schema.");
    }
  };
}

// Load Dictionary JSON
async function loadDictionary() {
  console.log("Loading dictionary.json...");
  showLoader("Caricamento dizionario italiano...");
  try {
    // Cache bust dictionary fetch
    const response = await fetch("dictionary.json?v=" + new Date().getTime());
    console.log("Response status:", response.status);
    const dict = await response.json();
    console.log("Loaded dictionary entries count:", Object.keys(dict).length);
    worker.postMessage({ action: "init", dict });
  } catch (err) {
    console.log("Failed to load dictionary:", err);
    loaderText.innerText = "Errore nel caricamento del dizionario.";
  }
}

// Generate crossword
function generateNewCrossword() {
  if (!dictionaryLoaded) {
    console.log("Cannot generate crossword: dictionary not loaded yet");
    return;
  }
  showLoader("Generazione schema in corso...");
  
  const size = selectSize.value;
  console.log("Selected size for generation:", size);
  const parts = size.split('x');
  const rows = parseInt(parts[0]);
  const cols = parseInt(parts[1]);
  
  console.log(`Sending generate command for random ${rows}x${cols} template`);
  worker.postMessage({ action: "generate", template: "random", rows: rows, cols: cols });
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
        inputEl.maxLength = 1;
        inputEl.classList.add("cell-input");
        inputEl.dataset.row = r;
        inputEl.dataset.col = c;
        
        // Disable spellcheck and autocomplete
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
      clueLi.scrollIntoView({ block: "nearest", behavior: "smooth" });
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
  
  // Find next non-black cell in the direction
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
      alert("Complimenti! Hai completato correttamente il cruciverba! 🎉");
    }
  });
  
  btnClear.addEventListener("click", () => {
    if (confirm("Vuoi davvero svuotare lo schema corrente?")) {
      document.querySelectorAll(".cell-input").forEach(input => input.value = "");
      updateHighlights(activeCell.r, activeCell.c);
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
          }
        }
      }
      updateHighlights(activeCell.r, activeCell.c);
    }
  });
  
  // Delegation of events on the grid
  gridContainer.addEventListener("click", (e) => {
    const input = e.target.closest(".cell-input");
    if (!input) return;
    
    const r = parseInt(input.dataset.row);
    const c = parseInt(input.dataset.col);
    
    if (activeCell.r === r && activeCell.c === c) {
      // Toggle direction if clicking already active cell
      activeDirection = activeDirection === "H" ? "V" : "H";
    } else {
      activeCell = { r, c };
    }
    updateHighlights(r, c);
  });
  
  gridContainer.addEventListener("input", (e) => {
    const input = e.target;
    if (!input.classList.contains("cell-input")) return;
    
    // Auto-normalize text to upper-case
    input.value = input.value.toUpperCase();
    
    // Move to next cell in active direction
    if (input.value) {
      if (activeDirection === "H") {
        moveFocus(0, 1);
      } else {
        moveFocus(1, 0);
      }
    }
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
        if (!input.value) {
          e.preventDefault();
          // Move back first
          if (activeDirection === "H") {
            moveFocus(0, -1);
          } else {
            moveFocus(-1, 0);
          }
          // Clear that focused cell
          const prevInput = document.querySelector(`.cell-input[data-row="${activeCell.r}"][data-col="${activeCell.c}"]`);
          if (prevInput) prevInput.value = "";
        }
        break;
      case " ":
        e.preventDefault();
        activeDirection = activeDirection === "H" ? "V" : "H";
        updateHighlights(r, c);
        break;
    }
  });
}
