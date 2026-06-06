#!/usr/bin/env python3
"""
download_and_compile.py
=======================
STEP 1 of 2 — Raw dataset downloader and compiler.

Downloads the cruciverb-it/evalita2026 CSV splits from HuggingFace and compiles
them into a raw dictionary.json at utils/dictionary.json.

Format produced:
  { "<length>": { "<WORD>": { "clues": ["def1", "def2", ...] } } }

NOTE: The output does NOT contain difficulty or pos fields.
      Run compile_difficulty.py (Step 2) to add those scores.

Workflow:
  1. python utils/download_and_compile.py         → utils/dictionary.json  (raw, no scores)
  2. python utils/compile_difficulty.py           → src/assets/dictionary.json  (final, with scores)

WARNING: This script does NOT touch src/assets/dictionary.json.
         If you want to rebuild from scratch, manually copy utils/dictionary.json
         to src/assets/dictionary.json before running compile_difficulty.py.
"""
import os
import csv
import json
import urllib.request
import unicodedata

DATASET_DIR   = os.path.join(os.path.dirname(__file__), "dataset")
OUTPUT_PATH   = os.path.join(os.path.dirname(__file__), "dictionary.json")

SPLITS = {
    "train.csv":     "https://huggingface.co/datasets/cruciverb-it/evalita2026/resolve/main/task_1/datasets/train.csv",
    "val.csv":       "https://huggingface.co/datasets/cruciverb-it/evalita2026/resolve/main/task_1/datasets/val.csv",
    "test_gold.csv": "https://huggingface.co/datasets/cruciverb-it/evalita2026/resolve/main/task_1/datasets/test_gold.csv"
}

def canonize_word(w: str) -> str:
    """Strip accents, uppercase, keep only A-Z."""
    nfkd = unicodedata.normalize('NFKD', w)
    return "".join(c for c in nfkd if not unicodedata.combining(c)).upper()

def main():
    os.makedirs(DATASET_DIR, exist_ok=True)

    compiled: dict[str, dict[str, dict]] = {}
    unique_words = 0
    total_clues  = 0

    headers = {"User-Agent": "Mozilla/5.0"}

    for name, url in SPLITS.items():
        local_path = os.path.join(DATASET_DIR, name)

        # Download only if not cached
        if not os.path.exists(local_path):
            print(f"Downloading {name} from HuggingFace...")
            try:
                req = urllib.request.Request(url, headers=headers)
                with urllib.request.urlopen(req) as resp:
                    content = resp.read()
                with open(local_path, "wb") as f:
                    f.write(content)
                print(f"  Saved → {local_path}")
            except Exception as e:
                print(f"  ERROR downloading {name}: {e}")
                continue
        else:
            print(f"Using cached {name}...")

        # Parse CSV: expected columns [clue, answer, ...]
        print(f"  Processing {name}...")
        try:
            with open(local_path, "r", encoding="utf-8", errors="ignore") as f:
                reader = csv.reader(f)
                try:
                    next(reader)  # skip header
                except StopIteration:
                    continue

                for row in reader:
                    if len(row) < 2:
                        continue
                    clue, answer = row[0].strip(), row[1].strip()
                    if not clue or not answer:
                        continue

                    norm = canonize_word(answer)
                    if len(norm) <= 1:
                        continue  # skip single-char answers

                    length_str = str(len(norm))
                    compiled.setdefault(length_str, {})

                    if norm not in compiled[length_str]:
                        # New word — initialise with dict format (no difficulty/pos yet)
                        compiled[length_str][norm] = {"clues": [clue]}
                        unique_words += 1
                        total_clues  += 1
                    else:
                        # Existing word — append clue if not duplicate
                        if clue not in compiled[length_str][norm]["clues"]:
                            compiled[length_str][norm]["clues"].append(clue)
                            total_clues += 1

        except Exception as e:
            print(f"  ERROR parsing {local_path}: {e}")

    # Sort by length, then alphabetically within each length bucket
    final: dict[str, dict] = {}
    for length in sorted(compiled.keys(), key=int):
        if compiled[length]:
            final[length] = {w: compiled[length][w] for w in sorted(compiled[length])}

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(final, f, ensure_ascii=False)

    print(f"\nRaw dictionary saved → {OUTPUT_PATH}")
    print(f"  Unique words : {unique_words:,}")
    print(f"  Total clues  : {total_clues:,}")
    print()
    print("Next step:")
    print("  Copy utils/dictionary.json to src/assets/dictionary.json, then run:")
    print("  python utils/compile_difficulty.py")

if __name__ == "__main__":
    main()
