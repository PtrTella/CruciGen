#!/usr/bin/env python3
import json
import os
from config import CRUCIGEN_CONFIG

# Path to files
DICTIONARY_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)), "src", "assets", "dictionary.json"
)


def main():
    if not os.path.exists(DICTIONARY_PATH):
        print(f"Error: {DICTIONARY_PATH} does not exist.")
        return

    easy_thresh = CRUCIGEN_CONFIG["difficultyThresholds"]["easy"]
    hard_thresh = CRUCIGEN_CONFIG["difficultyThresholds"]["hard"]

    print(
        f"Loading dictionary.json (thresholds: easy <= {easy_thresh}, hard >= {hard_thresh})..."
    )
    with open(DICTIONARY_PATH, "r", encoding="utf-8") as f:
        dictionary = json.load(f)

    total_words = 0
    total_clues = 0
    total_matched = 0
    pos_counts = {"n": 0, "v": 0, "a": 0, "unknown": 0}

    global_difficulty_counts = {"easy": 0, "medium": 0, "hard": 0}
    length_breakdown = {}

    for length_str, words in dictionary.items():
        length = int(length_str)
        count = len(words)
        total_words += count

        clues_for_len = 0
        matched_for_len = 0
        pos_for_len = {"n": 0, "v": 0, "a": 0, "unknown": 0}
        difficulty_for_len = {"easy": 0, "medium": 0, "hard": 0}
        unmatched_samples = []

        for word, val in words.items():
            if isinstance(val, list):
                clues_count = (
                    len(val[1]) if len(val) > 1 and isinstance(val[1], list) else 0
                )
                pos = val[2] if len(val) > 2 else None
                difficulty = val[0] if len(val) > 0 else 0.5
            elif isinstance(val, dict):
                clues_count = len(val.get("clues", []))
                pos = val.get("pos")
                difficulty = val.get("difficulty", 0.5)
            else:
                clues_count = 0
                pos = None
                difficulty = 0.5

            clues_for_len += clues_count
            total_clues += clues_count

            # Difficulty classification
            if difficulty <= easy_thresh:
                diff_class = "easy"
            elif difficulty >= hard_thresh:
                diff_class = "hard"
            else:
                diff_class = "medium"

            difficulty_for_len[diff_class] += 1
            global_difficulty_counts[diff_class] += 1

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
            "pos": pos_for_len,
            "difficulty": difficulty_for_len,
        }

    print(
        "\n=========================================================================="
    )
    print("                    CRUCIGEN DICTIONARY ANALYSIS                        ")
    print("==========================================================================")
    print(f"Total Unique Words:            {total_words:,}")
    print(f"Total Unique Definitions:      {total_clues:,}")
    print(f"Average Clues per Word:        {total_clues / total_words:.2f}")
    print(
        f"Total itWaC Matched Words:     {total_matched:,} ({total_matched / total_words * 100:.2f}%)"
    )
    print(
        f"Total Unmatched Words:         {total_words - total_matched:,} ({(total_words - total_matched) / total_words * 100:.2f}%)"
    )
    print("--------------------------------------------------------------------------")
    print("Difficulty Pools Breakdown:")
    easy_cnt = global_difficulty_counts["easy"]
    med_cnt = global_difficulty_counts["medium"]
    hard_cnt = global_difficulty_counts["hard"]
    print(
        f"  - Easy (facili, <= {easy_thresh}):     {easy_cnt:,} ({easy_cnt / total_words * 100:.2f}%)"
    )
    print(
        f"  - Medium (medie):               {med_cnt:,} ({med_cnt / total_words * 100:.2f}%)"
    )
    print(
        f"  - Hard (difficili, >= {hard_thresh}): {hard_cnt:,} ({hard_cnt / total_words * 100:.2f}%)"
    )
    print("--------------------------------------------------------------------------")
    print("Part Of Speech Breakdown (Matched Words):")
    total_valid_pos = pos_counts["n"] + pos_counts["v"] + pos_counts["a"]
    if total_valid_pos > 0:
        print(
            f"  - Nouns (sostantivi):       {pos_counts['n']:,} ({pos_counts['n'] / total_matched * 100:.2f}%)"
        )
        print(
            f"  - Verbs (verbi):            {pos_counts['v']:,} ({pos_counts['v'] / total_matched * 100:.2f}%)"
        )
        print(
            f"  - Adjectives (aggettivi):   {pos_counts['a']:,} ({pos_counts['a'] / total_matched * 100:.2f}%)"
        )
    print("==========================================================================")

    # Table Header
    print(
        f"{'Len':<4} | {'Total Words':<11} | {'Easy':<13} | {'Medium':<13} | {'Hard':<13} | {'Unmatched %':<11}"
    )
    print("-" * 90)

    for length in sorted(length_breakdown.keys()):
        stats = length_breakdown[length]
        total_cnt = stats["words"]

        easy_w = stats["difficulty"]["easy"]
        med_w = stats["difficulty"]["medium"]
        hard_w = stats["difficulty"]["hard"]

        easy_pct = (easy_w / total_cnt * 100) if total_cnt > 0 else 0
        med_pct = (med_w / total_cnt * 100) if total_cnt > 0 else 0
        hard_pct = (hard_w / total_cnt * 100) if total_cnt > 0 else 0

        matched_cnt = stats["matched"]
        matched_pct = (matched_cnt / total_cnt * 100) if total_cnt > 0 else 0
        unmatched_pct = 100.0 - matched_pct

        print(
            f"{length:<4} | {total_cnt:<11,} | {easy_w:<5,} ({easy_pct:4.1f}%) | {med_w:<5,} ({med_pct:4.1f}%) | {hard_w:<5,} ({hard_pct:4.1f}%) | {unmatched_pct:9.1f}%"
        )

    print("==========================================================================")

    print("\n==========================================================================")
    print("                RESOLVABILITY ANALYSIS (TARGET LENGTHS)                  ")
    print("==========================================================================")
    print(f"{'Grid':<5} | {'Diff':<8} | {'Target Len':<10} | {'Words Available':<15} | {'Status'}")
    print("-" * 65)

    sizes = [9, 11, 13, 15]
    difficulties = ["easy", "medium", "hard"]
    fractions = CRUCIGEN_CONFIG.get("lengthCenterFractions", {"easy": 0.50, "medium": 0.62, "hard": 0.72})

    for size in sizes:
        for diff in difficulties:
            frac = fractions.get(diff, 0.5)
            target_len = round(size * frac)
            
            # Count words of target_len in the specified difficulty pool
            words_in_len = dictionary.get(str(target_len), {})
            available_cnt = 0
            for word, val in words_in_len.items():
                if isinstance(val, list):
                    difficulty = val[0] if len(val) > 0 else 0.5
                elif isinstance(val, dict):
                    difficulty = val.get("difficulty", 0.5)
                else:
                    difficulty = 0.5
                    
                if diff == "easy" and difficulty <= easy_thresh:
                    available_cnt += 1
                elif diff == "hard" and difficulty >= hard_thresh:
                    available_cnt += 1
                elif diff == "medium" and easy_thresh < difficulty < hard_thresh:
                    available_cnt += 1
            
            # Status determination
            if available_cnt == 0:
                status = "CRITICAL (0 words)"
            elif available_cnt < 150:
                status = f"WARNING (Low: {available_cnt})"
            else:
                status = "OK"
                
            print(f"{size:<2}x{size:<2} | {diff:<8} | {target_len:<10} | {available_cnt:<15,} | {status}")
            
    print("==========================================================================")


if __name__ == "__main__":
    main()
