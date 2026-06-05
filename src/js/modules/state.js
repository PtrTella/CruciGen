// src/js/modules/state.js
// Gestore dello stato globale dell'applicazione.

export const state = {
  worker: null,
  currentCrossword: null, // Memorizza l'output del risolutore
  activeCell: { r: 0, c: 0 },
  activeDirection: "H", // "H" = Orizzontali, "V" = Verticali
  dictionaryLoaded: false,
  isTyping: false,
  backspaceProcessedInKeydown: false,
  generationAttempts: 0,
  gameMode: "classic", // "classic" o "encrypted"
  cipherMap: {}, // Mappa Lettera -> Numero (es: 'A' -> 1)
  cipherRevMap: {}, // Mappa Numero -> Lettera (es: 1 -> 'A')
  revealedNumbers: new Set(), // Numeri cifrati pre-rivelati (parola indizio)
  userMapping: {} // Numero -> Lettera dell'utente (es: 2 -> 'E')
};
