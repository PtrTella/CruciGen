# CruciGen - Generatore di Cruciverba Infiniti

**CruciGen** è un'applicazione web statica (Single Page Application) che permette di generare all'infinito cruciverba professionali e simmetrici in italiano, dotati di definizioni curate per ogni parola.

L'applicazione è progettata per essere leggera, autonoma e facilmente hostabile a costo zero su **GitHub Pages**.

## 🚀 Funzionalità

- **Generazione Infinita**: Algoritmo di incastro automatico basato su griglie simmetriche professionali (nei formati 9x9 e 11x11).
- **Dizionario Integrato offline**: Contiene **8.002 parole comuni italiane** con definizioni concise, evitando problemi di sicurezza legati al CORS o dipendenze da API esterne a pagamento.
- **Web Worker**: Tutta la logica di ricerca delle parole crociate (Constraint Satisfaction / Backtracking) è delegata a un Web Worker in background per evitare rallentamenti dell'interfaccia utente.
- **Interfaccia Premium**: Design moderno con supporto Dark/Light Mode, layout responsive (desktop e mobile) ed effetti glassmorphism.
- **UX da Tastiera e Mobile**: Supporto completo ai tasti freccia, tasto `Spazio` per cambiare direzione e `Backspace` intelligente. Su mobile, le definizioni attive sono mostrate in una barra persistente per facilitare l'inserimento.
- **Funzionalità di Gioco**: Pulsanti per la verifica istantanea delle lettere errate, svuotamento dello schema e visualizzazione della soluzione completa.

---

## 🛠️ Come Avviarlo Localmente

Poiché l'applicazione utilizza **Web Worker** e chiamate `fetch` asincrone per caricare il dizionario, i browser moderni bloccano l'esecuzione se i file vengono aperti direttamente tramite doppio click (schema `file://`). È necessario avviare un server locale leggero.

Ecco tre metodi semplicissimi per farlo:

### Metodo 1: Usando Python (Preinstallato su quasi tutti i sistemi)
Apri il terminale nella cartella del progetto e avvia:
```bash
python3 -m http.server 8000
```
Ora apri il browser su: `http://localhost:8000`

### Metodo 2: Usando Node.js / npx
Se hai Node.js installato, esegui:
```bash
npx http-server -p 8000
```
Ora apri il browser su: `http://localhost:8000`

### Metodo 3: Estensione VS Code (Live Server)
Se usi Visual Studio Code, installa l'estensione **Live Server**, apri la cartella del progetto e clicca su **"Go Live"** in basso a destra.

---

## 📦 Pubblicazione su GitHub Pages

Per pubblicare il tuo sito web gratuitamente:

1. Crea un nuovo repository su GitHub (es. `crucigen`).
2. Inizializza git e carica i file nel tuo repository:
   ```bash
   git init
   git add .
   git commit -m "Primo commit di CruciGen"
   git branch -M main
   git remote add origin https://github.com/TUO-UTENTE/crucigen.git
   git push -u origin main
   ```
3. Su GitHub, vai in **Settings** > **Pages** del tuo repository.
4. Sotto **Build and deployment**, imposta la sorgente su **Deploy from a branch** e seleziona il branch `main` (cartella `/root`).
5. Clicca su **Save**. Dopo pochi minuti, il tuo sito sarà online all'indirizzo `https://TUO-UTENTE.github.io/crucigen/`!

---

## 🧠 Struttura del Progetto

- `index.html`: La struttura della pagina e dell'interfaccia di gioco.
- `style.css`: Il design system responsivo con variabili HSL e transizioni.
- `app.js`: Il gestore degli input utente, dello stato del gioco e della griglia.
- `worker.js`: Il motore algoritmico che esegue la risoluzione del cruciverba in background.
- `templates.js`: La collezione di schemi con caselle nere simmetriche.
- `dictionary.json`: Il dizionario di parole e indizi.
