#!/usr/bin/env python3
"""
clean_typos.py
==============
Utility script to clean up spelling mistakes (refusi) in dictionary.json.
Supports multiple levels of cleaning (Level 1: Moderato, Level 2: Intermedio).
"""

import os
import json
import shutil
import time

ASSETS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "src", "assets")
DICTIONARY_PATH = os.path.join(ASSETS_DIR, "dictionary.json")
BACKUP_PATH = DICTIONARY_PATH + ".bak"

PROPER_NOUN_KEYWORDS = {
    "città",
    "regista",
    "personaggio",
    "scrittore",
    "calciatore",
    "sigla",
    "abbr",
    "fiume",
    "regione",
    "stato",
    "capitale",
    "re ",
    "imperatore",
    "attore",
    "attrice",
    "pianista",
    "poeta",
    "architetto",
    "scultore",
    "dipinto",
    "opera",
    "mitico",
    "mitologia",
    "divinità",
    "costellazione",
    "stella",
    "monte",
    "lago",
    "provincia",
    "comune",
    "filosofo",
    "generale",
    "papa",
    "santo",
    "nobel",
    "romanzo",
    "tragedia",
    "commedia",
}


def get_edit_distance_1(w1: str, w2: str) -> bool:
    """Return True if Levenshtein distance between w1 and w2 is exactly 1."""
    len1, len2 = len(w1), len(w2)
    if abs(len1 - len2) > 1:
        return False

    if len1 == len2:
        diffs = 0
        idx = []
        for i in range(len1):
            if w1[i] != w2[i]:
                diffs += 1
                idx.append(i)
        if diffs == 1:
            return True
        if diffs == 2 and idx[1] - idx[0] == 1:
            if w1[idx[0]] == w2[idx[1]] and w1[idx[1]] == w2[idx[0]]:
                return True
        return False

    longer, shorter = (w1, w2) if len1 > len2 else (w2, w1)
    i = 0
    while i < len(shorter) and longer[i] == shorter[i]:
        i += 1
    return longer[i + 1 :] == shorter[i:]


def find_typos(dictionary):
    """
    Find suspected typos in the given dictionary.
    Returns (typos_to_remove, kept_proper_nouns)
    - typos_to_remove: dict of word -> (clue, matched_reference_word)
    - kept_proper_nouns: list of (word, clue, matched_reference_word)
    """
    reference_by_len = {}
    word_sets = {}

    for length_str, words in dictionary.items():
        L = int(length_str)
        reference_by_len[L] = []
        for word, val in words.items():
            word_sets[word] = set(word)
            pos = val[2]

            if pos is not None:
                reference_by_len[L].append(word)

    typos_to_remove = {}
    kept_proper_nouns = []

    for length_str, words in dictionary.items():
        L = int(length_str)
        for word, val in words.items():
            clues = val[1]
            pos = val[2]

            # An unmatched word with exactly 1 definition of length >= 4
            if pos is None and len(clues) == 1 and len(word) >= 4:
                w_set = word_sets[word]
                is_close = False
                matched_common = None

                # Only check reference words of lengths L-1, L, L+1
                for l_ref in (L - 1, L, L + 1):
                    if l_ref in reference_by_len:
                        for ref in reference_by_len[l_ref]:
                            # Symmetric difference pre-filter: difference in unique chars must be <= 2
                            if len(w_set ^ word_sets[ref]) <= 2:
                                if get_edit_distance_1(word, ref):
                                    is_close = True
                                    matched_common = ref
                                    break
                    if is_close:
                        break

                if is_close:
                    clue_lower = clues[0].lower()
                    has_proper_keyword = any(
                        kw in clue_lower for kw in PROPER_NOUN_KEYWORDS
                    )

                    if has_proper_keyword:
                        kept_proper_nouns.append((word, clues[0], matched_common))
                    else:
                        typos_to_remove[word] = (clues[0], matched_common)

    return typos_to_remove, kept_proper_nouns


def main():
    if not os.path.exists(DICTIONARY_PATH):
        print(f"Error: {DICTIONARY_PATH} not found.")
        return

    print("=== Step 1: Backing up dictionary.json ===")
    shutil.copy2(DICTIONARY_PATH, BACKUP_PATH)
    print(f"  Backup created at: {BACKUP_PATH}")

    print("\n=== Step 2: Loading dictionary ===")
    with open(DICTIONARY_PATH, "r", encoding="utf-8") as f:
        dictionary = json.load(f)

    start_time = time.time()
    typos_to_remove, kept_proper_nouns = find_typos(dictionary)
    print(f"  Scan completed in {time.time() - start_time:.2f} seconds.")
    print(f"  Typos identified: {len(typos_to_remove)}")
    print(f"  Valid proper nouns kept: {len(kept_proper_nouns)}")

    if not typos_to_remove:
        print("No typos found to remove. Dictionary is clean!")
        return

    # Print a sample of typos to be removed
    print("\nSample of typos being removed:")
    sample = sorted(list(typos_to_remove.keys()))[:30]
    for w in sample:
        clue, ref = typos_to_remove[w]
        print(f"  - {w}: {clue} (matched to: {ref})")

    # Remove typos from dictionary
    print("\n=== Step 4: Deleting typos ===")
    cleaned_dict = {}
    deleted_count = 0

    for length_str, words in dictionary.items():
        cleaned_dict[length_str] = {}
        for word, val in words.items():
            if word in typos_to_remove:
                deleted_count += 1
            else:
                cleaned_dict[length_str][word] = val

    # Save in compact format
    print("\n=== Step 5: Saving cleaned dictionary ===")
    with open(DICTIONARY_PATH, "w", encoding="utf-8") as f:
        json.dump(cleaned_dict, f, ensure_ascii=False, separators=(",", ":"))

    print(f"Done! Cleaned dictionary saved to {DICTIONARY_PATH}")
    print(f"  Total words deleted: {deleted_count:,}")


if __name__ == "__main__":
    main()
