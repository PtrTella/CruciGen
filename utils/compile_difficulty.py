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

# Common Italian function words (2+ letters) to help segment multi-word clues
FUNCTION_WORDS = {
    "il": 6.7, "lo": 6.0, "la": 6.5, "i": 6.5, "gli": 6.2, "le": 6.5,
    "un": 6.5, "uno": 6.0, "una": 6.5,
    "di": 6.8, "a": 6.8, "da": 6.5, "in": 6.5, "con": 6.4, "su": 6.0, "per": 6.5, "tra": 5.8, "fra": 5.5,
    "del": 6.4, "dello": 5.8, "della": 6.4, "dei": 6.3, "degli": 6.0, "delle": 6.3,
    "al": 6.3, "allo": 5.6, "alla": 6.3, "ai": 6.1, "agli": 5.8, "alle": 6.1,
    "nel": 6.3, "nello": 5.5, "nella": 6.2, "nei": 6.0, "negli": 5.8, "nelle": 6.0,
    "col": 5.5, "coi": 5.0,
    "sul": 5.8, "sullo": 5.2, "sulla": 5.8, "sui": 5.5, "sugli": 5.1, "sulle": 5.5,
    "dal": 6.0, "dallo": 5.2, "dalla": 6.0, "dai": 5.8, "dagli": 5.3, "dalle": 5.8,
    "ad": 6.5, "ed": 6.3, "od": 5.0,
    "ma": 6.3, "se": 6.4, "che": 6.7, "chi": 6.1, "cui": 5.8,
    "non": 6.6, "piu": 6.3, "gia": 5.8, "poi": 6.0, "mai": 5.8, "sempre": 5.9,
    "come": 6.3, "dove": 6.0, "quando": 6.1, "qual": 5.5, "questo": 6.2, "quello": 6.1,
    "mi": 6.3, "ti": 6.0, "si": 6.6, "ci": 6.2, "vi": 6.0, "ne": 6.2,
    "me": 6.0, "te": 5.8, "lui": 6.0, "lei": 6.0, "noi": 6.0, "voi": 5.8, "loro": 6.1,
    "e": 6.6, "o": 6.2
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
    # Map: canonized_word -> {"original": str, "zipf": float, "pos": str}
    itwac_map = {}
    
    # 1. Load function words
    for word, zipf in FUNCTION_WORDS.items():
        itwac_map[canonize_word(word)] = {
            "original": word,
            "zipf": zipf,
            "pos": None
        }

    # 2. Load itWaC CSVs
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
                    
                    if canon not in itwac_map or zipf > itwac_map[canon]["zipf"]:
                        itwac_map[canon] = {
                            "original": w,
                            "zipf": zipf,
                            "pos": pos_code
                        }
                            
    print(f"itWaC parsing complete. Loaded {len(itwac_map)} unique words/lemmas.")
    return itwac_map

def segment_word(s, itwac_map, memo=None):
    if memo is None:
        memo = {}
    if not s:
        return []
    if s in memo:
        return memo[s]
    
    best_split = None
    best_score = -float('inf')
    
    # Try splitting at all positions
    for i in range(1, len(s) + 1):  # Starting at 1 to allow length-1 words (like "i", "a")
        prefix = s[:i]
        
        is_function_word = prefix.lower() in FUNCTION_WORDS
        is_valid_long_word = len(prefix) >= 4 and prefix in itwac_map # non-function words must be >= 4 letters
        
        if not (is_function_word or is_valid_long_word):
            continue
            
        if prefix in itwac_map:
            prefix_zipf = itwac_map[prefix]["zipf"]
            suffix_split = segment_word(s[i:], itwac_map, memo)
            
            if suffix_split is not None:
                # Score components
                score = prefix_zipf + sum(itwac_map[w]["zipf"] for w in suffix_split)
                score -= len(suffix_split) * 10.0  # Penalty of 10.0 prevents over-segmenting (e.g. PERLE -> PER + LE)
                
                if score > best_score:
                    best_score = score
                    best_split = [prefix] + suffix_split
                    
    memo[s] = best_split
    return best_split

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
    total_segmented = 0
    
    memo = {}
    
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
            elif len(word) >= 11:
                # Try segmenting long compound phrases
                split = segment_word(word, itwac_map, memo)
                if split:
                    orig_parts = []
                    total_zipf = 0
                    for part in split:
                        orig_parts.append(itwac_map[part]["original"])
                        total_zipf += itwac_map[part]["zipf"]
                    
                    original = " ".join(orig_parts)
                    zipf = total_zipf / len(split)
                    pos = "n"  # Compound phrases act as nouns/noun phrases in crosswords
                    total_segmented += 1
                else:
                    original = word.lower() # fallback
                    zipf = 1.5 # fallback Zipf
                    pos = None
            else:
                original = word.lower() # fallback
                zipf = 1.5 # fallback Zipf
                pos = None
                
            # Compute difficulty
            # We map Zipf scores to difficulty using a non-linear mapping where:
            # Zipf >= 5.0 -> 0.0 difficulty
            # Zipf = 1.5 -> 1.0 difficulty
            raw_diff = (5.0 - zipf) / 3.5 if zipf < 5.0 else 0.0
            difficolta_statistica = (raw_diff ** 1.5) if raw_diff > 0 else 0.0
            
            # Hard letters penalty
            lettere_ostiche = set("hqzxywk")
            unique_hard_letters = set(word.lower()) & lettere_ostiche
            bonus_complessita = len(unique_hard_letters) * 0.04
            
            difficulty = round(max(0.0, min(1.0, difficolta_statistica + bonus_complessita)), 3)
            
            new_dictionary[length_str][word] = {
                "clues": clues,
                "difficulty": difficulty,
                "pos": pos
            }
            total_processed += 1

    print(f"Compilation stats:")
    print(f"  - Total processed: {total_processed} words")
    print(f"  - Direct itWaC matches: {total_matched} ({total_matched / total_processed * 100:.2f}%)")
    print(f"  - Segmented compound matches: {total_segmented} ({total_segmented / total_processed * 100:.2f}%)")
    print(f"  - Total matched: {total_matched + total_segmented} ({(total_matched + total_segmented) / total_processed * 100:.2f}%)")

    # 5. Save back to dictionary.json
    print(f"Saving updated dictionary.json to {DICTIONARY_PATH}...")
    with open(DICTIONARY_PATH, "w", encoding="utf-8") as f:
        json.dump(new_dictionary, f, ensure_ascii=False)
        
    print("Compilation completed successfully!")

if __name__ == "__main__":
    main()
