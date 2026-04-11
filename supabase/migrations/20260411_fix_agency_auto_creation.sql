-- Fix: Auto-create agency and agency_member when a new user signs up
-- Previously, only a profile was created, leaving agency_id NULL.
-- This caused OAuth integrations to fail with "no_agency" error.

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
