## Summary

<!-- 1-3 sentences: what changed, why now. Skip for trivial PRs. -->

## Recording script (user-facing changes only)

<!--
For PRs that change a user-visible workflow, add a paragraph-scale
script the launch-day Loom recording session can use. Skip for
backend/infra/tests.

Anchor: aurora-ops/products/clientpulse/workflow-inventory.md.

Format:
- Tier: <Free|Solo|Pro|Agency|Suite>
- Preconditions: <auth state, seed data, env>
- Click path: <step → step → step>
- Success state: <what the viewer sees>

If the workflow is already in the inventory, just say "updates P0.<N>"
and describe the diff. If it's a new workflow, add a P0/P1/P2 entry
in the same PR.
-->

## Test plan

- [ ] `npx tsc --noEmit` clean
- [ ] `npx vitest run` green
- [ ] Migration applied to `clientpulse-eu` via Supabase MCP pre-merge (only if touching `supabase/migrations/`)
