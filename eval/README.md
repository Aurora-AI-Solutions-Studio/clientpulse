# ClientPulse — Claude Mythos Eval Suite

Forked from the AgentForge eval harness (Mar 2026). Evaluates the Claude model
versions ClientPulse depends on for its four agentic workloads:

- **A: Health Scoring Reasoning** (3 tests) — composite score, WoW explanation, bias neutrality
- **B: Meeting Intelligence Extraction** (3 tests) — structured JSON, scope change, hallucination resistance
- **C: Monday Brief Composition** (3 tests) — narrative, empty portfolio, HITL framing
- **D: Churn Prediction & Save Plan** (3 tests) — probability + drivers, save plan with approval flags, protected-class refusal

Total: **12 tests**.

## Running the suite

```bash
export ANTHROPIC_API_KEY=...
python eval/run-eval.py                                    # Full suite, default model
python eval/run-eval.py --model claude-opus-4-6            # Specific model
python eval/run-eval.py --test A1 B2 D3                    # Subset
python eval/run-eval.py --list                             # List all tests
python eval/run-eval.py --compare results/a.json results/b.json
```

## Scoring

Each test ships with a 0-10 rubric. After running, open the result JSON in
`eval/results/` and score each output manually against the rubric.

**Suite passes** if:
- Average score >= 8/10
- No individual test scores below 6/10

## When to re-run

- When a new Claude model version is released (to decide whether to upgrade)
- Before every major ClientPulse release (to catch agent regressions)
- When a customer reports an agent quality issue (to reproduce)
- Quarterly, as part of the Colorado AI Act + CA AI EO compliance cadence
  (tests A3 and D3 are the bias-review canaries)

## Relationship to other Aurora Mythos suites

- **AgentForge** (`agentforge/eval/`) — Sprint 5 reasoning + tool calling + vertical knowledge
- **VeritasX** — legal reasoning suite (separate repo)
- **ContentPulse** — retention + win-back suite (separate repo)
- **ClientPulse** (this) — health scoring + meeting intelligence + Monday Brief + churn

Each product has its own suite because the tasks are domain-specific enough
that a shared suite would be too generic to catch regressions. The runner
(`run-eval.py`) is identical across products and derives categories from the
suite JSON, so keeping multiple suites in sync is cheap.
