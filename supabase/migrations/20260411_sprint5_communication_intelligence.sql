-- Sprint 5: Communication Intelligence — Calendar, Email, Engagement
-- Tables: integration_connections, calendar_events, email_threads, engagement_metrics

-- ─── Integration Connections ────────────────────────────────────────
-- Stores OAuth tokens for Google Calendar, Gmail, Zoom, etc.
CREATE TABLE IF NOT EXISTS integration_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google_calendar', 'gmail', 'zoom', 'google_meet')),
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'expired', 'error')),
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[] DEFAULT '{}',
  account_email TEXT,
  account_name TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_sync_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agency_id, user_id, provider)
);

-- RLS for integration_connections
ALTER TABLE integration_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency members can view their connections"
  ON integration_connections FOR SELECT
  USING (
    agency_id IN (
      SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their own connections"
  ON integration_connections FOR ALL
  USING (user_id = auth.uid());

CREATE INDEX idx_integration_connections_agency ON integration_connections(agency_id);
CREATE INDEX idx_integration_connections_user ON integration_connections(user_id);

-- ─── Calendar Events ────────────────────────────────────────────────
-- Synced calendar events matched to clients
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  connection_id UUID NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  google_event_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  attendees JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'tentative', 'cancelled')),
  meeting_link TEXT,
  is_recurring BOOLEAN DEFAULT false,
  recurring_event_id TEXT,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(connection_id, google_event_id)
);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency members can view calendar events"
  ON calendar_events FOR SELECT
  USING (
    agency_id IN (
      SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Agency members can manage calendar events"
  ON calendar_events FOR ALL
  USING (
    agency_id IN (
      SELECT am.agency_id FROM agency_members am
      WHERE am.user_id = auth.uid() AND am.role IN ('owner', 'manager')
    )
  );

CREATE INDEX idx_calendar_events_agency ON calendar_events(agency_id);
CREATE INDEX idx_calendar_events_client ON calendar_events(client_id);
CREATE INDEX idx_calendar_events_start ON calendar_events(start_time);
CREATE INDEX idx_calendar_events_connection ON calendar_events(connection_id);

-- ─── Email Threads ──────────────────────────────────────────────────
-- Synced email thread metadata matched to clients (no email body stored)
CREATE TABLE IF NOT EXISTS email_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  connection_id UUID NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  gmail_thread_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  last_message_date TIMESTAMPTZ NOT NULL,
  message_count INT NOT NULL DEFAULT 1,
  participants TEXT[] DEFAULT '{}',
  snippet TEXT,
  is_inbound BOOLEAN DEFAULT false,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(connection_id, gmail_thread_id)
);

ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency members can view email threads"
  ON email_threads FOR SELECT
  USING (
    agency_id IN (
      SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Agency members can manage email threads"
  ON email_threads FOR ALL
  USING (
    agency_id IN (
      SELECT am.agency_id FROM agency_members am
      WHERE am.user_id = auth.uid() AND am.role IN ('owner', 'manager')
    )
  );

CREATE INDEX idx_email_threads_agency ON email_threads(agency_id);
CREATE INDEX idx_email_threads_client ON email_threads(client_id);
CREATE INDEX idx_email_threads_last_msg ON email_threads(last_message_date);

-- ─── Engagement Metrics ─────────────────────────────────────────────
-- Computed engagement scores per client (updated on sync + health score recompute)
CREATE TABLE IF NOT EXISTS engagement_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  -- Calendar signals
  calendar_score FLOAT DEFAULT 0,
  meeting_frequency FLOAT DEFAULT 0,
  meeting_frequency_trend TEXT DEFAULT 'stable' CHECK (meeting_frequency_trend IN ('increasing', 'stable', 'declining')),
  last_meeting_days_ago INT DEFAULT 999,
  next_meeting_days_away INT,
  attendee_engagement FLOAT DEFAULT 0,
  cadence_regularity FLOAT DEFAULT 0,
  -- Email signals
  email_score FLOAT DEFAULT 0,
  email_volume_trend TEXT DEFAULT 'stable' CHECK (email_volume_trend IN ('increasing', 'stable', 'declining')),
  avg_response_time_hours FLOAT,
  client_responsiveness FLOAT DEFAULT 0,
  -- Combined
  overall_engagement_score FLOAT DEFAULT 0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agency_id, client_id)
);

ALTER TABLE engagement_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency members can view engagement metrics"
  ON engagement_metrics FOR SELECT
  USING (
    agency_id IN (
      SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Agency members can manage engagement metrics"
  ON engagement_metrics FOR ALL
  USING (
    agency_id IN (
      SELECT am.agency_id FROM agency_members am
      WHERE am.user_id = auth.uid() AND am.role IN ('owner', 'manager')
    )
  );

CREATE INDEX idx_engagement_metrics_agency ON engagement_metrics(agency_id);
CREATE INDEX idx_engagement_metrics_client ON engagement_metrics(client_id);
CREATE INDEX idx_engagement_metrics_score ON engagement_metrics(overall_engagement_score);
