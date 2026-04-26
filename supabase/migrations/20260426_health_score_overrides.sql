-- HRAI Art 14 (Human Oversight) — health-score override audit columns.
--
-- The agency owner can manually override a client's computed health score
-- with a reason. The override is logged on the score row itself for v1
-- (single-state, no history). When we need full audit history (target
-- 2026-06-30 with the rest of HRAI Block F), this becomes an INSERT-only
-- table; until then, the column trio is enough to satisfy Art 14's
-- "human can adjust + reason recorded" requirement.

ALTER TABLE public.client_health_scores
  ADD COLUMN IF NOT EXISTS override_score   INTEGER NULL,
  ADD COLUMN IF NOT EXISTS override_reason  TEXT    NULL,
  ADD COLUMN IF NOT EXISTS overridden_by    UUID    NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS overridden_at    TIMESTAMPTZ NULL;
