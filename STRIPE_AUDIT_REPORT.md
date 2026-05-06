# ClientPulse Stripe Audit Report

## Date
2026-05-06

## Existing Vercel env var inventory (relevant to Stripe)

State BEFORE this audit:

| Env var name                        | Environments         | Created |
|-------------------------------------|----------------------|---------|
| STRIPE_CLIENT_ID                    | Preview, Production  | 6d ago  |
| STRIPE_SECRET_KEY                   | Production           | 11d ago |
| STRIPE_PRICE_ID_SOLO                | Preview, Production  | 14d ago |
| STRIPE_PRICE_ID_PRO                 | Preview, Production  | 14d ago |
| STRIPE_PRICE_ID_AGENCY              | Preview, Production  | 14d ago |
| STRIPE_PRICE_ID_SOLO_YEARLY         | Preview, Production  | 14d ago |
| STRIPE_PRICE_ID_PRO_YEARLY          | Preview, Production  | 14d ago |
| STRIPE_PRICE_ID_AGENCY_YEARLY       | Preview, Production  | 14d ago |
| NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY  | Dev, Preview, Prod   | 32d ago |
| STRIPE_WEBHOOK_SECRET               | Production           | 32d ago |

Missing entirely from Vercel before audit: `STRIPE_SUITE_PRICE_ID`, `STRIPE_SUITE_ANNUAL_PRICE_ID`.

## Code-expected env vars + hardcoded fallbacks

| Tier        | Env var                          | File:line                                            | Hardcoded price ID                  | Product               | Amount    | Active |
|-------------|----------------------------------|------------------------------------------------------|-------------------------------------|-----------------------|-----------|--------|
| Solo monthly   | `STRIPE_PRICE_ID_SOLO`          | src/lib/stripe-config.ts:96 (override) / :41 (fallback) | price_1TOCSyLER55AcgjYTjr0Ymxk | prod_UGHPAJi3MzjPFU | $59.00/mo  | yes |
| Solo yearly    | `STRIPE_PRICE_ID_SOLO_YEARLY`   | src/lib/stripe-config.ts:104 / :42                      | price_1TOCSzLER55AcgjYlwd6ps8j | prod_UGHPAJi3MzjPFU | $590.00/yr | yes |
| Pro monthly    | `STRIPE_PRICE_ID_PRO`           | src/lib/stripe-config.ts:97 / :58                       | price_1TOCT1LER55AcgjYLFyuBIOM | prod_UGHPMZvDuwJwGR | $199.00/mo | yes |
| Pro yearly     | `STRIPE_PRICE_ID_PRO_YEARLY`    | src/lib/stripe-config.ts:105 / :59                      | price_1TOCT2LER55AcgjY2esRF5FH | prod_UGHPMZvDuwJwGR | $1,990.00/yr | yes |
| Agency monthly | `STRIPE_PRICE_ID_AGENCY`        | src/lib/stripe-config.ts:98 / :76                       | price_1TOCT4LER55AcgjYFuQNxk2Y | prod_UGHP5p2K5IaHoy | $799.00/mo | yes |
| Agency yearly  | `STRIPE_PRICE_ID_AGENCY_YEARLY` | src/lib/stripe-config.ts:106 / :77                      | price_1TOCT5LER55AcgjYD7CC8P7C | prod_UGHP5p2K5IaHoy | $7,990.00/yr | yes |
| Suite monthly  | `STRIPE_SUITE_PRICE_ID`         | src/lib/stripe/suite-detect.ts:19 (override) / :25 (fallback) | price_1TOg21LER55AcgjYgO4wGltx | prod_UNQtNrc4Jf6izZ | $999.00/mo | yes |
| Suite annual   | `STRIPE_SUITE_ANNUAL_PRICE_ID`  | src/lib/stripe/suite-detect.ts:20 / :26                 | price_1TOg24LER55AcgjYF0zC8mha | prod_UNQtNrc4Jf6izZ | $9,990.00/yr | yes |

Code load mechanism:
- `src/lib/stripe-config.ts` defines `STRIPE_PLANS` with hardcoded literals as defaults; `initializeStripePriceIds()` (lines 95–111) overrides with env values when present. Called at boot from `src/app/api/stripe/checkout/route.ts:13`.
- `src/lib/stripe/suite-detect.ts` reads env first; if BOTH Suite env vars are absent it falls back to the two literal Suite price IDs (lines 24–27). Used by webhook for cross-product Suite access detection.

## Gaps identified

Before this audit:
1. `STRIPE_SUITE_PRICE_ID` — code expects this for Suite webhook detection. NOT in Vercel.
2. `STRIPE_SUITE_ANNUAL_PRICE_ID` — code expects this for Suite annual webhook detection. NOT in Vercel.

The 6 monthly/yearly tier env vars (`STRIPE_PRICE_ID_*`) already exist in Vercel under names that EXACTLY match what the code expects — no name mismatch, no mirroring required.

## Env vars added to production

| Env var                       | Value                            | Status |
|-------------------------------|----------------------------------|--------|
| STRIPE_SUITE_PRICE_ID         | price_1TOg21LER55AcgjYgO4wGltx   | added  |
| STRIPE_SUITE_ANNUAL_PRICE_ID  | price_1TOg24LER55AcgjYF0zC8mha   | added  |

Total added: 2.

## Existing legacy env var mapping (if applicable)

None. The brief raised the possibility of name mismatches (e.g., `STRIPE_CP_STARTER_PRICE_ID` vs `STRIPE_PRICE_ID_SOLO`). After reading `src/lib/stripe-config.ts` and grepping all ClientPulse code, the only env names referenced in code are:

- `STRIPE_PRICE_ID_{SOLO,PRO,AGENCY}` and `STRIPE_PRICE_ID_{SOLO,PRO,AGENCY}_YEARLY`
- `STRIPE_SUITE_PRICE_ID` and `STRIPE_SUITE_ANNUAL_PRICE_ID`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CLIENT_ID`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

The first 6 already exist in Vercel under exactly those names. No `STRIPE_CP_*` names appear anywhere in the codebase. No mirroring needed.

## Stripe verification

All 8 hardcoded fallback prices verified active in Stripe (sandbox account acct_1TE0IeLER55AcgjY) on 2026-05-06:

- price_1TOCSyLER55AcgjYTjr0Ymxk — active, USD 5900/month, prod_UGHPAJi3MzjPFU (Solo)
- price_1TOCSzLER55AcgjYlwd6ps8j — active, USD 59000/year, prod_UGHPAJi3MzjPFU (Solo)
- price_1TOCT1LER55AcgjYLFyuBIOM — active, USD 19900/month, prod_UGHPMZvDuwJwGR (Pro)
- price_1TOCT2LER55AcgjY2esRF5FH — active, USD 199000/year, prod_UGHPMZvDuwJwGR (Pro)
- price_1TOCT4LER55AcgjYFuQNxk2Y — active, USD 79900/month, prod_UGHP5p2K5IaHoy (Agency)
- price_1TOCT5LER55AcgjYD7CC8P7C — active, USD 799000/year, prod_UGHP5p2K5IaHoy (Agency)
- price_1TOg21LER55AcgjYgO4wGltx — active, USD 99900/month, prod_UNQtNrc4Jf6izZ (Suite)
- price_1TOg24LER55AcgjYF0zC8mha — active, USD 999000/year, prod_UNQtNrc4Jf6izZ (Suite)

All amounts match the canonical pricing in `STRIPE_PLANS` and the Pricing Deep-Dive (Apr 14, 2026).

## Redeploy status

- Triggered: `vercel deploy --prod --yes` from clientpulse repo root after adding both Suite env vars.
- Deployment ID: `dpl_3YzdMEFJ11LfTUdrRNy4bzx3jHSi`
- Production URL: https://clientpulse-qio7o7rpa-aurora-portfolio.vercel.app
- Production alias: https://clientpulse-tau.vercel.app
- Inspector: https://vercel.com/aurora-portfolio/clientpulse/3YzdMEFJ11LfTUdrRNy4bzx3jHSi
- readyState: READY
- Build time: ~2 min, no errors (only pre-existing Sentry deprecation + ESLint img warnings, unrelated).

## Anomalies / Decisions

1. Sandbox vs livemode: `src/lib/stripe-config.ts:39` notes the hardcoded prices are "Test-mode defaults (Sandbox acct_1TE0IeLER55AcgjY)". The `stripe prices retrieve` calls returned active prices in the same sandbox account, so the env-var-vs-fallback chain is consistent for the current environment. At the livemode flip, all 8 env vars must be repointed to the corresponding livemode price IDs — the explicit env vars are already in place to make that flip a one-shot env update with no code change.
2. Suite price IDs are shared across ContentPulse and ClientPulse (single Stripe product `prod_UNQtNrc4Jf6izZ`). The same env var names are used in both repos per `suite-detect.ts:5–7` ("both products' webhook handlers read from the SAME env vars"). Suggest verifying the contentpulse repo's STRIPE_SUITE_* values match — out of scope for this audit but worth a quick cross-check.
3. Vercel env scope: Suite env vars added to `production` only (matching the brief's instruction "Add explicit env vars to ClientPulse Vercel production"). The 6 tier env vars are present in both `Preview` and `Production`. If Suite checkout needs to be testable on Preview deployments, consider mirroring the two new vars to Preview as well — flagged as manual follow-up.
4. No code, git, or Stripe modifications made.

## Manual follow-up for Sasa (if any)

1. (Optional) Mirror `STRIPE_SUITE_PRICE_ID` and `STRIPE_SUITE_ANNUAL_PRICE_ID` to Preview env if Suite-related preview deployments need to test webhook detection without falling back to literals.
2. (Cross-check) Confirm contentpulse repo has the same two Suite env values pointing at the same price IDs so cross-product webhook detection stays symmetric.
3. (Livemode flip, future) When switching to Stripe livemode, update all 8 STRIPE_PRICE_ID_* / STRIPE_SUITE_* values in Vercel to the livemode price IDs. Code requires no change because the override layer is now wired up.
