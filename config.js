// config.js
// Configurazione globale condivisa per CruciGen (utilizzabile dal thread principale e dal Web Worker)

const CRUCIGEN_CONFIG = {
  maxSteps: 8000,
  blackSquareTargetMultiplier: 0.17,
  lengthScores: {
    1: -150,
    2: -15,
    3: -3,
    4: 5,
    5: 25,
    6: 25,
    7: 15,
    8: 10,
    9: 5,
    10: 2,
    11: 0,
    12: 0,
    13: 0,
    14: 0,
    15: 0
  }
};

// Rendiamo l'oggetto accessibile globalmente nei diversi contesti
if (typeof self !== 'undefined') {
  self.CRUCIGEN_CONFIG = CRUCIGEN_CONFIG;
}
if (typeof window !== 'undefined') {
  window.CRUCIGEN_CONFIG = CRUCIGEN_CONFIG;
}
