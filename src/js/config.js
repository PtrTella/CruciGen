// config.js

// Generatore Gaussiana per slot length scoring
// center: lunghezza ideale degli slot (picco della campana)
// peakHeight: punteggio massimo al picco
// width: larghezza della campana (più alto = più piatta)
function generateGaussScores(center = 7.5, peakHeight = 45, width = 8) {
  const scores = {};
  for (let len = 1; len <= 15; len++) {
    let score = Math.round(peakHeight * Math.exp(-Math.pow(len - center, 2) / width));
    score -= 10;                        // Abbassa la baseline per penalizzare le code

    // Regole assolute di sicurezza
    if (len === 1)  score = -100;       // Slot singoli: fortemente penalizzati
    if (len === 2)  score = -25;        // Slot da 2: rischiosi per il backtracking
    if (len >= 13)  score -= 10;        // Slot lunghissimi: dizionario molto scarso

    scores[len] = score;
  }
  return scores;
}

const CRUCIGEN_CONFIG = {
  maxGenerationAttempts: 30,          // Max tentativi rigenerazione layout
  gridTopologyCandidates: 200,        // Candidati topologia valutati
  maxStepsBySize: {                   // Passi backtracking per dimensione
    9: 15000,                         // 9x9
    11: 25000,                        // 11x11
    13: 35000,                        // 13x13
    15: 45000                         // 15x15
  },
  candidateJitterWindow: 80,          // Parole top rimescolate per varietà
  // Percentuale assoluta di caselle nere per ogni livello di difficoltà
  // easy  → più nere → slot corti → parole comuni brevi
  // medium → bilanciato
  // hard  → meno nere → slot lunghi → parole rare lunghe
  blackSquarePercentByDifficulty: {
    easy: 0.23,                     // 23% caselle nere
    medium: 0.17,                   // 17% caselle nere
    hard: 0.12                      // 12% caselle nere
  },
  // Soglie rating parola per i pool preferred/fallback (0.0 = facilissima, 1.0 = difficilissima)
  difficultyThresholds: {
    easy: 0.35,                       // Sotto questa soglia → parola "facile"
    hard: 0.65                        // Sopra questa soglia → parola "difficile"
  },
  // Frazioni della larghezza griglia per il centro della Gaussiana.
  // Il centro viene calcolato come: Math.round(N_cols × fraction)
  // così si adatta automaticamente a tutte le dimensioni griglia:
  //   9x9  → easy=4.5  medium=6   hard=7.2
  //   11x11 → easy=5.5  medium=7.4 hard=8.8
  //   13x13 → easy=6.5  medium=8.7 hard=10.4
  //   15x15 → easy=7.5  medium=10  hard=12
  lengthCenterFractions: {
    easy:   0.50,   // picco a metà griglia (parole brevi, incroci facili)
    medium: 0.67,   // picco a 2/3 della griglia (cruciverba classico)
    hard:   0.80    // picco a 4/5 della griglia (parole lunghe, difficili)
  }

};

// Rendiamo l'oggetto accessibile globalmente nei diversi contesti
if (typeof self !== 'undefined') {
  self.CRUCIGEN_CONFIG = CRUCIGEN_CONFIG;
}
if (typeof window !== 'undefined') {
  window.CRUCIGEN_CONFIG = CRUCIGEN_CONFIG;
}
