// config.js

// Generatore matematico della Curva Gaussiana
function generateGaussScores() {
  const scores = {};

  // Parametri della campana
  const peakHeight = 45; // Altezza massima della campana (Punteggio max)
  const center = 7.5;    // Centro della campana (esattamente tra 7 e 8)
  const width = 8;       // "Ampiezza" della campana (più è alto, più 5 e 10 prendono punti)

  for (let len = 1; len <= 15; len++) {
    // Formula della Distribuzione Normale (Gaussiana)
    let score = Math.round(peakHeight * Math.exp(-Math.pow(len - center, 2) / width));

    // Abbassiamo l'asse X di 10 punti per far andare in negativo le code
    score -= 10;

    // Regole di sicurezza assolute (Overrides)
    if (len === 1) score = -100; // Forte penalità per parole solo veritcali o orizzontali prima gli incorci
    if (len === 2) score = -25;  // Penalità fissa per le 2 lettere (troppo rischiose per stalli)
    if (len >= 13) score -= 10;  // Extra malus per 13+ (il dizionario ne ha pochissime)

    scores[len] = score;
  }

  return scores;
}

const CRUCIGEN_CONFIG = {
  maxGenerationAttempts: 30,          // Max tentativi rigenerazione layout
  gridTopologyCandidates: 200,        // Candidati topologia valutati
  maxStepsBySize: {                   // Passi backtracking per dimensione
    9: 1000,                          // 9x9
    11: 2000,                         // 11x11
    13: 4500,                         // 13x13
    15: 8000                          // 15x15
  },
  candidateJitterWindow: 80,          // Parole top rimescolate per varietà
  blackSquareTargetMultiplier: 0.17,  // % ideale caselle nere (0.17 = 17%)
  lengthScores: generateGaussScores() // Punteggi lunghezze parole (Gaussiana)
};

// Rendiamo l'oggetto accessibile globalmente nei diversi contesti
if (typeof self !== 'undefined') {
  self.CRUCIGEN_CONFIG = CRUCIGEN_CONFIG;
}
if (typeof window !== 'undefined') {
  window.CRUCIGEN_CONFIG = CRUCIGEN_CONFIG;
}
