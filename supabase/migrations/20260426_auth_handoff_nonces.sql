-- Aurora Suite SSO replay-protection table.
-- Each successful handoff verification inserts the token's nonce here.
-- The PRIMARY KEY makes the second insert error out — first claim wins.
-- Service-role access only; no RLS policies.

CREATE TABLE IF NOT EXISTS auth_handoff_nonces (
  nonce       TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  source      TEXT NOT NULL CHECK (source IN ('cp', 'rf')),
  used_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_handoff_nonces_used_at
  ON auth_handoff_nonces (used_at);

ALTER TABLE auth_handoff_nonces ENABLE ROW LEVEL SECURITY;
-- No policies — service role bypasses RLS, anon/authenticated have no access.
