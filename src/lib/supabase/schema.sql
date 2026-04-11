-- ============================================================================
-- ClientPulse Database Schema
-- Comprehensive Sprint 1-4 Schema for Supabase PostgreSQL
-- ============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get user's agency ID (used in RLS policies)
CREATE OR REPLACE FUNCTION get_user_agency_id(user_uuid uuid)
RETURNS uuid AS $$
DECLARE
  agency_id uuid;
BEGIN
  -- First check if user is directly in an agency
  SELECT ap.agency_id INTO agency_id
  FROM agency_members ap
  WHERE ap.user_id = user_uuid
  LIMIT 1;

  -- If not found, check if user owns an agency or has one in their profile
  IF agency_id IS NULL THEN
    SELECT id INTO agency_id
    FROM agencies
    WHERE owner_id = user_uuid
    LIMIT 1;
  END IF;

  RETURN agency_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to handle new user registration
-- NOTE: Must use raw_user_meta_data (not user_metadata — that column does not exist on auth.users).
-- Bug fix April 6, 2026 during EU migration: previous version used user_metadata and crashed signup
-- with "Database error saving new user". Production was manually patched but never committed back.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_agency_id uuid;
  user_name text;
BEGIN
  -- Determine user display name
  user_name := COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));

  -- 1. Create agency for the new user
  INSERT INTO public.agencies (name, owner_id, created_at, updated_at)
  VALUES (
    user_name || '''s Agency',
    new.id,
    now(),
    now()
  )
  RETURNING id INTO new_agency_id;

  -- 2. Create profile linked to the agency
  INSERT INTO public.profiles (id, full_name, email, agency_id, subscription_plan, subscription_status, created_at, updated_at)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    new_agency_id,
    'free',
    'active',
    now(),
    now()
  );

  -- 3. Add user as agency owner in members table
  INSERT INTO public.agency_members (agency_id, user_id, role, created_at)
  VALUES (
    new_agency_id,
    new.id,
    'owner',
    now()
  );

  RETURN new;
END;
$$;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TABLES
-- ============================================================================

-- profiles: User profile data (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name text,
  email text NOT NULL,
  avatar_url text,
  subscription_plan text NOT NULL DEFAULT 'free' CHECK (subscription_plan IN ('free', 'starter', 'pro', 'agency')),
  subscription_status text NOT NULL DEFAULT 'active' CHECK (subscription_status IN ('active', 'canceled', 'past_due', 'trialing')),
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text,
  trial_ends_at timestamptz,
  agency_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- agencies: Team workspace
CREATE TABLE IF NOT EXISTS public.agencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  stripe_connected_account_id text UNIQUE,
  settings jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- agency_members: Team members in an agency
CREATE TABLE IF NOT EXISTS public.agency_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'manager', 'viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agency_id, user_id)
);

-- clients: Client data
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies ON DELETE CASCADE,
  name text NOT NULL,
  company_name text NOT NULL,
  contact_email text,
  monthly_retainer numeric(10, 2),
  service_type text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'at_risk', 'critical', 'churned', 'paused')),
  notes text,
  stripe_customer_id text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- client_health_scores: Current health scores snapshot
CREATE TABLE IF NOT EXISTS public.client_health_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients ON DELETE CASCADE UNIQUE,
  overall_score integer CHECK (overall_score >= 0 AND overall_score <= 100),
  financial_score integer CHECK (financial_score >= 0 AND financial_score <= 100),
  relationship_score integer CHECK (relationship_score >= 0 AND relationship_score <= 100),
  delivery_score integer CHECK (delivery_score >= 0 AND delivery_score <= 100),
  engagement_score integer CHECK (engagement_score >= 0 AND engagement_score <= 100),
  signals jsonb NOT NULL DEFAULT '[]',
  computed_at timestamptz NOT NULL DEFAULT now()
);

-- meetings: Meeting records
CREATE TABLE IF NOT EXISTS public.meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients ON DELETE CASCADE,
  agency_id uuid NOT NULL REFERENCES agencies ON DELETE CASCADE,
  title text NOT NULL,
  meeting_date timestamptz NOT NULL,
  duration_minutes integer,
  audio_url text,
  transcript text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- meeting_intelligence: AI-extracted insights from meetings
CREATE TABLE IF NOT EXISTS public.meeting_intelligence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES meetings ON DELETE CASCADE UNIQUE,
  sentiment_score numeric(3, 1) CHECK (sentiment_score >= 1.0 AND sentiment_score <= 10.0),
  action_items jsonb NOT NULL DEFAULT '[]',
  scope_changes jsonb NOT NULL DEFAULT '{}',
  stakeholder_engagement jsonb NOT NULL DEFAULT '{}',
  escalation_signals jsonb NOT NULL DEFAULT '{}',
  upsell_mentions jsonb NOT NULL DEFAULT '{}',
  summary text,
  extracted_at timestamptz NOT NULL DEFAULT now()
);

-- action_items: Extracted and manually created action items
CREATE TABLE IF NOT EXISTS public.action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients ON DELETE CASCADE,
  meeting_id uuid REFERENCES meetings ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'overdue')),
  due_date date,
  assigned_to uuid REFERENCES auth.users ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- health_score_history: Time-series health score data
CREATE TABLE IF NOT EXISTS public.health_score_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients ON DELETE CASCADE,
  score integer NOT NULL CHECK (score >= 0 AND score <= 100),
  score_type text NOT NULL CHECK (score_type IN ('overall', 'financial', 'relationship', 'delivery', 'engagement')),
  recorded_at timestamptz NOT NULL DEFAULT now()
);

-- monday_briefs: Weekly generated briefs
CREATE TABLE IF NOT EXISTS public.monday_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies ON DELETE CASCADE,
  content jsonb NOT NULL DEFAULT '{}',
  email_sent boolean NOT NULL DEFAULT false,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- subscriptions: Stripe subscription tracking
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  stripe_subscription_id text NOT NULL UNIQUE,
  stripe_customer_id text NOT NULL,
  plan text NOT NULL,
  status text NOT NULL,
  current_period_start timestamptz NOT NULL,
  current_period_end timestamptz NOT NULL,
  cancel_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- client_invoices: Cached Stripe invoice data
CREATE TABLE IF NOT EXISTS public.client_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients ON DELETE CASCADE,
  stripe_invoice_id text NOT NULL,
  amount numeric(10, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  status text NOT NULL CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
  due_date date,
  paid_at timestamptz,
  days_overdue integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger for new user profile creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Triggers for updated_at columns
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_agencies_updated_at ON agencies;
CREATE TRIGGER update_agencies_updated_at
  BEFORE UPDATE ON agencies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- INDEXES
-- ============================================================================

-- profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_agency_id ON profiles(agency_id);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id ON profiles(stripe_customer_id);

-- agencies indexes
CREATE INDEX IF NOT EXISTS idx_agencies_owner_id ON agencies(owner_id);
CREATE INDEX IF NOT EXISTS idx_agencies_stripe_connected_account_id ON agencies(stripe_connected_account_id);

-- agency_members indexes
CREATE INDEX IF NOT EXISTS idx_agency_members_agency_id ON agency_members(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_members_user_id ON agency_members(user_id);
CREATE INDEX IF NOT EXISTS idx_agency_members_agency_user ON agency_members(agency_id, user_id);

-- clients indexes
CREATE INDEX IF NOT EXISTS idx_clients_agency_id ON clients(agency_id);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_agency_status ON clients(agency_id, status);
CREATE INDEX IF NOT EXISTS idx_clients_stripe_customer_id ON clients(stripe_customer_id);

-- client_health_scores indexes
CREATE INDEX IF NOT EXISTS idx_client_health_scores_client_id ON client_health_scores(client_id);

-- meetings indexes
CREATE INDEX IF NOT EXISTS idx_meetings_client_id ON meetings(client_id);
CREATE INDEX IF NOT EXISTS idx_meetings_agency_id ON meetings(agency_id);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
CREATE INDEX IF NOT EXISTS idx_meetings_meeting_date ON meetings(meeting_date);

-- meeting_intelligence indexes
CREATE INDEX IF NOT EXISTS idx_meeting_intelligence_meeting_id ON meeting_intelligence(meeting_id);

-- action_items indexes
CREATE INDEX IF NOT EXISTS idx_action_items_client_id ON action_items(client_id);
CREATE INDEX IF NOT EXISTS idx_action_items_meeting_id ON action_items(meeting_id);
CREATE INDEX IF NOT EXISTS idx_action_items_status ON action_items(status);
CREATE INDEX IF NOT EXISTS idx_action_items_assigned_to ON action_items(assigned_to);

-- health_score_history indexes
CREATE INDEX IF NOT EXISTS idx_health_score_history_client_id ON health_score_history(client_id);
CREATE INDEX IF NOT EXISTS idx_health_score_history_score_type ON health_score_history(score_type);
CREATE INDEX IF NOT EXISTS idx_health_score_history_recorded_at ON health_score_history(recorded_at);
CREATE INDEX IF NOT EXISTS idx_health_score_history_client_type_date ON health_score_history(client_id, score_type, recorded_at);

-- monday_briefs indexes
CREATE INDEX IF NOT EXISTS idx_monday_briefs_agency_id ON monday_briefs(agency_id);
CREATE INDEX IF NOT EXISTS idx_monday_briefs_created_at ON monday_briefs(created_at);

-- subscriptions indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);

-- client_invoices indexes
CREATE INDEX IF NOT EXISTS idx_client_invoices_client_id ON client_invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_client_invoices_stripe_invoice_id ON client_invoices(stripe_invoice_id);
CREATE INDEX IF NOT EXISTS idx_client_invoices_status ON client_invoices(status);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_health_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE monday_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_invoices ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES: profiles
-- ============================================================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Agency members can view profiles of other members in their agency
CREATE POLICY "Agency members can view member profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM agency_members am
      WHERE am.user_id = auth.uid()
      AND am.agency_id = (SELECT agency_id FROM profiles WHERE id = auth.uid())
    )
  );

-- ============================================================================
-- RLS POLICIES: agencies
-- ============================================================================

-- Owners can do everything with their own agency
CREATE POLICY "Owners can manage own agency" ON agencies
  FOR ALL USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Agency members can view their agency
CREATE POLICY "Agency members can view agency" ON agencies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM agency_members am
      WHERE am.user_id = auth.uid()
      AND am.agency_id = id
    )
  );

-- Only managers and owners can update agency
CREATE POLICY "Managers and owners can update agency" ON agencies
  FOR UPDATE USING (
    auth.uid() = owner_id OR
    EXISTS (
      SELECT 1 FROM agency_members am
      WHERE am.user_id = auth.uid()
      AND am.agency_id = id
      AND am.role IN ('owner', 'manager')
    )
  )
  WITH CHECK (
    auth.uid() = owner_id OR
    EXISTS (
      SELECT 1 FROM agency_members am
      WHERE am.user_id = auth.uid()
      AND am.agency_id = id
      AND am.role IN ('owner', 'manager')
    )
  );

-- ============================================================================
-- RLS POLICIES: agency_members
-- ============================================================================

-- Agency members can view other members in their agency
CREATE POLICY "Agency members can view other members" ON agency_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM agency_members am
      WHERE am.user_id = auth.uid()
      AND am.agency_id = agency_id
    )
  );

-- Only owners can manage agency members
CREATE POLICY "Only owners can manage members" ON agency_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM agencies a
      WHERE a.id = agency_id
      AND a.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM agencies a
      WHERE a.id = agency_id
      AND a.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- RLS POLICIES: clients
-- ============================================================================

-- Agency members can view clients in their agency
CREATE POLICY "Agency members can view agency clients" ON clients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM agency_members am
      WHERE am.user_id = auth.uid()
      AND am.agency_id = agency_id
    ) OR
    EXISTS (
      SELECT 1 FROM agencies a
      WHERE a.id = agency_id
      AND a.owner_id = auth.uid()
    )
  );

-- Only managers and owners can insert clients
CREATE POLICY "Managers and owners can create clients" ON clients
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM agency_members am
      WHERE am.user_id = auth.uid()
      AND am.agency_id = agency_id
      AND am.role IN ('owner', 'manager')
    ) OR
    EXISTS (
      SELECT 1 FROM agencies a
      WHERE a.id = agency_id
      AND a.owner_id = auth.uid()
    )
  );

-- Only managers and owners can update clients
CREATE POLICY "Managers and owners can update clients" ON clients
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM agency_members am
      WHERE am.user_id = auth.uid()
      AND am.agency_id = agency_id
      AND am.role IN ('owner', 'manager')
    ) OR
    EXISTS (
      SELECT 1 FROM agencies a
      WHERE a.id = agency_id
      AND a.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM agency_members am
      WHERE am.user_id = auth.uid()
      AND am.agency_id = agency_id
      AND am.role IN ('owner', 'manager')
    ) OR
    EXISTS (
      SELECT 1 FROM agencies a
      WHERE a.id = agency_id
      AND a.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- RLS POLICIES: client_health_scores
-- ============================================================================

CREATE POLICY "Agency members can view health scores" ON client_health_scores
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM clients c
      INNER JOIN agency_members am ON c.agency_id = am.agency_id
      WHERE c.id = client_id
      AND am.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM clients c
      INNER JOIN agencies a ON c.agency_id = a.id
      WHERE c.id = client_id
      AND a.owner_id = auth.uid()
    )
  );

-- Only managers and owners can update health scores
CREATE POLICY "Managers and owners can update health scores" ON client_health_scores
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM clients c
      INNER JOIN agency_members am ON c.agency_id = am.agency_id
      WHERE c.id = client_id
      AND am.user_id = auth.uid()
      AND am.role IN ('owner', 'manager')
    ) OR
    EXISTS (
      SELECT 1 FROM clients c
      INNER JOIN agencies a ON c.agency_id = a.id
      WHERE c.id = client_id
      AND a.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients c
      INNER JOIN agency_members am ON c.agency_id = am.agency_id
      WHERE c.id = client_id
      AND am.user_id = auth.uid()
      AND am.role IN ('owner', 'manager')
    ) OR
    EXISTS (
      SELECT 1 FROM clients c
      INNER JOIN agencies a ON c.agency_id = a.id
      WHERE c.id = client_id
      AND a.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- RLS POLICIES: meetings
-- ============================================================================

CREATE POLICY "Agency members can view meetings" ON meetings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM agency_members am
      WHERE am.user_id = auth.uid()
      AND am.agency_id = agency_id
    ) OR
    EXISTS (
      SELECT 1 FROM agencies a
      WHERE a.id = agency_id
      AND a.owner_id = auth.uid()
    )
  );

CREATE POLICY "Managers and owners can create meetings" ON meetings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM agency_members am
      WHERE am.user_id = auth.uid()
      AND am.agency_id = agency_id
      AND am.role IN ('owner', 'manager')
    ) OR
    EXISTS (
      SELECT 1 FROM agencies a
      WHERE a.id = agency_id
      AND a.owner_id = auth.uid()
    )
  );

CREATE POLICY "Managers and owners can update meetings" ON meetings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM agency_members am
      WHERE am.user_id = auth.uid()
      AND am.agency_id = agency_id
      AND am.role IN ('owner', 'manager')
    ) OR
    EXISTS (
      SELECT 1 FROM agencies a
      WHERE a.id = agency_id
      AND a.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM agency_members am
      WHERE am.user_id = auth.uid()
      AND am.agency_id = agency_id
      AND am.role IN ('owner', 'manager')
    ) OR
    EXISTS (
      SELECT 1 FROM agencies a
      WHERE a.id = agency_id
      AND a.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- RLS POLICIES: meeting_intelligence
-- ============================================================================

CREATE POLICY "Agency members can view meeting intelligence" ON meeting_intelligence
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM meetings m
      INNER JOIN agency_members am ON m.agency_id = am.agency_id
      WHERE m.id = meeting_id
      AND am.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM meetings m
      INNER JOIN agencies a ON m.agency_id = a.id
      WHERE m.id = meeting_id
      AND a.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- RLS POLICIES: action_items
-- ============================================================================

CREATE POLICY "Agency members can view action items" ON action_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM clients c
      INNER JOIN agency_members am ON c.agency_id = am.agency_id
      WHERE c.id = client_id
      AND am.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM clients c
      INNER JOIN agencies a ON c.agency_id = a.id
      WHERE c.id = client_id
      AND a.owner_id = auth.uid()
    )
  );

CREATE POLICY "Managers and owners can manage action items" ON action_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM clients c
      INNER JOIN agency_members am ON c.agency_id = am.agency_id
      WHERE c.id = client_id
      AND am.user_id = auth.uid()
      AND am.role IN ('owner', 'manager')
    ) OR
    EXISTS (
      SELECT 1 FROM clients c
      INNER JOIN agencies a ON c.agency_id = a.id
      WHERE c.id = client_id
      AND a.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients c
      INNER JOIN agency_members am ON c.agency_id = am.agency_id
      WHERE c.id = client_id
      AND am.user_id = auth.uid()
      AND am.role IN ('owner', 'manager')
    ) OR
    EXISTS (
      SELECT 1 FROM clients c
      INNER JOIN agencies a ON c.agency_id = a.id
      WHERE c.id = client_id
      AND a.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- RLS POLICIES: health_score_history
-- ============================================================================

CREATE POLICY "Agency members can view health score history" ON health_score_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM clients c
      INNER JOIN agency_members am ON c.agency_id = am.agency_id
      WHERE c.id = client_id
      AND am.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM clients c
      INNER JOIN agencies a ON c.agency_id = a.id
      WHERE c.id = client_id
      AND a.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- RLS POLICIES: monday_briefs
-- ============================================================================

CREATE POLICY "Agency members can view briefs" ON monday_briefs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM agency_members am
      WHERE am.user_id = auth.uid()
      AND am.agency_id = agency_id
    ) OR
    EXISTS (
      SELECT 1 FROM agencies a
      WHERE a.id = agency_id
      AND a.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- RLS POLICIES: subscriptions
-- ============================================================================

-- Users can only view their own subscriptions
CREATE POLICY "Users can view own subscriptions" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================================
-- RLS POLICIES: client_invoices
-- ============================================================================

CREATE POLICY "Agency members can view invoices" ON client_invoices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM clients c
      INNER JOIN agency_members am ON c.agency_id = am.agency_id
      WHERE c.id = client_id
      AND am.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM clients c
      INNER JOIN agencies a ON c.agency_id = a.id
      WHERE c.id = client_id
      AND a.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- SCHEMA COMPLETE
-- ============================================================================
-- This schema supports:
-- - Multi-tenant agency workspaces
-- - User roles: owner, manager, viewer
-- - Client health monitoring with scores and trends
-- - Meeting management with AI intelligence extraction
-- - Action item tracking
-- - Stripe billing integration
-- - Weekly brief generation
-- - Full RLS row-level security
-- ============================================================================
