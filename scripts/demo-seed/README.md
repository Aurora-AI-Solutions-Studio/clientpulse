# Demo seed (ClientPulse)

One-command repopulation of a dedicated **Aurora Demo Agency** so the
landing-page "See demo" CTA, screenshots, and slice-2 signal-pipeline
work demo against realistic data instead of empty-state dashboards.

## Run

From the `clientpulse/` repo root:

```bash
# One-time setup — pull env vars from Vercel
vercel env pull --environment=production .env.local

# Vercel marks SUPABASE_SERVICE_ROLE_KEY as Sensitive, so the pull
# writes it as empty. Copy the real value from:
#   Supabase dashboard → Settings → API → service_role
# into .env.local manually.

npm run seed:demo
```

Required env vars:

- `NEXT_PUBLIC_SUPABASE_URL` (auto-pulled)
- `SUPABASE_SERVICE_ROLE_KEY` (manual paste — see above)

The script is **idempotent** — re-runs delete prior demo rows scoped
to the demo agency / demo user, then re-insert. Real customer rows
are never touched.

## What it touches

- `auth.users` — creates / refreshes `demo@helloaurora.ai` (password documented in `identities.ts`)
- `public.profiles` — sets the demo user to agency tier + `has_suite_access = true` + onboarding complete
- `public.agencies` — creates / refreshes "Aurora Demo Agency"
- `public.clients` — 6 deterministic clients (3 healthy / 2 at-risk / 1 churning)
- `public.client_health_scores` — pre-computed scores per status bucket
- `public.action_items` — per-client action plus an upsell proposal
- `public.cp_rf_client_map` — pre-populated identity map (RF and CP share the same client UUIDs by construction)

## Pair with the RF seed

Run `npm run seed:demo` in the `reforge/` repo with the same
`identities.ts` to populate the matching RF client workspaces +
4-week content velocity that the signal pipeline picks up.

## Verify

Sign in to `https://clientpulse.helloaurora.ai/auth/login` as
`demo@helloaurora.ai` (password in `identities.ts`). Dashboard should
show 6 clients with mixed health, action items in the queue, and the
Suite badge in the sidebar.
