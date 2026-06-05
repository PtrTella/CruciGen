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
  return score;
}
