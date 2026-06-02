#!/usr/bin/env python3
import urllib.request
import re
import html
import time
import json
import os
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock

DICTIONARY_PATH = os.path.join(os.path.dirname(__file__), "dictionary.json")


def normalize_accents(text):
    mapping = {
        "à": "a",
        "á": "a",
        "â": "a",
        "ä": "a",
        "è": "e",
        "é": "e",
        "ê": "e",
        "ë": "e",
        "ì": "i",
        "í": "i",
        "î": "i",
        "ï": "i",
        "ò": "o",
        "ó": "o",
        "ô": "o",
        "ö": "o",
        "ù": "u",
        "ú": "u",
        "û": "u",
        "ü": "u",
        "ç": "c",
        "ñ": "n",
    }
    return "".join(mapping.get(c, c) for c in text.lower())


def clean_definition(text):
    if not text:
        return ""
    text = re.sub(r"\s+", " ", text).strip()
    text = html.unescape(text)
    text = text.strip("«»\"' ")
    if text:
        text = text[0].upper() + text[1:]
    return text


class DictionaryUpdater:
    def __init__(self):
        self.lock = Lock()
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        self.added_by_length = {str(i): 0 for i in range(2, 16)}
        self.load_dictionary()

    def load_dictionary(self):
        if os.path.exists(DICTIONARY_PATH):
            try:
                with open(DICTIONARY_PATH, "r", encoding="utf-8") as f:
                    self.dictionary = json.load(f)
                print(
                    f"Loaded existing dictionary with {self.get_total_words()} words."
                )
            except Exception as e:
                print(f"Error loading dictionary: {e}. Starting fresh.")
                self.dictionary = {str(i): {} for i in range(2, 16)}
        else:
            self.dictionary = {str(i): {} for i in range(2, 16)}

    def get_total_words(self):
        return sum(
            len(self.dictionary[str(length)])
            for length in range(2, 16)
            if str(length) in self.dictionary
        )

    def save_dictionary(self):
        # Sort words inside each length class
        final_dict = {}
        for length in sorted(self.dictionary.keys(), key=int):
            final_dict[length] = {}
            for w in sorted(self.dictionary[length].keys()):
                final_dict[length][w] = self.dictionary[length][w]

        with open(DICTIONARY_PATH, "w", encoding="utf-8") as f:
            json.dump(final_dict, f, ensure_ascii=False, indent=2)
        
        print("\n=== SUMMARY OF UPDATES ===")
        print(f"{'Length':<8} | {'Added':<8} | {'Total in Dict':<12}")
        print("-" * 35)
        for length in sorted(self.dictionary.keys(), key=int):
            added = self.added_by_length.get(length, 0)
            total = len(self.dictionary[length])
            print(f"{length:<8} | {f'+{added}':<8} | {total:<12}")
        print("-" * 35)
        print(f"Total dictionary words: {self.get_total_words()}\n")

    def add_word(self, word, clue, overwrite=False):
        word_clean = normalize_accents(word).upper()
        if not word_clean.isalpha() or len(word_clean) < 2 or len(word_clean) > 15:
            return False

        # Filter verb conjugations
        word_lower = word.lower()
        if word_lower.endswith(
            (
                "ano",
                "ono",
                "iamo",
                "ate",
                "ete",
                "ite",
                "ava",
                "eva",
                "iva",
                "avo",
                "evo",
                "ivo",
                "eranno",
                "erebbero",
                "erò",
                "erà",
            )
        ):
            return False

        word_len = str(len(word_clean))
        with self.lock:
            if word_len not in self.dictionary:
                self.dictionary[word_len] = {}

            # If word already exists, only update if overwrite is enabled or if new clue is significantly shorter/better
            if word_clean in self.dictionary[word_len]:
                if overwrite:
                    self.dictionary[word_len][word_clean] = [clue, word]
                    self.added_by_length[word_len] += 1
                    return True
                return False  # Skip duplicate
            else:
                self.dictionary[word_len][word_clean] = [clue, word]
                self.added_by_length[word_len] += 1
                return True

    def fetch_url(self, url):
        req = urllib.request.Request(url, headers=self.headers)
        try:
            with urllib.request.urlopen(req, timeout=8) as response:
                return response.read().decode("utf-8", errors="ignore")
        except Exception:
            return None

    def fetch_word_from_dizy(self, word):
        # Normalized word URL on Dizy
        normalized = normalize_accents(word)
        url = f"https://www.dizy.com/it/voce/{normalized}"
        html_content = self.fetch_url(url)
        if not html_content:
            return False

        # Find clue block
        idx = html_content.find("Definizioni da Cruciverba di cui è la soluzione")
        if idx == -1:
            return False

        block = html_content[idx : idx + 1500]
        clues = re.findall(r'href="/it/cruciverba/\d+">([^<]+)</a>', block)
        if not clues:
            return False

        # Take the cleanest/shortest clue
        best_clue = min([clean_definition(c) for c in clues if c], key=len)
        return self.add_word(word, best_clue)

    def process_clue_page(self, url):
        html_content = self.fetch_url(url)
        if not html_content:
            return []

        # Extract clue and solution
        clue_match = re.search(r"<h1>([^<]+)</h1>", html_content)
        clue = clean_definition(clue_match.group(1)) if clue_match else None

        sol_match = re.search(
            r"- \w+ lettere:\s*<b>([^<]+)</b>", html_content, re.IGNORECASE
        )
        if not sol_match:
            sol_match = re.search(
                r"class=sezione border=1.*?- \w+ lettere:\s*<b>([^<]+)</b>",
                html_content,
                re.DOTALL | re.IGNORECASE,
            )

        solution = sol_match.group(1).strip() if sol_match else None
        added = False
        if clue and solution:
            solution = re.sub(r"<[^>]*>", "", solution).strip()
            added = self.add_word(solution, clue)

        # Return links to other clue pages to grow queue
        links = re.findall(r'href="(/it/cruciverba/\d+)"', html_content)
        return [f"https://www.dizy.com{l}" for l in links], added

    def update_by_words(self, words):
        print(f"Updating by looking up {len(words)} custom words on Dizy...")
        added_count = 0
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = {executor.submit(self.fetch_word_from_dizy, w): w for w in words}
            for fut in as_completed(futures):
                w = futures[fut]
                if fut.result():
                    print(f" + Added word: {w.upper()}")
                    added_count += 1
                else:
                    print(f" - Skipped/Not found: {w.upper()}")
        print(f"Batch lookup complete. Added {added_count} new words.")
        self.save_dictionary()

    def update_by_crawling(self, target_pages):
        print(f"Crawling {target_pages} pages on Dizy to find new clues...")
        visited = set()
        queue = set()

        # Seed with some known URLs to start crawl
        seeds = [
            "https://www.dizy.com/it/cruciverba/len/2",
            "https://www.dizy.com/it/cruciverba/len/3",
            "https://www.dizy.com/it/cruciverba/len/4",
            "https://www.dizy.com/it/cruciverba/len/5",
            "https://www.dizy.com/it/cruciverba/len/6",
            "https://www.dizy.com/it/cruciverba/len/7",
            "https://www.dizy.com/it/cruciverba/len/8",
            "https://www.dizy.com/it/cruciverba/len/9",
            "https://www.dizy.com/it/cruciverba/len/10",
            "https://www.dizy.com/it/cruciverba/len/11",
            "https://www.dizy.com/it/cruciverba/len/12",
            "https://www.dizy.com/it/cruciverba/len/13",
            "https://www.dizy.com/it/cruciverba/len/14",
            "https://www.dizy.com/it/cruciverba/len/15",
        ]

        for s in seeds:
            res = self.fetch_url(s)
            if res:
                links = re.findall(r'href="(/it/cruciverba/\d+)"', res)
                for l in links:
                    queue.add(f"https://www.dizy.com{l}")

        print(
            f"Found {len(queue)} initial links. Crawling up to {target_pages} clue pages..."
        )
        pages_crawled = 0
        added_count = 0

        while pages_crawled < target_pages and queue:
            batch = list(queue - visited)[:20]
            if not batch:
                break
            visited.update(batch)
            queue.difference_update(batch)

            with ThreadPoolExecutor(max_workers=10) as executor:
                futures = {
                    executor.submit(self.process_clue_page, url): url for url in batch
                }
                for fut in as_completed(futures):
                    res = fut.result()
                    if res:
                        new_links, added = res
                        if added:
                            added_count += 1
                        queue.update([l for l in new_links if l not in visited])

            pages_crawled += len(batch)
            print(
                f"Crawled {pages_crawled}/{target_pages} pages. Added {added_count} new words."
            )
            time.sleep(0.5)

        self.save_dictionary()


def main():
    parser = argparse.ArgumentParser(
        description="Update dictionary.json with new crossword words from Dizy.com without duplicates."
    )
    parser.add_argument(
        "--words",
        type=str,
        help="Comma-separated list of specific words to look up on Dizy. Example: --words FIAT,BARI,PANDA",
    )
    parser.add_argument(
        "--crawl",
        type=int,
        help="Number of pages to crawl on Dizy.com to discover new clues. Example: --crawl 100",
    )

    args = parser.parse_args()
    updater = DictionaryUpdater()

    if args.words:
        word_list = [w.strip() for w in args.words.split(",") if w.strip()]
        updater.update_by_words(word_list)
    elif args.crawl:
        updater.update_by_crawling(args.crawl)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
