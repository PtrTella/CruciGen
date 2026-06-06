#!/usr/bin/env python3
"""
optimize_dictionary.py
======================
One-off migration: converts dictionary.json from verbose object format to
compact array format.

Old format (per word):
  { "clues": ["def1", ...], "difficulty": 0.71, "pos": "v" }

New compact format (per word):
  [ difficulty, ["def1", ...up to 20], pos_or_null ]
    ^index 0      ^index 1              ^index 2

Benefits:
  - Removes redundant JSON key names ("clues", "difficulty", "pos")
  - Caps clues at 20 (random diverse sample — only 1 is ever shown per game)
  - Maintains pos for UI display (n=noun, v=verb, a=adjective, null=unknown)

Estimated size reduction: ~4 MB on a 26 MB dictionary (~15%).
"""

import json
import os
import random

ASSETS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "src", "assets")
DICTIONARY_PATH = os.path.join(ASSETS_DIR, "dictionary.json")
MAX_CLUES = 20  # max clues stored per word; only 1 shown per puzzle


def main():
    print(f"Loading {DICTIONARY_PATH}...")
    with open(DICTIONARY_PATH, "r", encoding="utf-8") as f:
        old = json.load(f)

    size_before = os.path.getsize(DICTIONARY_PATH)

    new: dict[str, dict] = {}
    total_words = 0
    total_clues_before = 0
    total_clues_after = 0
    already_compact = 0

    for length_str, words in old.items():
        new[length_str] = {}
        for word, val in words.items():
            total_words += 1

            # Handle both old object format and already-compact array format
            if isinstance(val, list):
                # Already compact — validate and keep
                difficulty = val[0] if len(val) > 0 else 0.5
                clues = val[1] if len(val) > 1 else []
                pos = val[2] if len(val) > 2 else None
                already_compact += 1
            elif isinstance(val, dict):
                difficulty = val.get("difficulty", 0.5)
                clues = val.get("clues", [])
                pos = val.get("pos", None)
            else:
                # Bare list of clues (pre-compile_difficulty format)
                difficulty = 0.5
                clues = list(val) if val else []
                pos = None

            total_clues_before += len(clues)

            # Random sample when over limit — avoids always picking the first N
            if len(clues) > MAX_CLUES:
                clues = random.sample(clues, MAX_CLUES)

            total_clues_after += len(clues)

            new[length_str][word] = [difficulty, clues, pos]

    if already_compact == total_words:
        print(
            f"Dictionary is already in compact format ({total_words:,} words). No conversion needed."
        )
        return

    print(f"Converting {total_words - already_compact:,} words to compact format...")
    print(
        f"Clues: {total_clues_before:,} → {total_clues_after:,} (capped at {MAX_CLUES} per word)"
    )

    with open(DICTIONARY_PATH, "w", encoding="utf-8") as f:
        json.dump(
            new, f, ensure_ascii=False, separators=(",", ":")
        )  # compact JSON separators

    size_after = os.path.getsize(DICTIONARY_PATH)
    saved = (size_before - size_after) / 1024 / 1024
    pct = (1 - size_after / size_before) * 100

    print("\nDone!")
    print(f"  Before : {size_before / 1024 / 1024:.2f} MB")
    print(f"  After  : {size_after / 1024 / 1024:.2f} MB")
    print(f"  Saved  : {saved:.2f} MB  ({pct:.1f}% reduction)")


if __name__ == "__main__":
    random.seed(42)  # reproducible sampling
    main()
