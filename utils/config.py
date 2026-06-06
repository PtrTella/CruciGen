import os
import json
import subprocess
import re


def _load_config():
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    js_path = os.path.join(project_root, "src", "js", "config.js")

    # Try using Node.js to evaluate and output the JS configuration object as JSON
    node_code = f"const fs = require('fs'); eval(fs.readFileSync('{js_path}', 'utf8')); console.log(JSON.stringify(CRUCIGEN_CONFIG));"
    try:
        res = subprocess.run(
            ["node", "-e", node_code], capture_output=True, text=True, check=True
        )
        return json.loads(res.stdout)
    except Exception as e:
        print(f"[DEBUG] Node.js parsing failed: {e}. Running fallback...")
        # Fallback dictionary if node execution fails
        config = {
            "difficultyThresholds": {"easy": 0.32, "hard": 0.62},
            "blackSquarePercentByDifficulty": {
                "easy": 0.22,
                "medium": 0.17,
                "hard": 0.13,
            },
            "lengthCenterFractions": {
                "easy": 0.50,
                "medium": 0.62,
                "hard": 0.72
            }
        }
        if os.path.exists(js_path):
            try:
                with open(js_path, "r", encoding="utf-8") as f:
                    content = f.read()
                thresh_block = re.search(
                    r"difficultyThresholds\s*:\s*\{([^}]+)\}", content
                )
                if thresh_block:
                    block_content = thresh_block.group(1)
                    easy_match = re.search(r"easy:\s*(0\.\d+)", block_content)
                    if easy_match:
                        config["difficultyThresholds"]["easy"] = float(
                            easy_match.group(1)
                        )
                    hard_match = re.search(r"hard:\s*(0\.\d+)", block_content)
                    if hard_match:
                        config["difficultyThresholds"]["hard"] = float(
                            hard_match.group(1)
                        )
                # Parse lengthCenterFractions block in fallback
                fraction_block = re.search(
                    r"lengthCenterFractions\s*:\s*\{([^}]+)\}", content
                )
                if fraction_block:
                    block_content = fraction_block.group(1)
                    easy_match = re.search(r"easy:\s*(0\.\d+)", block_content)
                    if easy_match:
                        config["lengthCenterFractions"]["easy"] = float(
                            easy_match.group(1)
                        )
                    medium_match = re.search(r"medium:\s*(0\.\d+)", block_content)
                    if medium_match:
                        config["lengthCenterFractions"]["medium"] = float(
                            medium_match.group(1)
                        )
                    hard_match = re.search(r"hard:\s*(0\.\d+)", block_content)
                    if hard_match:
                        config["lengthCenterFractions"]["hard"] = float(
                            hard_match.group(1)
                        )
            except Exception:
                pass
        return config


CRUCIGEN_CONFIG = _load_config()

if __name__ == "__main__":
    print("\n==========================================================================")
    print("                    CRUCIGEN CONFIGURATION PREVIEW                        ")
    print("==========================================================================")
    print(json.dumps(CRUCIGEN_CONFIG, indent=2))
    print("==========================================================================")
