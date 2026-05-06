# A4 Rename Report — clientpulse cross-references

## Summary
- Files modified: 47
- Cross-product UI strings updated: ~35 (landing page, FAQ, settings, settings/suite-mapping, upgrade, onboarding, client detail, header tooltip, brand mark wordmark)
- Deep-link references updated: 4 (`reforge.helloaurora.ai/...` → `contentpulse.helloaurora.ai/...`)
- Function / symbol names renamed: 1 (`ReForgeMark` component → `ContentPulseMark`); 1 module-level constant (`RF_BASE` → `CONTENTPULSE_BASE`); 1 string constant value (`SISTER_PRODUCT_NAME = 'reforge'` → `'contentpulse'`).
- CSS variables renamed: 1 (`--reforge-gold` → `--contentpulse-gold`, plus matching tailwind token `reforge-gold` → `contentpulse-gold` and 4 in-template usages).
- Env var keys renamed (Sasa must update Vercel — see Manual action items): 3 reads, all keep legacy fallbacks during cutover.
- Event/type schema preserved (intentional): `content_velocity_event`, `voice_match_score`, `engagement_signal`, `ContentVelocityEvent`, `EngagementSignal` — none touched. Plus the `SignalType` literal union and `SignalPayload`'s `rf_*` field names (wire schema shared with the sibling product).
- Typecheck: NOT RUN — Bash execution was sandbox-blocked in this environment. No TypeScript-visible identifier removals were made; `ContentPulseMark` is exported from the same module the only consumer imports from, and the `RF_BASE` → `CONTENTPULSE_BASE` rename is local to a single file. A manual `pnpm build` (which runs typecheck) on Sasa's machine is recommended.
- Build: NOT RUN — same Bash sandbox restriction (`next build` was unavailable).
- Residual matches (intentional): all remaining hits are explicitly preserved wire-protocol identifiers, DB schema names, test fixture strings, or explanatory rename comments — itemized in the Residuals section.

## Files modified

### Cross-product UI strings (sibling product mentioned to users)
- `src/app/_landing-client.tsx` — Suite description, "Closed loop with…" card, cross-sell banner, footer link, FAQ answers, gold-color refs, Pricing-Suite description.
- `src/app/faq/page.tsx` — pricing/data-source/health-score/Brief copy.
- `src/app/(dashboard)/dashboard/settings/page.tsx` — Suite section header + status copy + locked-state copy + "ContentPulse client(s) waiting to be mapped" badge text.
- `src/app/(dashboard)/dashboard/settings/suite-mapping/page.tsx` — heading subtitle, error copy, all-mapped state, no-clients warning, "ContentPulse id" label, file header comment.
- `src/app/(dashboard)/dashboard/upgrade/page.tsx` — Suite cross-link card copy + outbound `contentpulse.helloaurora.ai/pricing` URL + module-doc bullet + Suspense-wrap inline comment.
- `src/app/(dashboard)/dashboard/onboarding/steps/step-suite.tsx` — onboarding instruction text, all-mapped state, error message, "ContentPulse id" label, "Open ContentPulse clients" link, outbound `contentpulse.helloaurora.ai/clients` URL, file header comment.
- `src/app/(dashboard)/dashboard/onboarding/page.tsx` — inline comment.
- `src/app/(dashboard)/dashboard/clients/[id]/page.tsx` — empty-state copy on client detail + Signals-tab section comment.
- `src/components/dashboard/header.tsx` — file header comment, `ContentPulseMark` import + usage, "Switch to ContentPulse" tooltip, comment block above the Inactive button. The `to=rf` query param on the handoff endpoint is intentionally LEFT alone (wire-protocol identifier shared with sibling product — flag-day risk).
- `src/components/dashboard/workflow-strip.tsx` — file header comment.
- `src/components/brand/brand-mark.tsx` — header comment + `ReForgeMark` → `ContentPulseMark` (function rename + display-text "ReForge" → "ContentPulse").

### User-rendered strings inside agent code
- `src/lib/agents/monday-brief-agent.ts` — `signalReason`-tag jsdoc, `ClientSignalsSnapshot` jsdoc, in-method comments, and the user-visible `rationale` string `"ContentPulse reports zero new pieces …"` carried into the Monday Brief.
- `src/lib/agents/health-scoring-agent.ts` — jsdoc on `signalsInput`, `pauseResume`, `engagementVelocity`, `signals`; in-method comments; user-visible `HealthSignal.message` `"Publishing has paused — ContentPulse reports zero new pieces"`.

### Documentation
- `docs/FAQ.md` — pricing line, data-source line, health-score line, Brief line.
- `eval/README.md` — Aurora Mythos suite list entry.
- `scripts/demo-seed/README.md` — "Pair with the ContentPulse seed" header + sibling-repo path + identity-map description (table name preserved with explanatory note).
- `scripts/demo-seed/identities.ts` — file header comment block; preserved DB column names (`rf_client_id`, `cp_rf_client_map`).

### Cross-product integration code (function names / env var reads / log identifiers / pipeline copy)
- `src/lib/supabase/sister.ts` — env-var reads now prefer `CONTENTPULSE_SUPABASE_URL` / `CONTENTPULSE_SUPABASE_SERVICE_ROLE_KEY` and fall back to legacy `RF_SUPABASE_URL` / `RF_SUPABASE_SERVICE_ROLE_KEY` during the Vercel cutover. Error message updated. `SISTER_PRODUCT_NAME = 'reforge'` → `'contentpulse'` (used only in `console.warn` log lines).
- `src/lib/stripe/suite-access.ts` — header comment.
- `src/lib/stripe/suite-detect.ts` — header comment + sandbox-fallback comment. Stripe price IDs PRESERVED.
- `src/lib/stripe/__tests__/suite-detect.test.ts` — header comment.
- `src/lib/stripe/__tests__/suite-access.test.ts` — switched primary env vars under test to `CONTENTPULSE_SUPABASE_*`, added a new test that exercises the legacy `RF_SUPABASE_*` fallback path (so the cutover is unit-covered).
- `src/lib/suite/handoff.ts` — header comment, with the `'rf'` HandoffSource value explicitly preserved.
- `src/lib/suite/roster.ts` — header comment.
- `src/lib/suite/__tests__/roster.test.ts` — header comment.
- `src/lib/signals/triggers.ts` — header comment + pause-trigger comment.
- `src/lib/signals/types.ts` — wire-schema header comment + signal-type comment + jsdoc on the `rf_*` fields (field names PRESERVED) + `emitted_at` jsdoc.
- `src/lib/signals/hmac.ts` — header comment.
- `src/lib/signals/__tests__/hmac.test.ts` — header comment.
- `src/lib/signals/ingest-trigger.ts` — header comment.
- `src/lib/health/refresh.ts` — section comment (Slice 2B header).
- `src/app/api/auth/handoff/issue/route.ts` — header comment, `RF_BASE` constant renamed to `CONTENTPULSE_BASE`, env-var read order is `NEXT_PUBLIC_CONTENTPULSE_BASE_URL` → legacy `NEXT_PUBLIC_RF_BASE_URL` → hard-coded `https://contentpulse.helloaurora.ai`. The `?to=rf` query param contract and `signHandoff(email, 'cp')` direction tag are intentionally kept stable; the comment block now documents that.
- `src/app/auth/handoff/route.ts` — header comment.
- `src/app/api/suite/roster/route.ts` — header comment + body comment.
- `src/app/api/suite/unmatched-signals/route.ts` — header comment + bullet text "X ContentPulse clients waiting".
- `src/app/api/suite/unmatched-signals/resolve/route.ts` — header comment.
- `src/app/api/signals/ingest/route.ts` — header comment + every internal comment that referenced "RF" (5 lines).
- `src/app/api/integrations/suite-status/route.ts` — header comments (2 lines).
- `src/app/api/eu-waitlist/route.ts` — header comment.
- `src/app/api/stripe/webhook/route.ts` — Suite-SKU + sister-write inline comments.
- `src/components/eu-notice-banner.tsx` — header comment.
- `src/lib/onboarding/state.ts` — jsdoc on `STEP_ORDER` + `buildStepOrder`.

### LLM / tier / geo modules ("Ported from reforge/..." comment hygiene)
- `src/lib/llm/types.ts`, `models.ts`, `index.ts`, `client.ts`, `registry.ts`, `routing.ts`, `base-provider.ts`, `providers/anthropic.ts`, `providers/openai.ts`, `providers/google.ts`
- `src/lib/tiers/limits.ts`, `enforce.ts`
- `src/lib/geo/eu.ts`

### Visual tokens
- `src/app/globals.css` — `--reforge-gold` → `--contentpulse-gold`.
- `tailwind.config.ts` — token `'reforge-gold'` → `'contentpulse-gold'`.

### Tests + scripts
- `tests/tiers/enforce.test.ts` — header comment.
- `tests/components/sidebar-ia.test.ts` — header comment.
- `scripts/verify-slice-2b.ts` — header comment.
- `scripts/demo-seed/seed.ts` — `insertClientMap` body comment (column names PRESERVED).

### Migrations (comments only — schema preserved)
- `supabase/migrations/20260428_eu_waitlist.sql` — header comment updated; CHECK constraint VALUE `'reforge'` PRESERVED (stored data identifier shared with sibling product writers — coordinated migration is owned by agent A1).
- `supabase/migrations/20260428_eu_waitlist_unique_constraint.sql` — header comment updated.
- `supabase/migrations/20260426_signal_pipeline_v1.sql` — header block + COMMENT ON TABLE strings updated.
- `supabase/migrations/20260427_signal_action_item_link_and_health_signals.sql` — header line + section comment.
- `supabase/migrations/20260430_cp_rf_unmatched_signals.sql` — header block + COMMENT ON TABLE string updated.

## Manual action items for Sasa

### Vercel env var renames (clientpulse project)
Add new keys (preferred) AND keep legacy keys until the rollout is observed green:

| New key | Legacy key (still read as fallback) | Where it's read |
| --- | --- | --- |
| `CONTENTPULSE_SUPABASE_URL` | `RF_SUPABASE_URL` | `src/lib/supabase/sister.ts` (Stripe-webhook Suite-flag mirroring) |
| `CONTENTPULSE_SUPABASE_SERVICE_ROLE_KEY` | `RF_SUPABASE_SERVICE_ROLE_KEY` | same |
| `NEXT_PUBLIC_CONTENTPULSE_BASE_URL` | `NEXT_PUBLIC_RF_BASE_URL` | `src/app/api/auth/handoff/issue/route.ts` (SSO redirect target) |

The code prefers the new key and silently falls back to the legacy key, so the rename can be a graceful Vercel UI add-then-remove rather than a flag-day cutover. Once both clientpulse and the sibling product (contentpulse) are deployed with the new keys set, the legacy fallbacks can be deleted in a small follow-up PR.

### Webhook URL update needed in ContentPulse config
The sibling product (formerly ReForge, now ContentPulse) should be configured to POST `/api/suite/roster` and any other CP-bound webhooks at the new ClientPulse URL. ClientPulse itself does not host the webhook RECEIVER — it makes outbound calls to `https://contentpulse.helloaurora.ai/...`. Updating CP's outbound URLs is what this PR did. The reverse direction (sibling product calling into ClientPulse) is handled by agent A1 in the contentpulse repo.

### Wire-protocol identifiers intentionally NOT touched (need a coordinated migration if they ever change)
- `?to=rf` query string on `/api/auth/handoff/issue`.
- `'rf'` value in `HandoffSource` union (`src/lib/suite/handoff.ts`).
- `signHandoff(email, 'cp')` direction tag — sibling product's verifier checks this exact string.
- `cp_rf_client_map` table name and its `rf_client_id` / `rf_client_name` columns.
- `cp_rf_unmatched_signals` table name + `rf_client_id` / `rf_client_name` columns.
- `eu_waitlist.product` CHECK constraint value `'reforge'`.
- `auth_handoff_nonces.source` CHECK constraint value `'rf'`.
- `SignalPayload.rf_client_id` / `rf_client_name` / `rf_client_email` wire-schema fields (`src/lib/signals/types.ts`).

If/when these are renamed, both products plus a backfill migration must land together; that's out of scope for an A4 cross-reference pass.

## Preserved (intentional)

- **Event payload schema names** — none touched. No `content_velocity_event`, `voice_match_score`, `engagement_signal`, `ContentVelocityEvent`, `EngagementSignal` tokens were modified.
- **Stripe product / price IDs** — `price_1TOg21LER55AcgjYgO4wGltx`, `price_1TOg24LER55AcgjYF0zC8mha` in `src/lib/stripe/suite-detect.ts` left untouched.
- **Database table / column names** — `cp_rf_client_map`, `cp_rf_unmatched_signals`, `rf_client_id`, `rf_client_name`, `rf_client_email`, and `eu_waitlist.product = 'reforge'` CHECK value all preserved (persistent data identifiers shared with the sibling product's writers).
- **Wire-protocol direction tags** — `?to=rf` query param, `'rf'` `HandoffSource` value, and `'cp'` direction string in `signHandoff()` preserved (HMAC payload contract with sibling product's verifier).
- **Test fixture string literals** — `'rf-client-1'`, `'rf-acme-1'` in HMAC + ingest-unmatched test seeds left as-is (they're opaque identifiers that exercise the wire format; renaming them would not test anything different).

## Residual matches
After the rename pass, `rg '[Rr]e[Ff]orge|REFORGE_|\bRF\b|\brf\b'` returns these intentional hits:

| File | Line | Why preserved |
| --- | --- | --- |
| `src/lib/suite/handoff.ts` | 18, 20 | comment explaining the preserved `'rf'` direction tag |
| `src/lib/suite/handoff.ts` | 24, 93 | `'rf'` is the wire-protocol HandoffSource value |
| `scripts/demo-seed/README.md` | 40 | DB table name `cp_rf_client_map` (in markdown identifier) |
| `supabase/migrations/20260426_auth_handoff_nonces.sql` | 9 | CHECK constraint value `'rf'` (persistent enum) |
| `supabase/migrations/20260428_eu_waitlist.sql` | 8, 10, 16 | comment + CHECK constraint value `'reforge'` |
| `tests/suite/ingest-unmatched.test.ts` | 12 | opaque test fixture literal `'rf-acme-1'` |
| `src/components/dashboard/header.tsx` | 201, 205 | comment + `?to=rf` query param (wire identifier) |
| `src/lib/signals/__tests__/hmac.test.ts` | 22 | opaque test fixture literal `'rf-client-1'` |
| `src/app/api/auth/handoff/issue/route.ts` | 7, 9, 10, 28, 38 | comments + `?to=rf` query param matches |
| `src/app/api/suite/unmatched-signals/resolve/route.ts` | 4 | DB column reference in jsdoc shape `cp_rf_client_map(agency, cp, rf)` |

Plus the legacy-fallback env var reads in `src/lib/supabase/sister.ts` and `src/app/api/auth/handoff/issue/route.ts` retain `RF_SUPABASE_*` / `NEXT_PUBLIC_RF_BASE_URL` references; those are the Vercel-cutover graceful-fallback path documented above and disappear once the legacy keys are removed.

## Decisions / ambiguous cases
- **`RF` short form in user-facing UI strings** ("All RF signals are mapped", "Don't see all your RF clients?", "RF id …", "RF activity signals", "{count} RF client(s) waiting to be mapped", "Pair RF clients with their ClientPulse counterparts", "RF reports zero new pieces") — TREATED as cross-product references and rewritten to "ContentPulse". Same reasoning for the `HealthSignal.message` and `MondayBriefRecommendedAction.rationale` strings that flow into the actual Monday Brief.
- **`RF` in the handoff query param `?to=rf` and HMAC direction tag `'cp'`** — LEFT alone. These are wire-protocol identifiers shared with the sibling product's verifier; renaming requires a coordinated change on both sides + a token cutover window. Documented in the file header comment.
- **DB column names `rf_client_id`, `rf_client_name`, `rf_client_email`, tables `cp_rf_client_map` + `cp_rf_unmatched_signals`** — LEFT alone (DB schema preserved per scope rules; renaming requires a migration plus sibling-product-writer coordination).
- **`SISTER_PRODUCT_NAME` constant** — RENAMED from `'reforge'` to `'contentpulse'`. This is only used as a `console.warn` substring in `suite-access.ts`; not a wire identifier.
- **`--reforge-gold` CSS variable** — RENAMED to `--contentpulse-gold`. The hex value `#4F46E5` is unchanged so the visual brand color is preserved; only the name reflects the sibling product.
- **`COMMENT ON TABLE` strings in migrations** — UPDATED. These are docstrings on persistent runtime objects (re-applied on migration replay); easy win for clarity. The tables themselves were NOT renamed.
- **Scripted `replace_all` of `RF_BASE`** — initially over-matched and replaced `NEXT_PUBLIC_RF_BASE_URL` (the legacy env-var read) with the new constant name. Reverted to keep the legacy env var intact as the documented cutover fallback.
