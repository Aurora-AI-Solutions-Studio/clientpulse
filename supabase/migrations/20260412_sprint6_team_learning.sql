-- Sprint 6: Team Features + Recursive Learning
-- Migration: 20260412_sprint6_team_learning.sql

-- ============================================================
-- 1. Team Invitations — invite flow with token-based acceptance
-- ============================================================
CREATE TABLE IF NOT EXISTS team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'manager', 'viewer')),
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ
);

CREATE INDEX idx_team_invitations_agency ON team_invitations(agency_id);
CREATE INDEX idx_team_invitations_token ON team_invitations(token);
CREATE INDEX idx_team_invitations_email ON team_invitations(email);

ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency members can view invitations" ON team_invitations
  FOR SELECT USING (
    agency_id IN (
      SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Owners and managers can create invitations" ON team_invitations
  FOR INSERT WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM agency_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'manager')
    )
  );

CREATE POLICY "Owners can update invitations" ON team_invitations
  FOR UPDATE USING (
    agency_id IN (
      SELECT agency_id FROM agency_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- ============================================================
-- 2. Client Assignments — which team member manages which client
-- ============================================================
CREATE TABLE IF NOT EXISTS client_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'account_manager' CHECK (role IN ('account_manager', 'support', 'lead')),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id),
  UNIQUE(client_id, user_id)
);

CREATE INDEX idx_client_assignments_client ON client_assignments(client_id);
CREATE INDEX idx_client_assignments_user ON client_assignments(user_id);
CREATE INDEX idx_client_assignments_agency ON client_assignments(agency_id);

ALTER TABLE client_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency members can view assignments" ON client_assignments
  FOR SELECT USING (
    agency_id IN (
      SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Owners and managers can manage assignments" ON client_assignments
  FOR ALL USING (
    agency_id IN (
      SELECT agency_id FROM agency_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'manager')
    )
  );

-- ============================================================
-- 3. Client Outcomes — track renewal/churn/expansion events
-- ============================================================
CREATE TABLE IF NOT EXISTS client_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  outcome_type TEXT NOT NULL CHECK (outcome_type IN ('renewed', 'churned', 'expanded', 'downgraded', 'paused')),
  outcome_date DATE NOT NULL DEFAULT CURRENT_DATE,
  previous_retainer NUMERIC,
  new_retainer NUMERIC,
  reason TEXT,
  notes TEXT,
  -- Snapshot of health score at time of outcome for learning
  health_score_at_outcome INTEGER,
  churn_prediction_at_outcome INTEGER,
  health_breakdown_at_outcome JSONB,
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_outcomes_client ON client_outcomes(client_id);
CREATE INDEX idx_client_outcomes_agency ON client_outcomes(agency_id);
CREATE INDEX idx_client_outcomes_type ON client_outcomes(outcome_type);
CREATE INDEX idx_client_outcomes_date ON client_outcomes(outcome_date);

ALTER TABLE client_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency members can view outcomes" ON client_outcomes
  FOR SELECT USING (
    agency_id IN (
      SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Agency members can create outcomes" ON client_outcomes
  FOR INSERT WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- 4. Prediction Feedback — was the churn prediction correct?
-- ============================================================
CREATE TABLE IF NOT EXISTS prediction_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  prediction_id UUID, -- reference to churn_predictions row
  predicted_churn_probability INTEGER NOT NULL,
  predicted_risk_level TEXT NOT NULL,
  actual_outcome TEXT NOT NULL CHECK (actual_outcome IN ('churned', 'renewed', 'expanded', 'downgraded', 'paused')),
  prediction_correct BOOLEAN NOT NULL, -- true if high-risk → churned, or low-risk → renewed
  days_between_prediction_and_outcome INTEGER,
  driving_factors JSONB, -- snapshot of factors at prediction time
  outcome_id UUID REFERENCES client_outcomes(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_prediction_feedback_agency ON prediction_feedback(agency_id);
CREATE INDEX idx_prediction_feedback_correct ON prediction_feedback(prediction_correct);

ALTER TABLE prediction_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency members can view feedback" ON prediction_feedback
  FOR SELECT USING (
    agency_id IN (
      SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- 5. Learning Snapshots — periodic accuracy tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS learning_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_predictions INTEGER NOT NULL DEFAULT 0,
  correct_predictions INTEGER NOT NULL DEFAULT 0,
  accuracy_rate NUMERIC(5,2), -- percentage
  total_outcomes INTEGER NOT NULL DEFAULT 0,
  -- Per-signal weight effectiveness
  signal_weights JSONB DEFAULT '{"financial": 0.30, "relationship": 0.30, "delivery": 0.25, "engagement": 0.15}',
  -- Recommended weight adjustments based on learning
  recommended_weights JSONB,
  -- Most predictive signals discovered
  top_predictive_signals JSONB,
  -- False positive/negative rates
  false_positive_rate NUMERIC(5,2),
  false_negative_rate NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agency_id, snapshot_date)
);

CREATE INDEX idx_learning_snapshots_agency ON learning_snapshots(agency_id);

ALTER TABLE learning_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency members can view snapshots" ON learning_snapshots
  FOR SELECT USING (
    agency_id IN (
      SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- 6. Slack Connections — webhook-based Slack integration
-- ============================================================
CREATE TABLE IF NOT EXISTS slack_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  webhook_url TEXT NOT NULL,
  channel_name TEXT,
  connected_by UUID NOT NULL REFERENCES auth.users(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  notify_monday_brief BOOLEAN NOT NULL DEFAULT true,
  notify_churn_alerts BOOLEAN NOT NULL DEFAULT true,
  notify_upsell BOOLEAN NOT NULL DEFAULT false,
  notify_health_drops BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ,
  UNIQUE(agency_id)
);

ALTER TABLE slack_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency members can view slack connections" ON slack_connections
  FOR SELECT USING (
    agency_id IN (
      SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can manage slack connections" ON slack_connections
  FOR ALL USING (
    agency_id IN (
      SELECT agency_id FROM agency_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- ============================================================
-- 7. Add role column to agency_members if not exists
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agency_members' AND column_name = 'role'
  ) THEN
    ALTER TABLE agency_members ADD COLUMN role TEXT NOT NULL DEFAULT 'owner'
      CHECK (role IN ('owner', 'manager', 'viewer'));
  END IF;
END $$;

-- ============================================================
-- 8. Add transcription_mode to agencies for Whisper hybrid
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agencies' AND column_name = 'transcription_mode'
  ) THEN
    ALTER TABLE agencies ADD COLUMN transcription_mode TEXT NOT NULL DEFAULT 'cloud'
      CHECK (transcription_mode IN ('cloud', 'local', 'hybrid'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agencies' AND column_name = 'local_whisper_endpoint'
  ) THEN
    ALTER TABLE agencies ADD COLUMN local_whisper_endpoint TEXT;
  END IF;
END $$;

-- ============================================================
-- 9. Add assigned_to column to clients for team assignments
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'assigned_to'
  ) THEN
    ALTER TABLE clients ADD COLUMN assigned_to UUID REFERENCES auth.users(id);
  END IF;
END $$;
