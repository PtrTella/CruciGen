// src/js/modules/worker-client.js
// Client di gestione e comunicazione con il Web Worker.

import { state } from "./state.js";
import { dom } from "./dom.js";
import { log } from "./logger.js";
import { showLoader, hideLoader, renderGrid, renderClues, focusFirstCell, animateClueWordReveal } from "./ui.js";

export function initWorker() {
  log("Inizializzazione Web Worker...");
  state.worker = new Worker("src/js/worker.js?v=" + new Date().getTime());

  state.worker.onerror = (err) => {
    log(`[WORKER ERROR] ${err.message} in ${err.filename}:${err.lineno}`);
  };

  state.worker.onmessage = (e) => {
    const { status, result, message } = e.data;
    log(`Messaggio ricevuto dal worker: status = "${status}"`);

    if (status === "ready") {
      log("Dizionario registrato nel Web Worker con successo!");
      state.dictionaryLoaded = true;
      generateNewCrossword();
    } else if (status === "success") {
      log(`Generazione completata con successo in ${result.steps} passi di backtracking!`);
      hideLoader();
      state.currentCrossword = result;
      if (state.gameMode === "encrypted") {
        initEncryptedCrossword(result);
      }
      renderGrid();
      renderClues();
      focusFirstCell();
      if (state.gameMode === "encrypted" && state.currentClueWord) {
        animateClueWordReveal(state.currentClueWord);
      }
    } else if (status === "failed") {
      log(`[WARNING] Il risolutore ha fallito l'incastro per questo layout.`);
      const maxAtt = (typeof CRUCIGEN_CONFIG !== 'undefined' && CRUCIGEN_CONFIG.maxGenerationAttempts) || 5;
      if (state.generationAttempts < maxAtt) {
        state.generationAttempts++;
        log(`Tentativo di generazione #${state.generationAttempts + 1} con un layout/trasformazione alternativo...`);
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

export async function loadDictionary() {
  log("Avvio caricamento dizionario (dictionary.json)...");
  showLoader("Caricamento dizionario italiano...");
  try {
    const response = await fetch("src/assets/dictionary.json?v=" + new Date().getTime());
    log(`Stato risposta fetch dizionario: ${response.status}`);
    const dict = await response.json();

    let totalWords = 0;
    for (const len in dict) {
      totalWords += Object.keys(dict[len]).length;
    }
    log(`Dizionario caricato. Totale parole indicizzate: ${totalWords}`);

    state.worker.postMessage({ action: "init", dict });
  } catch (err) {
    log(`[ERRORE DIZIONARIO] ${err.message}`);
    dom.loaderText.innerText = "Errore nel caricamento del dizionario.";
  }
}

export function generateNewCrossword(isRetry = false) {
  if (!state.dictionaryLoaded) return;
  
  // Pulisci eventuali animazioni in corso prima della nuova generazione
  state.animationTimeouts.forEach(clearTimeout);
  state.animationTimeouts = [];

  showLoader("Generazione schema in corso...");

  if (isRetry !== true) {
    state.generationAttempts = 0;
  }

  const size = parseInt(dom.selectSize ? dom.selectSize.value : 9) || 9;
  log(`Richiesta nuova topologia ${size}x${size} al Web Worker...`);
  state.worker.postMessage({ action: "generate", rows: size, cols: size });
}

function initEncryptedCrossword(result) {
  // 1. Trova tutte le lettere uniche nella soluzione (escludendo '#')
  const letters = new Set();
  const rows = result.solution.length;
  const cols = result.solution[0].length;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const char = result.solution[r][c];
      if (char !== '#') {
        letters.add(char.toUpperCase());
      }
    }
  }

  const uniqueLetters = Array.from(letters);
  // 2. Crea un mapping casuale (mescolato)
  // Mescoliamo i numeri da 1 a uniqueLetters.length
  const numbers = [];
  for (let i = 1; i <= uniqueLetters.length; i++) {
    numbers.push(i);
  }
  // Shuffle numbers
  for (let i = numbers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = numbers[i];
    numbers[i] = numbers[j];
    numbers[j] = temp;
  }

  state.cipherMap = {};
  state.cipherRevMap = {};
  uniqueLetters.forEach((letter, index) => {
    const num = numbers[index];
    state.cipherMap[letter] = num;
    state.cipherRevMap[num] = letter;
  });

  // 3. Trova una parola indizio iniziale (lunghezza 3 o 4) con massimo punteggio di occorrenza
  const candidates = [];
  const allClues = [...result.horizontalClues, ...result.verticalClues];
  
  // Trova i candidati di lunghezza 3 o 4
  let targetClues = allClues.filter(c => c.length === 3 || c.length === 4);
  if (targetClues.length === 0) {
    // Fallback se non ci sono parole da 3 o 4 lettere
    targetClues = allClues.filter(c => c.length === 5);
  }
  if (targetClues.length === 0) {
    // Ultimo fallback
    targetClues = allClues;
  }

  // Calcoliamo la frequenza di ciascuna lettera nella griglia intera
  const letterFreqs = {};
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const char = result.solution[r][c];
      if (char !== '#') {
        const uChar = char.toUpperCase();
        letterFreqs[uChar] = (letterFreqs[uChar] || 0) + 1;
      }
    }
  }

  // Calcola il punteggio di ciascuna parola candidata
  let bestClue = null;
  let bestScore = -Infinity;

  targetClues.forEach(clue => {
    const word = clue.word.toUpperCase();
    const uniqueWordLetters = new Set(word);
    let score = 0;
    uniqueWordLetters.forEach(l => {
      score += (letterFreqs[l] || 0);
    });

    if (score > bestScore) {
      bestScore = score;
      bestClue = clue;
    }
  });

  state.revealedNumbers.clear();
  state.userMapping = {};
  state.startWordCoordinates.clear();

  // Rileva tutti i numeri da 1 a uniqueLetters.length e inizializza userMapping a ""
  for (let i = 1; i <= uniqueLetters.length; i++) {
    state.userMapping[i] = "";
  }

  if (bestClue) {
    log(`Parola indizio selezionata per cifratura iniziale: "${bestClue.word}" (punteggio occorrenza: ${bestScore})`);
    state.startWordCoordinates = new Set(bestClue.cells.map(([r, c]) => `${r},${c}`));
    state.currentClueWord = bestClue;
  } else {
    state.currentClueWord = null;
  }
}
