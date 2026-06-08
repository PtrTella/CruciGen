import os
import json
import subprocess


def _load_config():
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    js_path = os.path.join(project_root, "src", "js", "config.js")

    # Try using Node.js to evaluate and output the JS configuration object as JSON
    node_code = (
        "const fs = require('fs');"
        "eval("
        f"fs.readFileSync('{js_path}', 'utf8') + `;"
        "const computed = { getBacktrackingSteps: {}, getBlackSquarePercent: {} };"
        "const sizes = [9, 11, 13, 15];"
        "const difficulties = ['easy', 'medium', 'hard'];"
        "sizes.forEach(size => {"
        "  computed.getBacktrackingSteps[size] = {};"
        "  computed.getBlackSquarePercent[size] = {};"
        "  difficulties.forEach(diff => {"
        "    try {"
        "      computed.getBacktrackingSteps[size][diff] = CRUCIGEN_CONFIG.getBacktrackingSteps(size, diff);"
        "      computed.getBlackSquarePercent[size][diff] = CRUCIGEN_CONFIG.getBlackSquarePercent(size, diff);"
        "    } catch(e) {"
        "      computed.getBacktrackingSteps[size][diff] = null;"
        "      computed.getBlackSquarePercent[size][diff] = null;"
        "    }"
        "  });"
        "});"
        "console.log(JSON.stringify({ config: CRUCIGEN_CONFIG, computed }));"
        "`"
        ");"
    )
    try:
        res = subprocess.run(
            ["node", "-e", node_code], capture_output=True, text=True, check=True
        )
        data = json.loads(res.stdout)
        return data["config"], data["computed"]
    except Exception as e:
        print(f"[DEBUG] Node.js parsing failed: {e}. Running fallback...")
        # Fallback dictionary if node execution fails
        config = {
            "difficultyThresholds": {"easy": 0.32, "hard": 0.62},
            "lengthCenterFractions": {"easy": 0.50, "medium": 0.62, "hard": 0.72},
        }
        computed = {"getBacktrackingSteps": {}, "getBlackSquarePercent": {}}
        sizes = [9, 11, 13, 15]
        difficulties = ["easy", "medium", "hard"]
        for size in sizes:
            computed["getBacktrackingSteps"][str(size)] = {}
            computed["getBlackSquarePercent"][str(size)] = {}
            for diff in difficulties:
                base_steps = 800
                diff_mult_steps = {"easy": 1, "medium": 1.3, "hard": 1.9}[diff]
                size_mult_steps = 1.12 ** (size - 9)
                computed["getBacktrackingSteps"][str(size)][diff] = int(
                    round(base_steps * size_mult_steps * diff_mult_steps)
                )

                base_pct = 0.14
                diff_mult_pct = {"easy": 1.46, "medium": 1.13, "hard": 1}[diff]
                size_mult_pct = 1.0 + (size - 9) * 0.03
                computed["getBlackSquarePercent"][str(size)][diff] = (
                    base_pct * size_mult_pct * diff_mult_pct
                )
        return config, computed


CRUCIGEN_CONFIG, COMPUTED_VALUES = _load_config()

if __name__ == "__main__":
    print(
        "\n=========================================================================="
    )
    print("                    CRUCIGEN CONFIGURATION PREVIEW                        ")
    print("==========================================================================")
    print(json.dumps(CRUCIGEN_CONFIG, indent=2))
    print("==========================================================================")

    print(
        "\n=========================================================================="
    )
    print("                 CALCULATED BACKTRACKING STEPS MATRIX                     ")
    print("==========================================================================")
    print(f"{'Size':<6} | {'Easy':<10} | {'Medium':<10} | {'Hard':<10}")
    print("-" * 46)
    sizes = [9, 11, 13, 15]
    for size in sizes:
        steps_data = COMPUTED_VALUES["getBacktrackingSteps"].get(str(size), {})
        easy_val = steps_data.get("easy", "N/A")
        med_val = steps_data.get("medium", "N/A")
        hard_val = steps_data.get("hard", "N/A")
        print(f"{size:<2}x{size:<2}  | {easy_val:<10} | {med_val:<10} | {hard_val:<10}")
    print("==========================================================================")

    print(
        "\n=========================================================================="
    )
    print("                 CALCULATED BLACK SQUARE PERCENT MATRIX                   ")
    print("==========================================================================")
    print(f"{'Size':<6} | {'Easy':<14} | {'Medium':<14} | {'Hard':<14}")
    print("-" * 58)
    for size in sizes:
        pct_data = COMPUTED_VALUES["getBlackSquarePercent"].get(str(size), {})
        easy_val = pct_data.get("easy", 0.0)
        med_val = pct_data.get("medium", 0.0)
        hard_val = pct_data.get("hard", 0.0)

        easy_str = f"{easy_val * 100:.2f}% ({easy_val:.3f})" if easy_val else "N/A"
        med_str = f"{med_val * 100:.2f}% ({med_val:.3f})" if med_val else "N/A"
        hard_str = f"{hard_val * 100:.2f}% ({hard_val:.3f})" if hard_val else "N/A"
        print(f"{size:<2}x{size:<2}  | {easy_str:<14} | {med_str:<14} | {hard_str:<14}")
    print("==========================================================================")
