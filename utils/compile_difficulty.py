#!/usr/bin/env python3
"""
compile_difficulty.py
=====================
STEP 2 of 2 — Difficulty scorer and POS tagger.

Reads src/assets/dictionary.json (the production dictionary), enriches every word
with a `difficulty` score (0.0 = very common, 1.0 = very rare) and a `pos` tag
using itWaC Italian corpus frequency data.

Difficulty formula:
  - Zipf >= 5.0   → difficulty = 0.0  (most common words)
  - Zipf = 1.5    → difficulty = 1.0  (fallback for unknown words)
  - raw_diff = (5.0 - zipf) / 3.5   (linear normalisation)
  - difficulty    = raw_diff ** 1.5   (power curve → spreads common words apart)
  - bonus += 0.04 per unique hard letter in {h,q,z,x,y,w,k}
  - result clamped to [0.0, 1.0], rounded to 3 decimal places

Input format expected (src/assets/dictionary.json):
  { "<length>": { "<WORD>": { "clues": [...], "difficulty": ..., "pos": ... } } }

Output format (same file, updated in-place):
  { "<length>": { "<WORD>": { "clues": [...], "difficulty": <float>, "pos": <str|null> } } }

IMPORTANT: This script only updates difficulty/pos on EXISTING words.
           It does NOT add new words to the dictionary.

Workflow:
  1. python utils/download_and_compile.py   → utils/dictionary.json  (raw, no scores)
  2. [optional] copy/merge utils/dictionary.json into src/assets/dictionary.json
  3. python utils/compile_difficulty.py     → src/assets/dictionary.json  (with scores)
"""

import os
import csv
import json
import random
import urllib.request
import ssl
import unicodedata
from typing import Optional

MAX_CLUES = 20  # max clues stored per word; only 1 shown per puzzle

# ─── Paths ────────────────────────────────────────────────────────────────────
ASSETS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "src", "assets")
DICTIONARY_PATH = os.path.join(ASSETS_DIR, "dictionary.json")
DATASET_DIR = os.path.join(os.path.dirname(__file__), "dataset_difficulty")

# ─── itWaC corpus URLs ────────────────────────────────────────────────────────
ITWAC_URLS = {
    "nouns": "https://raw.githubusercontent.com/franfranz/Word_Frequency_Lists_ITA/main/itwac_nouns_lemmas_notail_2_0_0.csv",
    "adj": "https://raw.githubusercontent.com/franfranz/Word_Frequency_Lists_ITA/main/itwac_adj_lemmas_notail_2_1_0.csv",
    "verbs": "https://raw.githubusercontent.com/franfranz/Word_Frequency_Lists_ITA/main/itwac_verbs_lemmas_notail_2_1_0.csv",
}

# ─── High-frequency Italian function words (manually assigned Zipf values) ───
FUNCTION_WORDS = {
    "il": 6.7,
    "lo": 6.0,
    "la": 6.5,
    "i": 6.5,
    "gli": 6.2,
    "le": 6.5,
    "un": 6.5,
    "uno": 6.0,
    "una": 6.5,
    "di": 6.8,
    "a": 6.8,
    "da": 6.5,
    "in": 6.5,
    "con": 6.4,
    "su": 6.0,
    "per": 6.5,
    "tra": 5.8,
    "fra": 5.5,
    "del": 6.4,
    "dello": 5.8,
    "della": 6.4,
    "dei": 6.3,
    "degli": 6.0,
    "delle": 6.3,
    "al": 6.3,
    "allo": 5.6,
    "alla": 6.3,
    "ai": 6.1,
    "agli": 5.8,
    "alle": 6.1,
    "nel": 6.3,
    "nello": 5.5,
    "nella": 6.2,
    "nei": 6.0,
    "negli": 5.8,
    "nelle": 6.0,
    "col": 5.5,
    "coi": 5.0,
    "sul": 5.8,
    "sullo": 5.2,
    "sulla": 5.8,
    "sui": 5.5,
    "sugli": 5.1,
    "sulle": 5.5,
    "dal": 6.0,
    "dallo": 5.2,
    "dalla": 6.0,
    "dai": 5.8,
    "dagli": 5.3,
    "dalle": 5.8,
    "ad": 6.5,
    "ed": 6.3,
    "od": 5.0,
    "ma": 6.3,
    "se": 6.4,
    "che": 6.7,
    "chi": 6.1,
    "cui": 5.8,
    "non": 6.6,
    "piu": 6.3,
    "gia": 5.8,
    "poi": 6.0,
    "mai": 5.8,
    "sempre": 5.9,
    "come": 6.3,
    "dove": 6.0,
    "quando": 6.1,
    "qual": 5.5,
    "questo": 6.2,
    "quello": 6.1,
    "mi": 6.3,
    "ti": 6.0,
    "si": 6.6,
    "ci": 6.2,
    "vi": 6.0,
    "ne": 6.2,
    "me": 6.0,
    "te": 5.8,
    "lui": 6.0,
    "lei": 6.0,
    "noi": 6.0,
    "voi": 5.8,
    "loro": 6.1,
    "e": 6.6,
    "o": 6.2,
}

# ─── Hard letters that increase perceived difficulty ─────────────────────────
HARD_LETTERS = set("hqzxywk")

# ─── Zipf range for difficulty mapping ───────────────────────────────────────
ZIPF_EASY = 5.0  # Zipf >= ZIPF_EASY → difficulty 0.0
ZIPF_FALLBACK = 1.5  # Zipf assigned to unknown words → difficulty ~1.0
ZIPF_RANGE = ZIPF_EASY - ZIPF_FALLBACK  # = 3.5


def canonize_word(w: str) -> str:
    """Strip accents, uppercase, keep only A-Z."""
    nfkd = unicodedata.normalize("NFKD", w)
    return "".join(c for c in nfkd if not unicodedata.combining(c)).upper()


def download_file(url: str, local_path: str) -> None:
    if os.path.exists(local_path):
        print(f"  Cached: {os.path.basename(local_path)}")
        return
    print(f"  Downloading {os.path.basename(local_path)}...")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    ctx = ssl._create_unverified_context()
    with urllib.request.urlopen(req, context=ctx) as resp:
        data = resp.read()
    with open(local_path, "wb") as f:
        f.write(data)


def parse_itwac(local_paths: dict) -> dict:
    """
    Build a map: canonized_word → {"zipf": float, "pos": str|None}
    using itWaC corpus CSVs + function words.

    For words appearing in multiple CSVs, keeps the entry with the HIGHEST Zipf
    (most frequent form wins, and its category determines the pos tag).
    """
    itwac_map: dict[str, dict] = {}

    # 1. Seed with function words
    for word, zipf in FUNCTION_WORDS.items():
        itwac_map[canonize_word(word)] = {"zipf": zipf, "pos": None}

    # 2. Load each itWaC CSV
    for category, path in local_paths.items():
        default_pos = (
            "n" if category == "nouns" else ("a" if category == "adj" else "v")
        )
        print(f"  Parsing itWaC {category}...")

        with open(path, "r", encoding="iso-8859-1", errors="ignore") as f:
            reader = csv.reader(f)
            try:
                header = next(reader)
            except StopIteration:
                continue

            # Detect column indices from header
            form_idx = next((i for i, c in enumerate(header) if c.lower() == "form"), 0)
            lemma_idx = next(
                (i for i, c in enumerate(header) if c.lower() == "lemma"), 2
            )
            pos_idx = next(
                (i for i, c in enumerate(header) if c.lower() == "pos"), None
            )
            zipf_idx = next(
                (i for i, c in enumerate(header) if c.lower() == "zipf"),
                len(header) - 1,
            )

            for row in reader:
                if len(row) <= max(form_idx, lemma_idx, zipf_idx):
                    continue
                try:
                    zipf = float(row[zipf_idx])
                except ValueError:
                    continue

                # Read POS from the POS column if available
                pos_code = None
                if pos_idx is not None and pos_idx < len(row):
                    pos_val = row[pos_idx].strip().upper()
                    if "NOUN" in pos_val:
                        pos_code = "n"
                    elif "ADJ" in pos_val:
                        pos_code = "a"
                    elif "VER" in pos_val:
                        pos_code = "v"

                # Fallback to category default
                if not pos_code:
                    pos_code = default_pos

                # Index both the inflected form AND the lemma
                for raw_word in (row[form_idx].strip(), row[lemma_idx].strip()):
                    if not raw_word:
                        continue
                    canon = canonize_word(raw_word)
                    if not canon:
                        continue
                    # Keep the highest-frequency entry; pos follows from its category
                    if canon not in itwac_map or zipf > itwac_map[canon]["zipf"]:
                        itwac_map[canon] = {"zipf": zipf, "pos": pos_code}

    print(f"  itWaC loaded: {len(itwac_map):,} unique entries")
    return itwac_map


def segment_word(
    s: str, itwac_map: dict, memo: Optional[dict] = None
) -> Optional[list]:
    """
    Recursive best-path segmentation of a compound word into known sub-words.
    Used only for words of length >= 11 that are absent from itWaC.
    Penalty of 10.0 per split discourages over-segmentation (e.g. PERLE → PER+LE).
    """
    if memo is None:
        memo = {}
    if not s:
        return []
    if s in memo:
        return memo[s]

    best_split: list | None = None
    best_score = -float("inf")

    for i in range(1, len(s) + 1):
        prefix = s[:i]
        is_fn = prefix.lower() in FUNCTION_WORDS
        is_long = len(prefix) >= 4 and prefix in itwac_map

        if not (is_fn or is_long):
            continue
        if prefix not in itwac_map:
            continue

        suffix_split = segment_word(s[i:], itwac_map, memo)
        if suffix_split is None:
            continue

        score = itwac_map[prefix]["zipf"] + sum(
            itwac_map[w]["zipf"] for w in suffix_split
        )
        score -= len(suffix_split) * 10.0  # anti-over-segmentation penalty

        if score > best_score:
            best_score = score
            best_split = [prefix] + suffix_split

    memo[s] = best_split
    return best_split


def compute_difficulty(zipf: float, word: str) -> float:
    """
    Map a Zipf frequency score to a difficulty value in [0.0, 1.0].

    Mapping:
      Zipf >= 5.0  → 0.0 (common everyday word)
      Zipf = 1.5   → ~1.0 (very rare / unknown)

    A power curve (exponent 1.5) spreads apart the many words with middling Zipf,
    giving more resolution to the common-word range.

    Hard letters {h,q,z,x,y,w,k} add +0.04 per unique occurrence.
    """
    raw = max(0.0, (ZIPF_EASY - zipf) / ZIPF_RANGE)
    base = raw**1.5

    hard_bonus = len(set(word.lower()) & HARD_LETTERS) * 0.04

    return round(min(1.0, max(0.0, base + hard_bonus)), 3)


def main():
    os.makedirs(DATASET_DIR, exist_ok=True)

    # 1. Download itWaC files (cached if already present)
    print("=== Step 1: Downloading itWaC frequency files ===")
    itwac_paths = {}
    for name, url in ITWAC_URLS.items():
        local = os.path.join(DATASET_DIR, f"itwac-{name}.csv")
        download_file(url, local)
        itwac_paths[name] = local

    # 2. Parse itWaC into frequency map
    print("\n=== Step 2: Parsing itWaC data ===")
    itwac_map = parse_itwac(itwac_paths)

    # 3. Load production dictionary
    print(f"\n=== Step 3: Loading dictionary from {DICTIONARY_PATH} ===")
    if not os.path.exists(DICTIONARY_PATH):
        print(f"ERROR: {DICTIONARY_PATH} not found. Run download_and_compile.py first.")
        return
    with open(DICTIONARY_PATH, "r", encoding="utf-8") as f:
        dictionary = json.load(f)

    # 4. Enrich each word with difficulty + pos — NO new words are added
    print("\n=== Step 4: Computing difficulty scores ===")
    new_dictionary: dict[str, dict] = {}
    total = 0
    matched = 0
    segmented = 0
    memo: dict = {}

    for length_str, words in dictionary.items():
        new_dictionary[length_str] = {}

        for word, value in words.items():
            # Extract clues, handling compact format, old list format, and dict format
            if isinstance(value, dict) and "clues" in value:
                clues = value["clues"]
            elif isinstance(value, list):
                # If it's already in the compact format [difficulty, clues_list, pos]
                if (
                    len(value) == 3
                    and isinstance(value[1], list)
                    and isinstance(value[0], (int, float))
                ):
                    clues = value[1]
                else:
                    clues = value
            else:
                clues = []

            total += 1

            # Look up Zipf frequency in itWaC
            entry = itwac_map.get(word)

            if entry:
                zipf = entry["zipf"]
                pos = entry["pos"] if len(word) >= 4 else None
                matched += 1

            elif len(word) >= 11:
                # Try compound segmentation for long unknown words
                split = segment_word(word, itwac_map, memo)
                if split:
                    zipf = sum(itwac_map[p]["zipf"] for p in split) / len(split)
                    pos = "n"  # compounds treated as noun phrases in crosswords
                    segmented += 1
                else:
                    zipf = ZIPF_FALLBACK
                    pos = None
            else:
                zipf = ZIPF_FALLBACK
                pos = None

            # Formato compatto: [difficulty, [clues (max MAX_CLUES)], pos]
            # Campione casuale se ci sono troppe clues
            sampled_clues = (
                clues if len(clues) <= MAX_CLUES else random.sample(clues, MAX_CLUES)
            )

            new_dictionary[length_str][word] = [
                compute_difficulty(zipf, word),  # index 0: difficulty
                sampled_clues,  # index 1: clues
                pos,  # index 2: pos (n/v/a/null)
            ]

    # 5. Save back in-place
    print("\n=== Step 5: Saving updated dictionary ===")
    with open(DICTIONARY_PATH, "w", encoding="utf-8") as f:
        json.dump(new_dictionary, f, ensure_ascii=False)

    # 6. Report
    fallback = total - matched - segmented
    print("\nDone! Stats:")
    print(f"  Total words processed : {total:,}")
    print(f"  Direct itWaC matches  : {matched:,}  ({matched / total * 100:.1f}%)")
    print(f"  Compound segmented    : {segmented:,}  ({segmented / total * 100:.1f}%)")
    print(
        f"  Fallback (Zipf={ZIPF_FALLBACK}): {fallback:,}  ({fallback / total * 100:.1f}%)"
    )
    print(f"\nSaved → {DICTIONARY_PATH}")


if __name__ == "__main__":
    main()
