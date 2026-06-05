#!/usr/bin/env python3
import os
import csv
import json
import urllib.request
import unicodedata

DATASET_DIR = os.path.join(os.path.dirname(__file__), "dataset")
DICTIONARY_PATH = os.path.join(os.path.dirname(__file__), "dictionary.json")

SPLITS = {
    "train.csv": "https://huggingface.co/datasets/cruciverb-it/evalita2026/resolve/main/task_1/datasets/train.csv",
    "val.csv": "https://huggingface.co/datasets/cruciverb-it/evalita2026/resolve/main/task_1/datasets/val.csv",
    "test_gold.csv": "https://huggingface.co/datasets/cruciverb-it/evalita2026/resolve/main/task_1/datasets/test_gold.csv"
}

def canonize_word(w):
    # Standard unicode normalization to strip accents and convert to uppercase ASCII A-Z
    nfkd_form = unicodedata.normalize('NFKD', w)
    return "".join(c for c in nfkd_form if not unicodedata.combining(c)).upper()

def main():
    os.makedirs(DATASET_DIR, exist_ok=True)
    compiled_dict = {}
    
    unique_words_count = 0
    total_clues_added = 0

    headers = {"User-Agent": "Mozilla/5.0"}

    for name, url in SPLITS.items():
        local_path = os.path.join(DATASET_DIR, name)
        
        # Download if local file is missing
        if not os.path.exists(local_path):
            print(f"Downloading {name} from HF...")
            try:
                req = urllib.request.Request(url, headers=headers)
                with urllib.request.urlopen(req) as response:
                    content = response.read()
                with open(local_path, "wb") as f:
                    f.write(content)
                print(f"Downloaded and saved {name}.")
            except Exception as e:
                print(f"Error downloading {name}: {e}")
                continue

        # Load local CSV split
        print(f"Processing local {name}...")
        try:
            with open(local_path, "r", encoding="utf-8", errors="ignore") as f:
                reader = csv.reader(f)
                try:
                    header = next(reader)
                except StopIteration:
                    continue
                
                for row in reader:
                    if len(row) < 2:
                        continue
                    clue, answer = row[0].strip(), row[1].strip()
                    if not clue or not answer:
                        continue
                    
                    # Canonize answer (uppercase ASCII) for grid layout matching
                    norm = canonize_word(answer)
                    length_str = str(len(norm))
                    
                    # Skip words of length 1 or less
                    if len(norm) <= 1:
                        continue
                        
                    if length_str not in compiled_dict:
                        compiled_dict[length_str] = {}
                        
                    if norm not in compiled_dict[length_str]:
                        # Store ONLY the list of clues (removing the redundant original word)
                        compiled_dict[length_str][norm] = [clue]
                        unique_words_count += 1
                        total_clues_added += 1
                    else:
                        # Append the clue if it's not already listed for this word
                        if clue not in compiled_dict[length_str][norm]:
                            compiled_dict[length_str][norm].append(clue)
                            total_clues_added += 1
        except Exception as e:
            print(f"Error parsing local file {local_path}: {e}")

    # Build sorted dictionary and save
    final_dict = {}
    for length in sorted(compiled_dict.keys(), key=int):
        if compiled_dict[length]:
            final_dict[length] = {}
            for w in sorted(compiled_dict[length].keys()):
                final_dict[length][w] = compiled_dict[length][w]
                
    with open(DICTIONARY_PATH, "w", encoding="utf-8") as f:
        json.dump(final_dict, f, ensure_ascii=False)
        
    print(f"\nSuccessfully compiled dictionary.json!")
    print(f"Total unique words compiled: {unique_words_count}")
    print(f"Total unique clues compiled: {total_clues_added}")

if __name__ == "__main__":
    main()
