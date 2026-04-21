-- Migration: ClientPulse Sprint 8A M2 — MCP Server Exposure
--
-- Adds two tables:
--
--   api_keys         — per-user API keys used to authenticate MCP requests.
--                      Stored as SHA-256 hash + short public prefix; the raw
--                      key is shown once at creation and never again.
--
--   mcp_connections  — one row per live MCP connection. Enforces per-tier
--                      connection limits (pro: 3, agency: ∞). Rows are
--                      heartbeat'd by the transport and GC'd after 30m of idle.
--
-- Tier source: `profiles.subscription_plan` (existing 4-tier column
-- 'free' | 'starter' | 'pro' | 'agency'). No new plan column is introduced
-- here — the tier-naming sweep (starter → solo) will land with the
-- Tier Metering milestone.

-- ─── api_keys ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.api_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  prefix       TEXT NOT NULL,
  key_hash     TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT api_keys_prefix_len CHECK (char_length(prefix) = 12),
  CONSTRAINT api_keys_hash_len   CHECK (char_length(key_hash) = 64)
);

CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON public.api_keys (prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_user   ON public.api_keys (user_id);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY api_keys_owner_select ON public.api_keys
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY api_keys_owner_insert ON public.api_keys
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY api_keys_owner_update ON public.api_keys
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY api_keys_owner_delete ON public.api_keys
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY api_keys_service_all ON public.api_keys
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── mcp_connections ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mcp_connections (
  id           TEXT PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key_id   UUID NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  tier         TEXT NOT NULL,
  client_label TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mcp_connections_user      ON public.mcp_connections (user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_connections_last_seen ON public.mcp_connections (last_seen_at);

ALTER TABLE public.mcp_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY mcp_connections_owner_select ON public.mcp_connections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY mcp_connections_owner_delete ON public.mcp_connections
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY mcp_connections_service_all ON public.mcp_connections
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── mcp_tool_calls (audit) ──────────────────────────────────────
-- One row per tools/call so we can answer "which agents are calling which
-- tools". Best-effort write from the transport; absence is not fatal.

CREATE TABLE IF NOT EXISTS public.mcp_tool_calls (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key_id     UUID REFERENCES public.api_keys(id) ON DELETE SET NULL,
  connection_id  TEXT,
  tool_name      TEXT NOT NULL,
  status         TEXT NOT NULL,
  error_code     INT,
  duration_ms    INT,
  called_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mcp_tool_calls_user_time
  ON public.mcp_tool_calls (user_id, called_at DESC);

ALTER TABLE public.mcp_tool_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY mcp_tool_calls_owner_select ON public.mcp_tool_calls
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY mcp_tool_calls_service_all ON public.mcp_tool_calls
  FOR ALL TO service_role USING (true) WITH CHECK (true);
