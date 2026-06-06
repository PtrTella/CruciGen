import json
import os

DICTIONARY_PATH = "/Users/tella/Workspace/CruciGen/src/assets/dictionary.json"

with open(DICTIONARY_PATH, "r", encoding="utf-8") as f:
    dictionary = json.load(f)

print("Word count and Easy word distribution:")
print(f"{'Length':<6} | {'Total Words':<12} | {'Easy Words (<=0.35)':<20} | {'Pct Easy':<8}")
print("-" * 60)

for length_str in sorted(dictionary.keys(), key=int):
    words = dictionary[length_str]
    total = len(words)
    easy_count = sum(1 for w, entry in words.items() if isinstance(entry, dict) and entry.get("difficulty", 0.5) <= 0.35)
    pct = (easy_count / total * 100) if total > 0 else 0
    print(f"{length_str:<6} | {total:<12,} | {easy_count:<20,} | {pct:.1f}%")
