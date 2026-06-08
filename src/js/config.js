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
  candidateJitterWindow: 55,          // Finestra di jitter: quante parole top vengono rimescolate prima della selezione.

  // Calcola dinamicamente i passi di backtracking massimi consentiti.
  getBacktrackingSteps: function (size, difficulty) {
    const base = 700;
    const difficultyMultipliers = {
      easy: 1,
      medium: 1.3,
      hard: 1.9
    };
    if (!difficultyMultipliers.hasOwnProperty(difficulty)) {
      throw new Error(`[CRUCIGEN_CONFIG] getBacktrackingSteps: Invalid difficulty: ${difficulty}`);
    }
    const sizeMult = Math.pow(1.12, size - 9);
    const diffMult = difficultyMultipliers[difficulty];
    return Math.round(base * sizeMult * diffMult);
  },


  // ── Topologia griglia ─────────────────────────────────────────────────────
  // Calcola dinamicamente la percentuale ideale di caselle nere in base a dimensione e difficoltà.
  // Incrementa la densità sulle griglie più grandi in modalità hard/medium per accorciare gli slot e facilitare l'incastro.
  getBlackSquarePercent: function (size, difficulty) {
    const base = 0.14;
    const difficultyMultipliers = {
      easy: 1.4,
      medium: 1.2,
      hard: 1
    };
    if (!difficultyMultipliers.hasOwnProperty(difficulty)) {
      throw new Error(`[CRUCIGEN_CONFIG] getBlackSquarePercent: Invalid difficulty: ${difficulty}`);
    }
    const sizeMult = 1.0 + (size - 9) * 0.04;
    const diffMult = difficultyMultipliers[difficulty];
    return base * sizeMult * diffMult;
  },

  // ── Selezione parole ──────────────────────────────────────────────────────
  // Pool "preferred" = parole entro la soglia di difficoltà.
  // Pool "fallback"  = tutto il resto.
  // Il solver prova preferred prima; se non trova soluzione scende nel fallback.
  difficultyThresholds: {
    easy: 0.30,
    hard: 0.70
  },

  // ── Gaussiana per valutazione slot ───────────────────────────────────────
  // center = Math.round(N_cols × fraction)  — si adatta alla dimensione reale.
  lengthCenterFractions: {
    easy: 0.6,   // metà griglia  (invariato)
    medium: 0.65,   // ~5/8 griglia  (era 0.67, ridotto per evitare slot impossibili su 15x15)
    hard: 0.7    // ~3/4 griglia  (era 0.80, ridotto per bilanciare qualità e risolvibilità)
  }

};


// Rendiamo l'oggetto accessibile globalmente nei diversi contesti
if (typeof self !== 'undefined') {
  self.CRUCIGEN_CONFIG = CRUCIGEN_CONFIG;
}
if (typeof window !== 'undefined') {
  window.CRUCIGEN_CONFIG = CRUCIGEN_CONFIG;
}
