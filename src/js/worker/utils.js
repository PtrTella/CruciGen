// src/js/worker/utils.js
// Funzioni di utilità per il Web Worker.

function calculateWordScore(word, len) {
  let score = 0;
  const vowels = (word.match(/[AEIOU]/g) || []).length;
  const vowelRatio = vowels / len;

  if (vowelRatio >= 0.4 && vowelRatio <= 0.6) {
    score += 15;
  } else if (vowelRatio >= 0.3 && vowelRatio <= 0.7) {
    score += 5;
  }

  const uniqueLetters = new Set(word).size;
  score += (uniqueLetters / len) * 10;

  // Preferisci parole con difficoltà minore (più facili/comuni)
  let difficulty = 0.5;
  if (typeof dictionary !== 'undefined' && dictionary) {
    const entry = dictionary[len.toString()][word];
    if (entry && typeof entry === 'object' && 'difficulty' in entry) {
      difficulty = entry.difficulty;
    }
  }
  // Sottraiamo valore al punteggio in base alla difficoltà (0.0 è facilissima, 1.0 difficilissima)
  score += (1.0 - difficulty) * 20;

  return score;
}
