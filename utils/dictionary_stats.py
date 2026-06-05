#!/usr/bin/env python3
import json
import os

DICTIONARY_PATH = os.path.join(os.path.dirname(__file__), "dictionary.json")

def main():
    if not os.path.exists(DICTIONARY_PATH):
        print(f"Error: {DICTIONARY_PATH} does not exist.")
        return

    print("Loading dictionary.json...")
    with open(DICTIONARY_PATH, "r", encoding="utf-8") as f:
        dictionary = json.load(f)

    total_words = 0
    total_clues = 0
    length_breakdown = {}

    for length_str, words in dictionary.items():
        count = len(words)
        total_words += count
        
        clues_for_len = sum(len(entry) for entry in words.values())
        total_clues += clues_for_len
        
        length_breakdown[int(length_str)] = {
            "words": count,
            "clues": clues_for_len,
            "samples": list(words.keys())[:3]
        }

    print("\n==========================================")
    print("        CRUCIGEN DICTIONARY STATS         ")
    print("==========================================")
    print(f"Total Unique Words:       {total_words:,}")
    print(f"Total Unique Definitions: {total_clues:,}")
    print(f"Average Clues per Word:   {total_clues / total_words:.2f}")
    print("==========================================")
    print(f"{'Length':<6} | {'Words':<10} | {'Total Clues':<12} | {'Samples'}")
    print("-" * 60)
    for length in sorted(length_breakdown.keys()):
        stats = length_breakdown[length]
        samples_str = ", ".join(stats["samples"])
        print(f"{length:<6} | {stats['words']:<10,} | {stats['clues']:<12,} | {samples_str}")
    print("==========================================")

if __name__ == "__main__":
    main()
