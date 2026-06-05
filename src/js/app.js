// src/js/app.js
// Entry point principale dell'applicazione CruciGen (ES Module).

import { initDOM, dom } from "./modules/dom.js";
import { initTheme } from "./modules/theme.js";
import { setupEventListeners } from "./modules/events.js";
import { initWorker, loadDictionary } from "./modules/worker-client.js";
import { log } from "./modules/logger.js";

import { state } from "./modules/state.js";

// Inizializza l'applicazione
function initApp() {
  initDOM();
  // Sincronizza lo stato iniziale con il valore dei selettori (previene anomalie di autocomplete al reload)
  if (dom.selectMode) {
    state.gameMode = dom.selectMode.value;
  }
  initTheme();
  setupEventListeners();
  initWorker();
  loadDictionary();
  registerServiceWorker();
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}

// Registrazione del Service Worker per il PWA
function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("sw.js")
      .then((reg) => {
        log("Service Worker registrato con successo!");
      })
      .catch((err) => {
        log(`Impossibile registrare il Service Worker: ${err.message}`);
      });
  }
}
