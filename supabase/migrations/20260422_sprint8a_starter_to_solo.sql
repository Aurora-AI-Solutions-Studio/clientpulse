-- Migration: Sprint 8A tier-naming sweep — rename `starter` → `solo`
--
-- Context: the old `starter` tier name is being replaced by `solo` across
-- the ClientPulse codebase (types, stripe-config, LLM routing, MCP). This
-- migration mirrors the code change at the DB layer:
--
--   1. Rename any existing `profiles.subscription_plan = 'starter'` rows
--      to `'solo'` (no-op on prod today — Sasa's row is `agency`, no
--      `starter` rows exist — but kept idempotent for completeness).
--   2. Replace the CHECK constraint so the accepted value set is
--      ('free', 'solo', 'pro', 'agency').
--
-- `free` is kept in the accepted set because the `handle_new_user()`
-- trigger still writes `'free'` on signup. Removing `free` is a launch-gate
-- task ("no free access paths") and is out of scope here.

-- ─── 1. Data migration ─────────────────────────────────────────────
-- Idempotent: if the column already contains no 'starter' rows, this
-- is a no-op. Run before the constraint swap so the new constraint
-- never rejects live data.

UPDATE public.profiles
  SET subscription_plan = 'solo'
  WHERE subscription_plan = 'starter';

-- ─── 2. CHECK constraint swap ──────────────────────────────────────
-- Postgres names column-level CHECK constraints automatically. We look
-- the constraint up via the catalog instead of assuming a name, so this
-- survives any prior manual renames without hand-editing.

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.profiles'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%subscription_plan%IN%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', constraint_name);
  END IF;
END
$$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_subscription_plan_check
  CHECK (subscription_plan IN ('free', 'solo', 'pro', 'agency'));
