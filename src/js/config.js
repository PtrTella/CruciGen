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
    if (len === 1) score = -100;       // Slot singoli: fortemente penalizzati
    if (len === 2) score = -25;        // Slot da 2: rischiosi per il backtracking
    if (len >= 13) score -= 10;        // Slot lunghissimi: dizionario molto scarso

    scores[len] = score;
  }
  return scores;
}

const CRUCIGEN_CONFIG = {
  // ── Generazione ──────────────────────────────────────────────────────────
  maxGenerationAttempts: 30,          // Max retry su topologie diverse prima di arrendersi
  gridTopologyCandidates: 300,        // Candidati topologia valutati (era 200; più = migliore qualità griglia)

  // Passi backtracking massimi per dimensione.
  // Più alto = più probabilità di trovare soluzione, ma più lento.
  // Aumentati rispetto ai valori precedenti per supportare 13x13 e 15x15.
  maxStepsBySize: {
    9: 2000,   // 9x9   (era 15000)
    11: 4000,   // 11x11 (era 25000)
    13: 6500,   // 13x13 (era 35000)
    15: 1000    // 15x15 (era 45000)
  },

  // Finestra di jitter: quante parole top vengono rimescolate prima della selezione.
  // Più basso = risultati più consistenti e meno caos nel backtracking.
  candidateJitterWindow: 55,          // (era 80)

  // ── Topologia griglia ─────────────────────────────────────────────────────
  // easy  → più nere → slot corti → parole brevi e comuni
  // medium → bilancio classico da cruciverba italiano
  // hard  → meno nere → slot lunghi → parole rare
  // Nota: hard a 0.13 invece di 0.12 migliora la risolvibilità su griglie grandi (13x13, 15x15)
  blackSquarePercentByDifficulty: {
    easy: 0.22,   // 22% caselle nere (era 23%)
    medium: 0.17,   // 17% caselle nere (invariato)
    hard: 0.13    // 13% caselle nere (era 12%, più solvibile su grids grandi)
  },

  // ── Selezione parole ──────────────────────────────────────────────────────
  // Pool "preferred" = parole entro la soglia di difficoltà.
  // Pool "fallback"  = tutto il resto.
  // Il solver prova preferred prima; se non trova soluzione scende nel fallback.
  difficultyThresholds: {
    easy: 0.32,    // Solo parole molto comuni (era 0.35 → pool ~25%, ora ~18%)
    hard: 0.62     // Parole difficili anticipate (era 0.65 → pool ~50%, ora ~55%)
  },

  // ── Gaussiana per valutazione slot ───────────────────────────────────────
  // center = Math.round(N_cols × fraction)  — si adatta alla dimensione reale.
  // Frazioni ridotte rispetto ai valori precedenti per evitare di premiare
  // slot irraggiungibili su griglie grandi (es. 15x15 hard center=12 era troppo).
  //
  //            easy     medium   hard
  //   9x9   →   4.5      5.6      6.5
  //   11x11 →   5.5      6.8      7.9
  //   13x13 →   6.5      8.1      9.4
  //   15x15 →   7.5      9.3     10.8
  lengthCenterFractions: {
    easy: 0.50,   // metà griglia  (invariato)
    medium: 0.62,   // ~5/8 griglia  (era 0.67, ridotto per evitare slot impossibili su 15x15)
    hard: 0.72    // ~3/4 griglia  (era 0.80, ridotto per bilanciare qualità e risolvibilità)
  }

};


// Rendiamo l'oggetto accessibile globalmente nei diversi contesti
if (typeof self !== 'undefined') {
  self.CRUCIGEN_CONFIG = CRUCIGEN_CONFIG;
}
if (typeof window !== 'undefined') {
  window.CRUCIGEN_CONFIG = CRUCIGEN_CONFIG;
}
