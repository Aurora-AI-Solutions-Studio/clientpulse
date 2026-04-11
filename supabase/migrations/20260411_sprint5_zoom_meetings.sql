-- Sprint 5 Task 5.3: Zoom Meeting Intelligence
-- Table: zoom_meetings — synced Zoom meetings + recording metadata

CREATE TABLE IF NOT EXISTS zoom_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  connection_id UUID NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  zoom_meeting_id TEXT NOT NULL,
  zoom_uuid TEXT NOT NULL,
  topic TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 0,
  meeting_type INT NOT NULL DEFAULT 2, -- 1=instant, 2=scheduled, 3=recurring, 8=recurring fixed
  join_url TEXT,
  participants JSONB DEFAULT '[]',
  participant_count INT NOT NULL DEFAULT 0,
  has_recording BOOLEAN DEFAULT false,
  recording_share_url TEXT,
  has_transcript BOOLEAN DEFAULT false,
  recording_size_bytes BIGINT DEFAULT 0,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(connection_id, zoom_meeting_id)
);

-- RLS
ALTER TABLE zoom_meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency members can view zoom meetings"
  ON zoom_meetings FOR SELECT
  USING (
    agency_id IN (
      SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Agency members can manage zoom meetings"
  ON zoom_meetings FOR ALL
  USING (
    agency_id IN (
      SELECT am.agency_id FROM agency_members am
      WHERE am.user_id = auth.uid() AND am.role IN ('owner', 'manager')
    )
  );

-- Indexes
CREATE INDEX idx_zoom_meetings_agency ON zoom_meetings(agency_id);
CREATE INDEX idx_zoom_meetings_client ON zoom_meetings(client_id);
CREATE INDEX idx_zoom_meetings_start ON zoom_meetings(start_time);
CREATE INDEX idx_zoom_meetings_connection ON zoom_meetings(connection_id);
