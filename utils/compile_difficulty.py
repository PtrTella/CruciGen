#!/usr/bin/env python3
import os
import csv
import json
import urllib.request
import ssl
import re
import unicodedata

# Paths
ASSETS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "src", "assets")
DICTIONARY_PATH = os.path.join(ASSETS_DIR, "dictionary.json")
DATASET_DIR = os.path.join(os.path.dirname(__file__), "dataset_difficulty")

ITWAC_URLS = {
    "nouns": "https://raw.githubusercontent.com/franfranz/Word_Frequency_Lists_ITA/main/itwac_nouns_lemmas_notail_2_0_0.csv",
    "adj": "https://raw.githubusercontent.com/franfranz/Word_Frequency_Lists_ITA/main/itwac_adj_lemmas_notail_2_1_0.csv",
    "verbs": "https://raw.githubusercontent.com/franfranz/Word_Frequency_Lists_ITA/main/itwac_verbs_lemmas_notail_2_1_0.csv"
}

def download_file(url, local_path):
    if os.path.exists(local_path):
        print(f"File already exists: {local_path}")
        return
    print(f"Downloading {url} -> {local_path}...")
    headers = {"User-Agent": "Mozilla/5.0"}
    req = urllib.request.Request(url, headers=headers)
    context = ssl._create_unverified_context()
    with urllib.request.urlopen(req, context=context) as response:
        content = response.read()
    with open(local_path, "wb") as f:
        f.write(content)

def canonize_word(w):
    nfkd_form = unicodedata.normalize('NFKD', w)
    return "".join(c for c in nfkd_form if not unicodedata.combining(c)).upper()

def parse_itwac(local_paths):
    # Map: canonized_word -> list of dicts: {"original": str, "zipf": float, "pos": str}
    itwac_data = {}
    
    for category, path in local_paths.items():
        print(f"Parsing itWaC {category} CSV...")
        pos_code = "n" if category == "nouns" else ("a" if category == "adj" else "v")
        
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            reader = csv.reader(f)
            try:
                header = next(reader)
            except StopIteration:
                continue
            
            # Find column indices
            form_idx = 0
            lemma_idx = 2
            zipf_idx = len(header) - 1
            for idx, col in enumerate(header):
                if col.lower() == "form":
                    form_idx = idx
                elif col.lower() == "lemma":
                    lemma_idx = idx
                elif col.lower() == "zipf":
                    zipf_idx = idx
            
            for row in reader:
                if len(row) <= max(form_idx, lemma_idx, zipf_idx):
                    continue
                
                form = row[form_idx].strip()
                lemma = row[lemma_idx].strip()
                try:
                    zipf = float(row[zipf_idx])
                except ValueError:
                    continue
                
                # Check both Form and Lemma
                for w in (form, lemma):
                    if not w:
                        continue
                    canon = canonize_word(w)
                    if not canon:
                        continue
                    
                    if canon not in itwac_data:
                        itwac_data[canon] = []
                    
                    itwac_data[canon].append({
                        "original": w,
                        "zipf": zipf,
                        "pos": pos_code
                    })
                            
    # Now, for each canonized word, resolve to the one with the maximum Zipf score
    print("Resolving duplicate matches in itWaC...")
    resolved = {}
    for canon, candidates in itwac_data.items():
        best = max(candidates, key=lambda x: x["zipf"])
        resolved[canon] = best
        
    print(f"itWaC parsing complete. Loaded {len(resolved)} unique words/lemmas.")
    return resolved

def main():
    os.makedirs(DATASET_DIR, exist_ok=True)
    
    # 1. Download itWaC files (will skip if already downloaded)
    itwac_paths = {}
    for name, url in ITWAC_URLS.items():
        local_path = os.path.join(DATASET_DIR, f"itwac-{name}.csv")
        download_file(url, local_path)
        itwac_paths[name] = local_path

    # 2. Parse itWaC
    itwac_map = parse_itwac(itwac_paths)

    # 3. Load crossword dictionary
    if not os.path.exists(DICTIONARY_PATH):
        print(f"Error: dictionary.json not found at {DICTIONARY_PATH}")
        return
        
    print(f"Loading dictionary.json from {DICTIONARY_PATH}...")
    with open(DICTIONARY_PATH, "r", encoding="utf-8") as f:
        dictionary = json.load(f)

    # 4. Process words
    print("Processing words and computing difficulty, POS and original spelling...")
    new_dictionary = {}
    total_processed = 0
    total_matched = 0
    
    for length_str, words in dictionary.items():
        new_dictionary[length_str] = {}
        for word, value in words.items():
            # word is already canonized (uppercase A-Z)
            clues = value["clues"] if isinstance(value, dict) and "clues" in value else value
            
            # Lookup in itWaC
            match = itwac_map.get(word)
            
            if match:
                original = match["original"]
                zipf = match["zipf"]
                pos = match["pos"]
                total_matched += 1
            else:
                original = word.lower() # fallback
                zipf = 1.5 # fallback Zipf
                pos = None
                
            # Compute difficulty
            difficolta_statistica = 1.0 - (zipf / 7.0)
            
            # Hard letters penalty
            lettere_ostiche = set("hqzxywk")
            unique_hard_letters = set(word.lower()) & lettere_ostiche
            bonus_complessita = len(unique_hard_letters) * 0.04
            
            difficulty = round(max(0.0, min(1.0, difficolta_statistica + bonus_complessita)), 3)
            
            new_dictionary[length_str][word] = {
                "clues": clues,
                "difficulty": difficulty,
                "original": original,
                "pos": pos
            }
            total_processed += 1

    print(f"Matching stats: {total_matched} / {total_processed} words successfully mapped to original spellings & POS ({total_matched / total_processed * 100:.2f}%)")

    # 5. Save back to dictionary.json
    print(f"Saving updated dictionary.json to {DICTIONARY_PATH}...")
    with open(DICTIONARY_PATH, "w", encoding="utf-8") as f:
        json.dump(new_dictionary, f, ensure_ascii=False)
        
    print("Compilation completed successfully!")

if __name__ == "__main__":
    main()
