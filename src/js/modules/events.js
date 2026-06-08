// src/js/modules/events.js
// Configurazione dei gestori degli eventi per l'interfaccia di CruciGen.

import { state } from "./state.js";
import { dom } from "./dom.js";
import { log } from "./logger.js";
import { generateNewCrossword, cancelGeneration } from "./worker-client.js";
import { updateHighlights, focusCell } from "./ui.js";

// Helper di navigazione
export function moveFocus(dr, dc) {
  const { rows, cols } = state.currentCrossword.gridSize;
  let nr = state.activeCell.r + dr;
  let nc = state.activeCell.c + dc;

  while (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
    if (state.currentCrossword.solution[nr][nc] !== "#") {
      state.activeCell = { r: nr, c: nc };
      focusCell(nr, nc);
      return;
    }
    nr += dr;
    nc += dc;
  }
}

export function setupEventListeners() {
  dom.selectMode.addEventListener("change", () => {
    state.gameMode = dom.selectMode.value;
    log(`Modalità di gioco cambiata a: ${state.gameMode === "encrypted" ? "Crittografato" : "Classico"}`);
  });

  dom.selectDifficulty.addEventListener("change", () => {
    state.targetDifficulty = dom.selectDifficulty.value;
    log(`Target difficoltà cambiato a: ${state.targetDifficulty}`);
  });

  dom.btnNew.addEventListener("click", () => generateNewCrossword());

  dom.btnVerify.addEventListener("click", () => {
    if (!state.currentCrossword) return;
    const { rows, cols } = state.currentCrossword.gridSize;
    let allCorrect = true;
    let anyFilled = false;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (state.currentCrossword.solution[r][c] === "#") continue;

        const cellEl = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
        const input = cellEl.querySelector("input");
        const val = input.value.toUpperCase();

        if (val) {
          anyFilled = true;
          const solChar = state.currentCrossword.solution[r][c];
          const normVal = val.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          const normSol = solChar.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          if (normVal === normSol) {
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

  dom.btnClear.addEventListener("click", () => {
    if (confirm("Vuoi davvero svuotare lo schema corrente?")) {
      if (state.gameMode === "encrypted") {
        // Svuota solo i numeri non rivelati
        Object.keys(state.userMapping).forEach(cipher => {
          const cNum = parseInt(cipher);
          if (!state.revealedNumbers.has(cNum)) {
            state.userMapping[cNum] = "";
          }
        });

        document.querySelectorAll(".cell-input[data-cipher]").forEach(ci => {
          const cipher = parseInt(ci.dataset.cipher);
          if (!state.revealedNumbers.has(cipher)) {
            ci.value = "";
            ci.dataset.oldVal = "";
          }
        });

        document.querySelectorAll(".legend-input").forEach(li => {
          const cipher = parseInt(li.dataset.cipher);
          if (!state.revealedNumbers.has(cipher)) {
            li.value = "";
          }
        });
      } else {
        document.querySelectorAll(".cell-input").forEach(input => {
          input.value = "";
          input.dataset.oldVal = "";
        });
      }
      updateHighlights(state.activeCell.r, state.activeCell.c);
      log("Griglia svuotata.");
    }
  });

  dom.btnReveal.addEventListener("click", () => {
    if (confirm("Vuoi mostrare la soluzione completa dello schema?")) {
      const { rows, cols } = state.currentCrossword.gridSize;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const char = state.currentCrossword.solution[r][c];
          if (char !== "#") {
            const input = document.querySelector(`.cell-input[data-row="${r}"][data-col="${c}"]`);
            input.value = char;
            input.dataset.oldVal = char;

            if (state.gameMode === "encrypted") {
              const cipher = parseInt(input.dataset.cipher);
              state.userMapping[cipher] = char;
            }
          }
        }
      }
      if (state.gameMode === "encrypted") {
        document.querySelectorAll(".legend-input").forEach(li => {
          const cipher = parseInt(li.dataset.cipher);
          li.value = state.cipherRevMap[cipher];
        });
      }
      updateHighlights(state.activeCell.r, state.activeCell.c);
      log("Soluzione dello schema rivelata.");
    }
  });

  // Gestione click sulla griglia
  dom.gridContainer.addEventListener("click", (e) => {
    const input = e.target.closest(".cell-input");
    if (!input) return;

    const r = parseInt(input.dataset.row);
    const c = parseInt(input.dataset.col);

    if (state.gameMode === "encrypted") {
      state.activeCell = { r, c };
    } else {
      if (state.activeCell.r === r && state.activeCell.c === c) {
        state.activeDirection = state.activeDirection === "H" ? "V" : "H";
      } else {
        state.activeCell = { r, c };
      }
    }
    input.setSelectionRange(input.value.length, input.value.length);
    updateHighlights(r, c);
  });

  dom.gridContainer.addEventListener("focusin", (e) => {
    const input = e.target;
    if (input.classList.contains("cell-input")) {
      input.setSelectionRange(input.value.length, input.value.length);
    }
  });

  dom.gridContainer.addEventListener("input", (e) => {
    const input = e.target;
    if (!input.classList.contains("cell-input")) return;

    const oldVal = input.dataset.oldVal || "";
    const cipherNum = parseInt(input.dataset.cipher);

    // Gestione barra spaziatrice per cambiare direzione (solo modalità classica)
    if (e.data === " " || input.value === oldVal + " " || input.value === " ") {
      input.value = oldVal;
      if (state.gameMode !== "encrypted") {
        state.activeDirection = state.activeDirection === "H" ? "V" : "H";
        updateHighlights(parseInt(input.dataset.row), parseInt(input.dataset.col));
      }
      return;
    }

    state.isTyping = true;

    // Gestione backspace tramite inputType sulle tastiere mobile
    if (e.inputType === "deleteContentBackward" || e.inputType === "deleteContentForward") {
      if (state.backspaceProcessedInKeydown) {
        state.isTyping = false;
        return;
      }

      // Se la casella conteneva una lettera, svuotala e basta
      if (oldVal) {
        if (state.gameMode === "encrypted") {
          if (!state.revealedNumbers.has(cipherNum)) {
            state.userMapping[cipherNum] = "";
            document.querySelectorAll(`.cell-input[data-cipher="${cipherNum}"]`).forEach(ci => {
              ci.value = "";
              ci.dataset.oldVal = "";
            });
            const legInput = document.querySelector(`.legend-input[data-cipher="${cipherNum}"]`);
            if (legInput) legInput.value = "";
          }
        } else {
          input.value = "";
          input.dataset.oldVal = "";
        }
        state.isTyping = false;
        return;
      }

      // Se era già vuota, torna indietro di una casella e svuotala
      input.value = "";
      if (state.activeDirection === "H") {
        moveFocus(0, -1);
      } else {
        moveFocus(-1, 0);
      }
      const prevInput = document.querySelector(`.cell-input[data-row="${state.activeCell.r}"][data-col="${state.activeCell.c}"]`);
      if (prevInput) {
        if (state.gameMode === "encrypted") {
          const prevCipher = parseInt(prevInput.dataset.cipher);
          if (!state.revealedNumbers.has(prevCipher)) {
            state.userMapping[prevCipher] = "";
            document.querySelectorAll(`.cell-input[data-cipher="${prevCipher}"]`).forEach(ci => {
              ci.value = "";
              ci.dataset.oldVal = "";
            });
            const legInput = document.querySelector(`.legend-input[data-cipher="${prevCipher}"]`);
            if (legInput) legInput.value = "";
          }
        } else {
          prevInput.value = "";
          prevInput.dataset.oldVal = "";
        }
      }
      state.isTyping = false;
      return;
    }

    // Pulisci e normalizza il valore (maiuscolo, senza spazi)
    let val = input.value.trim().toUpperCase().replace(/\s/g, "");
    if (val.length > 1) {
      // Sovrascrivi con l'ultimo carattere inserito
      if (val.startsWith(oldVal)) {
        val = val.substring(oldVal.length);
      } else if (val.endsWith(oldVal)) {
        val = val.substring(0, val.length - oldVal.length);
      } else {
        val = val.substring(val.length - 1);
      }
    }

    if (state.gameMode === "encrypted") {
      if (state.revealedNumbers.has(cipherNum)) {
        input.value = oldVal;
        state.isTyping = false;
        return;
      }

      state.userMapping[cipherNum] = val;
      document.querySelectorAll(`.cell-input[data-cipher="${cipherNum}"]`).forEach(ci => {
        ci.value = val;
        ci.dataset.oldVal = val;
      });
      const legInput = document.querySelector(`.legend-input[data-cipher="${cipherNum}"]`);
      if (legInput) legInput.value = val;
    } else {
      input.value = val;
      input.dataset.oldVal = val;
    }

    if (val) {
      if (state.activeDirection === "H") {
        moveFocus(0, 1);
      } else {
        moveFocus(1, 0);
      }
    }
    state.isTyping = false;
  });

  dom.gridContainer.addEventListener("keydown", (e) => {
    const input = e.target;
    if (!input.classList.contains("cell-input")) return;

    const r = parseInt(input.dataset.row);
    const c = parseInt(input.dataset.col);
    const cipherNum = parseInt(input.dataset.cipher);

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
        state.backspaceProcessedInKeydown = true;
        setTimeout(() => {
          state.backspaceProcessedInKeydown = false;
        }, 0);

        const currentVal = input.value;
        if (currentVal) {
          if (state.gameMode === "encrypted") {
            if (!state.revealedNumbers.has(cipherNum)) {
              state.userMapping[cipherNum] = "";
              document.querySelectorAll(`.cell-input[data-cipher="${cipherNum}"]`).forEach(ci => {
                ci.value = "";
                ci.dataset.oldVal = "";
              });
              const legInput = document.querySelector(`.legend-input[data-cipher="${cipherNum}"]`);
              if (legInput) legInput.value = "";
            }
          } else {
            input.value = "";
            input.dataset.oldVal = "";
          }
        } else {
          if (state.activeDirection === "H") {
            moveFocus(0, -1);
          } else {
            moveFocus(-1, 0);
          }
          const prevInput = document.querySelector(`.cell-input[data-row="${state.activeCell.r}"][data-col="${state.activeCell.c}"]`);
          if (prevInput) {
            if (state.gameMode === "encrypted") {
              const prevCipher = parseInt(prevInput.dataset.cipher);
              if (!state.revealedNumbers.has(prevCipher)) {
                state.userMapping[prevCipher] = "";
                document.querySelectorAll(`.cell-input[data-cipher="${prevCipher}"]`).forEach(ci => {
                  ci.value = "";
                  ci.dataset.oldVal = "";
                });
                const legInput = document.querySelector(`.legend-input[data-cipher="${prevCipher}"]`);
                if (legInput) legInput.value = "";
              }
            } else {
              prevInput.value = "";
              prevInput.dataset.oldVal = "";
            }
          }
        }
        break;
      case " ":
        e.preventDefault();
        if (state.gameMode !== "encrypted") {
          state.activeDirection = state.activeDirection === "H" ? "V" : "H";
          updateHighlights(r, c);
        }
        break;
    }
  });

  // Gestore eventi per input della legenda (delegazione)
  dom.legendGridContainer.addEventListener("input", (e) => {
    const input = e.target;
    if (!input.classList.contains("legend-input")) return;

    const cipher = parseInt(input.dataset.cipher);
    if (state.revealedNumbers.has(cipher)) return;

    const val = input.value.trim().toUpperCase();
    input.value = val;
    state.userMapping[cipher] = val;

    document.querySelectorAll(`.cell-input[data-cipher="${cipher}"]`).forEach(ci => {
      ci.value = val;
      ci.dataset.oldVal = val;
    });
  });

  // Previeni menu contestuale sulle caselle
  dom.gridContainer.addEventListener("contextmenu", (e) => {
    if (e.target.classList.contains("cell-input")) {
      e.preventDefault();
    }
  });

  // Impedisce la selezione nativa per bloccare i popup di sistema
  dom.gridContainer.addEventListener("select", (e) => {
    if (e.target.classList.contains("cell-input")) {
      e.preventDefault();
      e.target.selectionStart = e.target.selectionEnd;
    }
  });

  dom.gridContainer.addEventListener("selectstart", (e) => {
    if (e.target.classList.contains("cell-input")) {
      e.preventDefault();
    }
  });

  // Previene incollaggi nativi
  dom.gridContainer.addEventListener("beforeinput", (e) => {
    if (e.target.classList.contains("cell-input")) {
      if (e.inputType === "insertFromPaste" || e.inputType === "insertFromDrop") {
        e.preventDefault();
      }
    }
  });

  // Listener globale per prevenire popup iOS/Android
  document.addEventListener("selectionchange", () => {
    const active = document.activeElement;
    if (active && active.classList.contains("cell-input")) {
      if (active.selectionStart !== active.selectionEnd) {
        active.selectionStart = active.selectionEnd;
      }
    }
  });

  // Toggle direzione della barra mobile degli indizi (classico)
  const btnToggleDirMobile = document.getElementById("btn-toggle-direction-mobile");
  if (btnToggleDirMobile) {
    btnToggleDirMobile.addEventListener("click", (e) => {
      e.stopPropagation();
      if (state.gameMode === "encrypted") return;
      state.activeDirection = state.activeDirection === "H" ? "V" : "H";
      updateHighlights(state.activeCell.r, state.activeCell.c);
      log(`Direzione cambiata a: ${state.activeDirection === "H" ? "Orizzontali" : "Verticali"}`);
    });
  }

  // Toggle del pannello console
  const consoleHeader = document.getElementById("console-header-toggle");
  const consoleBody = document.getElementById("console-body");
  const consoleIcon = document.getElementById("console-toggle-icon");
  const btnClearConsole = document.getElementById("btn-clear-console");

  consoleHeader.addEventListener("click", () => {
    const isCollapsed = consoleBody.classList.toggle("collapsed");
    consoleIcon.className = isCollapsed ? "fa-solid fa-chevron-up" : "fa-solid fa-chevron-down";
  });

  btnClearConsole.addEventListener("click", (e) => {
    e.stopPropagation();
    const pre = document.getElementById("console-log-pre");
    if (pre) pre.textContent = "[Console svuotata]";
  });

  // Toggle del tema
  dom.themeToggle.addEventListener("click", () => {
    const isLight = document.body.classList.toggle("light-mode");
    document.body.classList.toggle("dark-mode", !isLight);
    try {
      localStorage.setItem("theme", isLight ? "light" : "dark");
    } catch (e) {
      console.warn("Storage write not allowed:", e);
    }
    dom.themeToggle.innerHTML = isLight ? '<i class="fa-solid fa-moon"></i>' : '<i class="fa-solid fa-sun"></i>';
    log(`Tema cambiato in modalità ${isLight ? "Chiara" : "Scura"}`);
  });

  // Gestione pulsante annulla/interrompi generazione
  if (dom.btnCancelGeneration) {
    dom.btnCancelGeneration.addEventListener("click", () => {
      cancelGeneration();
    });
  }

  // Gestione menu hamburger mobile
  if (dom.menuToggle && dom.controlsHeader) {
    dom.menuToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = dom.controlsHeader.classList.toggle("open");
      dom.menuToggle.innerHTML = isOpen ? '<i class="fa-solid fa-xmark"></i>' : '<i class="fa-solid fa-bars"></i>';
      dom.menuToggle.setAttribute("aria-expanded", isOpen);
    });

    // Chiudi il menu ad hamburger se si clicca fuori
    document.addEventListener("click", (e) => {
      if (!dom.controlsHeader.contains(e.target) && !dom.menuToggle.contains(e.target)) {
        dom.controlsHeader.classList.remove("open");
        dom.menuToggle.innerHTML = '<i class="fa-solid fa-bars"></i>';
        dom.menuToggle.setAttribute("aria-expanded", "false");
      }
    });

    // Chiudi il menu al cambio di una qualsiasi opzione
    const selectInputs = dom.controlsHeader.querySelectorAll("select");
    selectInputs.forEach(select => {
      select.addEventListener("change", () => {
        dom.controlsHeader.classList.remove("open");
        dom.menuToggle.innerHTML = '<i class="fa-solid fa-bars"></i>';
        dom.menuToggle.setAttribute("aria-expanded", "false");
      });
    });

    // Chiudi il menu al toggle del tema
    dom.themeToggle.addEventListener("click", () => {
      dom.controlsHeader.classList.remove("open");
      dom.menuToggle.innerHTML = '<i class="fa-solid fa-bars"></i>';
      dom.menuToggle.setAttribute("aria-expanded", "false");
    });
  }

  // Toggle globale della visibilità del pannello console tramite combinazione tasti (Ctrl/Cmd + \ o Ctrl/Cmd + Shift + L)
  document.addEventListener("keydown", (e) => {
    const hasModifier = e.ctrlKey || e.metaKey;
    const isCtrlBackslash = hasModifier && (e.key === "\\" || e.code === "Backslash");
    const isCtrlShiftL = hasModifier && e.shiftKey && (e.key === "l" || e.key === "L" || e.code === "KeyL");
    
    if (isCtrlBackslash || isCtrlShiftL) {
      e.preventDefault();
      const consoleSection = document.querySelector(".console-section");
      if (consoleSection) {
        const isCurrentlyHidden = consoleSection.classList.toggle("hidden");
        log(`Console ${isCurrentlyHidden ? "nascosta" : "mostrata"} tramite scorciatoia tastiera`);
      }
    }
  });
}
