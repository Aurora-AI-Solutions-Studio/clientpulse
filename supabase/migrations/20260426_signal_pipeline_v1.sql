-- ContentPulse→CP Signal Pipeline v1.
--
-- Two tables:
--   1) cp_rf_client_map — agency-owned identity glue. Maps a ContentPulse
--      client's external id → the corresponding CP client's UUID.
--      Populated via the Suite setup wizard (slice 2 will surface UI;
--      slice 1 uses exact-name match as a stopgap). Table + column
--      names keep the legacy `rf_*` token because this schema is shared
--      with the sibling product's writers.
--   2) client_signals — every signal ContentPulse emits about a CP client.
--      Idempotent on (client_id, signal_type, period). Drives the
--      per-client Signals tab today; will feed the health-score engine
--      and Monday Brief in slice 2.

CREATE TABLE IF NOT EXISTS cp_rf_client_map (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  cp_client_id    UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  rf_client_id    TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agency_id, rf_client_id),
  UNIQUE (agency_id, cp_client_id)
);

CREATE INDEX IF NOT EXISTS idx_cp_rf_client_map_agency
  ON cp_rf_client_map (agency_id);
CREATE INDEX IF NOT EXISTS idx_cp_rf_client_map_rf_id
  ON cp_rf_client_map (rf_client_id);

ALTER TABLE cp_rf_client_map ENABLE ROW LEVEL SECURITY;
-- Service-role only; webhook ingest writes; agency setup wizard reads
-- via /api/me-style server routes that scope by agency_id.

CREATE TABLE IF NOT EXISTS client_signals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agency_id       UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  signal_type     TEXT NOT NULL CHECK (signal_type IN (
                    'content_velocity',
                    'approval_latency',
                    'pause_resume',
                    'voice_freshness',
                    'ingestion_rate'
                  )),
  -- "Period" is the bucket the signal describes, e.g. '2026-W17' for
  -- a weekly velocity signal. Idempotency: same (client, type, period)
  -- updates the existing row instead of inserting a duplicate.
  period          TEXT NOT NULL,
  -- Numeric value the signal carries (count, ms, %, days — type-specific).
  value           NUMERIC NOT NULL,
  -- Free-form metadata (recent piece IDs, sparkline points, prev-period
  -- delta, etc). Schema is signal-type specific; consumers narrow.
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  emitted_at      TIMESTAMPTZ NOT NULL,
  received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, signal_type, period)
);

CREATE INDEX IF NOT EXISTS idx_client_signals_client_emitted
  ON client_signals (client_id, emitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_signals_agency
  ON client_signals (agency_id);

ALTER TABLE client_signals ENABLE ROW LEVEL SECURITY;
-- Service-role writes from /api/signals/ingest; the per-client page
-- reads via getAuthedContext + agency scoping in the API route.

COMMENT ON TABLE cp_rf_client_map IS
  'Identity glue: maps a ContentPulse client external id to the corresponding CP client UUID per agency. Populated by the Suite setup wizard. Table + column names keep the legacy rf_* token because the schema is shared with the sibling product''s writers.';
COMMENT ON TABLE client_signals IS
  'ContentPulse->CP signals (publishing activity, approval latency, pause/resume, voice freshness, ingestion rate). Idempotent on (client_id, signal_type, period). Drives per-client Signals tab + health score + Monday Brief.';
