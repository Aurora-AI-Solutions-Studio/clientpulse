#!/usr/bin/env python3
"""
ClientPulse — Claude Mythos Evaluation Suite Runner

Forked from AgentForge eval harness. Categories are derived from the suite
JSON (not hardcoded) so the same runner works for any future product suite.

Usage:
  python eval/run-eval.py                                      # Run all tests vs default model
  python eval/run-eval.py --model claude-sonnet-4-5-20250929   # Specify model
  python eval/run-eval.py --test A1 A3 B2                      # Run specific tests
  python eval/run-eval.py --compare results/baseline.json results/mythos.json
  python eval/run-eval.py --list                               # List all tests

Requires: ANTHROPIC_API_KEY environment variable
"""

import json
import os
import sys
import time
import argparse
from datetime import datetime
from pathlib import Path

try:
    import anthropic
except ImportError:
    print("ERROR: pip install anthropic")
    sys.exit(1)


EVAL_SUITE_PATH = Path(__file__).parent / "clientpulse-mythos-eval-suite.json"
RESULTS_DIR = Path(__file__).parent / "results"


def load_suite() -> dict:
    with open(EVAL_SUITE_PATH) as f:
        return json.load(f)


def run_single_test(client: anthropic.Anthropic, model: str, test: dict) -> dict:
    print(f"  [{test['id']}] {test['name']}...", end=" ", flush=True)
    start = time.time()

    try:
        response = client.messages.create(
            model=model,
            max_tokens=4096,
            temperature=0,
            messages=[{"role": "user", "content": test["prompt"]}],
        )
        elapsed = time.time() - start
        output = response.content[0].text

        result = {
            "test_id": test["id"],
            "test_name": test["name"],
            "category": test["category"],
            "model": model,
            "output": output,
            "input_tokens": response.usage.input_tokens,
            "output_tokens": response.usage.output_tokens,
            "elapsed_seconds": round(elapsed, 2),
            "timestamp": datetime.utcnow().isoformat(),
            "error": None,
        }
        print(f"OK ({elapsed:.1f}s, {response.usage.input_tokens}+{response.usage.output_tokens} tokens)")
        return result

    except Exception as e:
        elapsed = time.time() - start
        print(f"ERROR ({e})")
        return {
            "test_id": test["id"],
            "test_name": test["name"],
            "category": test["category"],
            "model": model,
            "output": None,
            "input_tokens": 0,
            "output_tokens": 0,
            "elapsed_seconds": round(elapsed, 2),
            "timestamp": datetime.utcnow().isoformat(),
            "error": str(e),
        }


def run_eval(model: str, test_ids: list[str] | None = None) -> dict:
    suite = load_suite()
    client = anthropic.Anthropic()

    tests = suite["tests"]
    if test_ids:
        tests = [t for t in tests if t["id"] in test_ids]

    print(f"\n{'='*60}")
    print(f"{suite['meta'].get('product', 'ClientPulse')} Eval Suite v{suite['meta']['version']}")
    print(f"Model: {model}")
    print(f"Tests: {len(tests)}")
    print(f"{'='*60}\n")

    results = []
    total_input = 0
    total_output = 0

    for test in tests:
        result = run_single_test(client, model, test)
        results.append(result)
        total_input += result["input_tokens"]
        total_output += result["output_tokens"]

    successful = [r for r in results if r["error"] is None]
    failed = [r for r in results if r["error"] is not None]

    # Derive categories from the suite instead of hardcoding
    all_categories = sorted({t["category"] for t in suite["tests"]})

    summary = {
        "product": suite["meta"].get("product", "ClientPulse"),
        "model": model,
        "suite_version": suite["meta"]["version"],
        "run_timestamp": datetime.utcnow().isoformat(),
        "tests_total": len(tests),
        "tests_successful": len(successful),
        "tests_failed": len(failed),
        "total_input_tokens": total_input,
        "total_output_tokens": total_output,
        "total_tokens": total_input + total_output,
        "estimated_cost_usd": round((total_input * 3 + total_output * 15) / 1_000_000, 4),
        "category_breakdown": {},
    }

    for cat in all_categories:
        cat_results = [r for r in successful if r["category"] == cat]
        summary["category_breakdown"][cat] = {
            "tests": len(cat_results),
            "avg_elapsed": round(sum(r["elapsed_seconds"] for r in cat_results) / max(len(cat_results), 1), 2),
            "total_tokens": sum(r["input_tokens"] + r["output_tokens"] for r in cat_results),
        }

    output = {
        "summary": summary,
        "results": results,
        "rubrics": {t["id"]: t["scoring_rubric"] for t in suite["tests"] if not test_ids or t["id"] in (test_ids or [])},
    }

    RESULTS_DIR.mkdir(exist_ok=True)
    model_slug = model.replace("/", "_").replace(":", "_")
    filename = f"{model_slug}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
    filepath = RESULTS_DIR / filename
    with open(filepath, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\n{'='*60}")
    print(f"RESULTS SUMMARY")
    print(f"{'='*60}")
    print(f"Model:      {model}")
    print(f"Successful: {len(successful)}/{len(tests)}")
    print(f"Tokens:     {total_input:,} in + {total_output:,} out = {total_input + total_output:,} total")
    print(f"Est. cost:  ${summary['estimated_cost_usd']:.4f}")
    print(f"Saved to:   {filepath}")
    print(f"\nNOTE: Scores must be assigned manually using the rubrics in the results file.")
    print(f"      Compare outputs against rubrics, score each 0-10, then use compare mode.\n")

    return output


def compare_results(file_a: str, file_b: str):
    with open(file_a) as f:
        a = json.load(f)
    with open(file_b) as f:
        b = json.load(f)

    print(f"\n{'='*60}")
    print(f"COMPARISON: {a['summary']['model']} vs {b['summary']['model']}")
    print(f"{'='*60}\n")

    a_by_id = {r["test_id"]: r for r in a["results"]}
    b_by_id = {r["test_id"]: r for r in b["results"]}
    all_ids = sorted(set(list(a_by_id.keys()) + list(b_by_id.keys())))

    print(f"{'Test':<6} {'Name':<35} {'Model A Time':>12} {'Model B Time':>12} {'Diff':>8}")
    print("-" * 80)

    for tid in all_ids:
        ra = a_by_id.get(tid)
        rb = b_by_id.get(tid)
        name = (ra or rb)["test_name"][:34]
        ta = f"{ra['elapsed_seconds']:.1f}s" if ra and not ra["error"] else "ERR"
        tb = f"{rb['elapsed_seconds']:.1f}s" if rb and not rb["error"] else "ERR"
        if ra and rb and not ra["error"] and not rb["error"]:
            diff = rb["elapsed_seconds"] - ra["elapsed_seconds"]
            diff_str = f"{diff:+.1f}s"
        else:
            diff_str = "—"
        print(f"{tid:<6} {name:<35} {ta:>12} {tb:>12} {diff_str:>8}")

    print(f"\n{'Metric':<30} {'Model A':>15} {'Model B':>15}")
    print("-" * 62)
    print(f"{'Total tokens':<30} {a['summary']['total_tokens']:>15,} {b['summary']['total_tokens']:>15,}")
    print(f"{'Est. cost':<30} ${a['summary']['estimated_cost_usd']:>14.4f} ${b['summary']['estimated_cost_usd']:>14.4f}")
    print()


def main():
    parser = argparse.ArgumentParser(description="ClientPulse Claude Mythos Eval Runner")
    parser.add_argument("--model", default="claude-sonnet-4-5-20250929", help="Model to evaluate")
    parser.add_argument("--test", nargs="*", help="Specific test IDs to run (e.g., A1 B2 C1)")
    parser.add_argument("--compare", nargs=2, metavar=("FILE_A", "FILE_B"), help="Compare two result files")
    parser.add_argument("--list", action="store_true", help="List all available tests")
    args = parser.parse_args()

    if args.list:
        suite = load_suite()
        print(f"\n{suite['meta'].get('product', 'ClientPulse')} Eval Suite v{suite['meta']['version']}")
        print(f"{'='*60}")
        for t in suite["tests"]:
            print(f"  {t['id']:<4} [{t['category']}] {t['name']}")
        print()
        return

    if args.compare:
        compare_results(args.compare[0], args.compare[1])
        return

    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("ERROR: Set ANTHROPIC_API_KEY environment variable")
        sys.exit(1)

    run_eval(args.model, args.test)


if __name__ == "__main__":
    main()
