// src/js/worker.js
// Web Worker per la generazione dinamica della topologia e risoluzione via backtracking search.

const queryParams = new URLSearchParams(self.location.search);
const version = queryParams.get("v") || new Date().getTime();

importScripts(
  "config.js?v=" + version,
  "worker/trie.js?v=" + version,
  "worker/utils.js?v=" + version,
  "worker/generator.js?v=" + version,
  "worker/solver.js?v=" + version
);

dictionary = null;
wordScores = {};
dictionaryKeys = {};

self.onmessage = function (e) {
  const { action, template, dict, rows, cols, targetDifficulty } = e.data;

  if (action === "init") {
    dictionary = dict;
    wordScores = {};
    dictionaryKeys = {};
    trieRoots = {};

    for (const len in dictionary) {
      const lengthInt = parseInt(len);
      // Pre-calcola i punteggi
      for (const word in dictionary[len]) {
        wordScores[word] = calculateWordScore(word, lengthInt);
      }

      // Ordina per punteggio decrescente
      const sortedWords = Object.keys(dictionary[len]).sort((a, b) => wordScores[b] - wordScores[a]);
      dictionaryKeys[len] = sortedWords;

      // Inserisci nel Trie in ordine decrescente di punteggio
      for (const word of sortedWords) {
        insertWord(word, lengthInt);
      }
    }
    self.postMessage({ status: "ready" });
    return;
  }

  if (action === "generate") {
    if (!dictionary) {
      self.postMessage({ status: "error", message: "Dictionary not initialized" });
      return;
    }

    try {
      let actualTemplate = template;

      // Se non viene passato un template precompilato, lo generiamo proceduralmente
      if (!actualTemplate && rows && cols) {
        actualTemplate = generateGridTopology(rows, cols, targetDifficulty);
      }

      if (!actualTemplate) {
        self.postMessage({ status: "error", message: "Impossibile generare o ricevere una topologia valida." });
        return;
      }

      const result = generateCrossword(actualTemplate, targetDifficulty);
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
