#!/usr/bin/env python3
"""
rebuild.py — Pipeline completa di rigenerazione del dizionario CruciGen
=======================================================================

Esegue in sequenza:
  1. compile_difficulty.py  → aggiunge/aggiorna difficulty + pos su ogni parola
  2. optimize_dictionary.py → converte nel formato compatto [diff, clues, pos]
  3. dictionary_stats.py    → mostra le statistiche finali

NON scarica i dataset raw (usa download_and_compile.py + copia manuale se
si vuole ripartire da zero; vedi commento --full di seguito).

Uso:
  python utils/rebuild.py           # aggiorna scores + ottimizza
  python utils/rebuild.py --full    # scarica raw, poi aggiorna scores + ottimizza
  python utils/rebuild.py --stats   # solo statistiche, nessuna modifica
"""
import sys
import os
import time

UTILS_DIR = os.path.dirname(__file__)
ROOT_DIR  = os.path.dirname(UTILS_DIR)


def step(title: str):
    bar = "=" * 60
    print(f"\n{bar}")
    print(f"  {title}")
    print(f"{bar}")


def run_step(label: str, fn, *args, **kwargs):
    step(label)
    t0 = time.time()
    try:
        fn(*args, **kwargs)
    except SystemExit:
        pass   # alcuni script chiamano sys.exit(0) — va bene
    except Exception as e:
        print(f"\n[ERRORE] {e}")
        sys.exit(1)
    elapsed = time.time() - t0
    print(f"\n  Completato in {elapsed:.1f}s")


def main():
    args = sys.argv[1:]
    mode_full   = "--full"  in args
    mode_stats  = "--stats" in args

    # Parse options (default is to run typo cleaning, disable via --no-clean)
    run_clean = "--no-clean" not in args

    print("=" * 60)
    print("  CruciGen — Pipeline rigenerazione dizionario")
    print("=" * 60)

    if mode_stats:
        # Solo statistiche
        import dictionary_stats
        run_step("Statistiche dizionario", dictionary_stats.main)
        return

    if mode_full:
        # Scarica raw dataset, poi aggiorna dictionary in src/assets
        import download_and_compile
        run_step(
            "Step 0 — Download raw dataset (HuggingFace)",
            download_and_compile.main
        )
        # Copia utils/dictionary.json → src/assets/dictionary.json
        import shutil
        src  = os.path.join(UTILS_DIR, "dictionary.json")
        dest = os.path.join(ROOT_DIR, "src", "assets", "dictionary.json")
        if os.path.exists(src):
            step("Step 0b — Copia raw → src/assets/dictionary.json")
            shutil.copy2(src, dest)
            print(f"  {src}  →  {dest}")
        else:
            print(f"[ATTENZIONE] {src} non trovato, skip copia.")

    # Step 1 — Assegna difficulty + pos
    import compile_difficulty
    run_step(
        "Step 1 — Calcolo difficulty + POS (itWaC)",
        compile_difficulty.main
    )

    # Step 1.5 — Rimozione refusi (typos)
    if run_clean:
        import clean_typos
        run_step(
            "Step 1.5 — Rimozione refusi (typos)",
            clean_typos.main
        )
    else:
        print("\n  [INFO] Rimozione refusi saltata (--no-clean)")

    # Step 2 — Ottimizza formato
    import optimize_dictionary
    run_step(
        "Step 2 — Ottimizzazione formato compatto [diff, clues, pos]",
        optimize_dictionary.main
    )

    # Step 3 — Statistiche finali
    import dictionary_stats
    run_step(
        "Step 3 — Statistiche finali",
        dictionary_stats.main
    )

    print("\n" + "=" * 60)
    print("  ✓ Pipeline completata.")
    if not mode_full:
        print("  Nota: per scaricare anche il raw dataset, usa --full")
    print("  Nota: per saltare la rimozione dei refusi, usa --no-clean")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    # Aggiunge utils/ al path così gli import funzionano senza installare nulla
    sys.path.insert(0, UTILS_DIR)
    main()
