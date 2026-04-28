-- Hotfix: PostgREST onConflict can't resolve a functional unique index.
-- Mirrors reforge migration 038. Same root cause: the prior functional
-- UNIQUE INDEX on (LOWER(email), product) is invisible to ON CONFLICT
-- (email, product) lookups. API now lowercases at the application
-- boundary; constraint is on plain columns so PostgREST can resolve
-- the upsert.

DROP INDEX IF EXISTS public.ux_eu_waitlist_email_product;

UPDATE public.eu_waitlist SET email = LOWER(email) WHERE email <> LOWER(email);

DELETE FROM public.eu_waitlist a
USING public.eu_waitlist b
WHERE a.id <> b.id
  AND a.email = b.email
  AND a.product = b.product
  AND a.created_at > b.created_at;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'eu_waitlist_email_product_unique'
      AND conrelid = 'public.eu_waitlist'::regclass
  ) THEN
    ALTER TABLE public.eu_waitlist
      ADD CONSTRAINT eu_waitlist_email_product_unique UNIQUE (email, product);
  END IF;
END $$;
