// src/js/modules/theme.js
// Gestione del caricamento e dell'inizializzazione del tema grafico.

import { dom } from "./dom.js";

export function initTheme() {
  let savedTheme = "light";
  try {
    savedTheme = localStorage.getItem("theme") || "dark";
  } catch (e) {
    console.warn("Storage access not allowed:", e);
  }
  if (savedTheme === "light") {
    document.body.classList.remove("dark-mode");
    document.body.classList.add("light-mode");
    dom.themeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
  } else {
    document.body.classList.add("dark-mode");
    document.body.classList.remove("light-mode");
    dom.themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
  }
}
