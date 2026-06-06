#!/usr/bin/env python3
import json
import os

# Path to the actual dictionary asset
DICTIONARY_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "src", "assets", "dictionary.json")

def main():
    if not os.path.exists(DICTIONARY_PATH):
        print(f"Error: {DICTIONARY_PATH} does not exist.")
        return

    print("Loading dictionary.json...")
    with open(DICTIONARY_PATH, "r", encoding="utf-8") as f:
        dictionary = json.load(f)

    total_words = 0
    total_clues = 0
    total_matched = 0
    pos_counts = {"n": 0, "v": 0, "a": 0, "unknown": 0}
    length_breakdown = {}

    for length_str, words in dictionary.items():
        length = int(length_str)
        count = len(words)
        total_words += count
        
        clues_for_len = 0
        matched_for_len = 0
        pos_for_len = {"n": 0, "v": 0, "a": 0, "unknown": 0}
        unmatched_samples = []

        for word, val in words.items():
            # Supporta sia il vecchio formato oggetto che il nuovo formato array compatto:
            #   vecchio: {"clues": [...], "difficulty": x, "pos": "n"}
            #   nuovo:   [difficulty, [clues], pos]
            if isinstance(val, list):
                clues_count = len(val[1]) if len(val) > 1 and isinstance(val[1], list) else 0
                pos         = val[2] if len(val) > 2 else None
            elif isinstance(val, dict):
                clues_count = len(val.get("clues", []))
                pos         = val.get("pos")
            else:
                clues_count = 0
                pos         = None
                
            clues_for_len += clues_count
            total_clues += clues_count

            if pos is not None:
                matched_for_len += 1
                total_matched += 1
                pos_for_len[pos] = pos_for_len.get(pos, 0) + 1
                pos_counts[pos] = pos_counts.get(pos, 0) + 1
            else:
                pos_for_len["unknown"] += 1
                pos_counts["unknown"] += 1
                if len(unmatched_samples) < 5:
                    unmatched_samples.append(word)

        length_breakdown[length] = {
            "words": count,
            "clues": clues_for_len,
            "matched": matched_for_len,
            "unmatched_samples": unmatched_samples,
            "pos": pos_for_len
        }

    print("\n==========================================================================")
    print("                    CRUCIGEN DICTIONARY ANALYSIS                        ")
    print("==========================================================================")
    print(f"Total Unique Words:            {total_words:,}")
    print(f"Total Unique Definitions:      {total_clues:,}")
    print(f"Average Clues per Word:        {total_clues / total_words:.2f}")
    print(f"Total itWaC Matched Words:     {total_matched:,} ({total_matched / total_words * 100:.2f}%)")
    print(f"Total Unmatched Words:         {total_words - total_matched:,} ({(total_words - total_matched) / total_words * 100:.2f}%)")
    print("--------------------------------------------------------------------------")
    print("Part Of Speech Breakdown (Matched Words):")
    total_valid_pos = pos_counts["n"] + pos_counts["v"] + pos_counts["a"]
    if total_valid_pos > 0:
        print(f"  - Nouns (sostantivi):       {pos_counts['n']:,} ({pos_counts['n'] / total_matched * 100:.2f}%)")
        print(f"  - Verbs (verbi):            {pos_counts['v']:,} ({pos_counts['v'] / total_matched * 100:.2f}%)")
        print(f"  - Adjectives (aggettivi):   {pos_counts['a']:,} ({pos_counts['a'] / total_matched * 100:.2f}%)")
    print("==========================================================================")
    
    # Table Header
    print(f"{'Len':<4} | {'Total Words':<11} | {'Matched (itWaC)':<16} | {'Unmatched %':<11} | {'Unmatched Samples'}")
    print("-" * 100)
    
    for length in sorted(length_breakdown.keys()):
        stats = length_breakdown[length]
        matched_cnt = stats["matched"]
        total_cnt = stats["words"]
        matched_pct = (matched_cnt / total_cnt * 100) if total_cnt > 0 else 0
        unmatched_pct = 100.0 - matched_pct
        
        samples_str = ", ".join(stats["unmatched_samples"]) if stats["unmatched_samples"] else "-"
        
        print(f"{length:<4} | {total_cnt:<11,} | {matched_cnt:<6,} ({matched_pct:5.1f}%) | {unmatched_pct:9.1f}% | {samples_str}")
        
    print("==========================================================================")

if __name__ == "__main__":
    main()
