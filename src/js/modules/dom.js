// src/js/modules/dom.js
// Selettore e contenitore dei riferimenti agli elementi del DOM.

export const dom = {};

export function initDOM() {
  dom.gridContainer = document.getElementById("crossword-grid-container");
  dom.selectSize = document.getElementById("select-size");
  dom.btnNew = document.getElementById("btn-new");
  dom.btnVerify = document.getElementById("btn-verify");
  dom.btnClear = document.getElementById("btn-clear");
  dom.btnReveal = document.getElementById("btn-reveal");
  dom.themeToggle = document.getElementById("theme-toggle");
  dom.loader = document.getElementById("loader");
  dom.loaderText = document.getElementById("loader-text");
  dom.listHorizontal = document.getElementById("clues-horizontal-list");
  dom.listVertical = document.getElementById("clues-vertical-list");
  dom.mobileClueBar = document.getElementById("mobile-clue-bar");
  dom.mobileBadge = document.getElementById("mobile-badge");
  dom.mobileClueText = document.getElementById("mobile-clue-text");
  dom.selectMode = document.getElementById("select-mode");
  dom.encryptedLegendCard = document.getElementById("encrypted-legend-card");
  dom.legendGridContainer = document.getElementById("legend-grid-container");
  dom.cluesHorizontalCard = document.getElementById("clues-horizontal-card");
  dom.cluesVerticalCard = document.getElementById("clues-vertical-card");
  dom.difficultyBadge = document.getElementById("crossword-difficulty-badge");
}
