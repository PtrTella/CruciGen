import json
import os

DICTIONARY_PATH = "/Users/tella/Workspace/CruciGen/src/assets/dictionary.json"

with open(DICTIONARY_PATH, "r", encoding="utf-8") as f:
    dictionary = json.load(f)

difficulties = []
for length_str, words in dictionary.items():
    for word, entry in words.items():
        if isinstance(entry, dict) and "difficulty" in entry:
            difficulties.append(entry["difficulty"])

difficulties.sort()
print(f"Total words with difficulty: {len(difficulties)}")
print(f"Min: {min(difficulties) * 100:.1f}%")
for p in [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95]:
    val = difficulties[int(len(difficulties) * (p / 100))]
    print(f"{p}th percentile: {val * 100:.1f}%")
print(f"Max: {max(difficulties) * 100:.1f}%")
