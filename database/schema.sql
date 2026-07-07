-- =============================================================================
-- King Battle — Complete Supabase Database Schema (Single Run)
-- =============================================================================
-- Consolidated from FULLSTACK-ESPORTS-SC/database/schema.sql and all
-- king-battle-fullstack/database/migration_*.sql files.
-- Run this ONCE in Supabase SQL Editor on a fresh project.
-- Paste the entire file and execute. Tables, RLS, triggers, and seed data will
-- be created. Safe to re-run most sections (IF NOT EXISTS, DROP IF EXISTS).
-- Excludes one-off ops scripts: cleanup_cancelled_matches.sql, migration_test_user.sql
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 001: Initial Schema
-- =============================================================================

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  in_game_name TEXT,
  in_game_uid TEXT,
  coins INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admins table (adminname + password credentials; user_id optional for future link)
CREATE TABLE public.admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  adminname TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Games table
CREATE TABLE public.games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  image_url TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Game modes table
CREATE TABLE public.game_modes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  image_url TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Matches table
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_mode_id UUID NOT NULL REFERENCES public.game_modes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  entry_fee INTEGER NOT NULL DEFAULT 0,
  room_code TEXT,
  room_password TEXT,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'ongoing', 'completed', 'ended')),
  registration_locked BOOLEAN DEFAULT FALSE,
  max_participants INTEGER DEFAULT 100,
  starts_at TIMESTAMPTZ,
  map TEXT NOT NULL DEFAULT 'BERMUDA',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Match participants (users who joined a match)
CREATE TABLE public.match_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  in_game_name TEXT NOT NULL,
  in_game_uid TEXT NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(match_id, user_id)
);

-- Coin transactions (for audit trail)
CREATE TABLE public.coin_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('admin_add', 'match_entry', 'refund')),
  reference_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_modes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can read all users" ON public.users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
  );
CREATE POLICY "Admins can update all users" ON public.users
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can read admins" ON public.admins
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid())
  );

CREATE POLICY "Anyone can read games" ON public.games
  FOR SELECT USING (true);
CREATE POLICY "Admins can manage games" ON public.games
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
  );

CREATE POLICY "Anyone can read game modes" ON public.game_modes
  FOR SELECT USING (true);
CREATE POLICY "Admins can manage game modes" ON public.game_modes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
  );

CREATE POLICY "Anyone can read matches" ON public.matches
  FOR SELECT USING (true);
CREATE POLICY "Admins can manage matches" ON public.matches
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can read match participants" ON public.match_participants
  FOR SELECT USING (true);
CREATE POLICY "Users can insert own participation" ON public.match_participants
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own transactions" ON public.coin_transactions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage transactions" ON public.coin_transactions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
  );

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Storage bucket for game/mode images
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'images') THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('images', 'images', true);
  END IF;
END $$;

DROP POLICY IF EXISTS "Public read for images" ON storage.objects;
CREATE POLICY "Public read for images" ON storage.objects
  FOR SELECT USING (bucket_id = 'images');
CREATE POLICY "Admins can upload images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'images' AND
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
  );
CREATE POLICY "Admins can update images" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'images' AND
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
  );
CREATE POLICY "Admins can delete images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'images' AND
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
  );

-- =============================================================================
-- 002: Admin Permissions
-- =============================================================================

ALTER TABLE public.admins
  ADD COLUMN IF NOT EXISTS is_master_admin BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS users_access BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS coins_access BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS games_access_type TEXT NOT NULL DEFAULT 'all' CHECK (games_access_type IN ('all', 'specific'));

CREATE TABLE IF NOT EXISTS public.admin_allowed_games (
  admin_id UUID NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  PRIMARY KEY (admin_id, game_id)
);

ALTER TABLE public.admin_allowed_games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master admins can manage admin_allowed_games" ON public.admin_allowed_games
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid() AND is_master_admin = TRUE)
  );
CREATE POLICY "Admins can read own allowed games" ON public.admin_allowed_games
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admins a
      WHERE a.user_id = auth.uid()
      AND (a.id = admin_allowed_games.admin_id OR a.is_master_admin = TRUE)
    )
  );

DROP POLICY IF EXISTS "Admins can read admins" ON public.admins;
CREATE POLICY "Master admins can read all admins" ON public.admins
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid() AND is_master_admin = TRUE)
  );
CREATE POLICY "Admins can read own admin row" ON public.admins
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Master admins can insert admins" ON public.admins
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid() AND is_master_admin = TRUE)
  );
CREATE POLICY "Master admins can update admins" ON public.admins
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid() AND is_master_admin = TRUE)
  );
CREATE POLICY "Master admins can delete admins" ON public.admins
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid() AND is_master_admin = TRUE)
  );

DROP POLICY IF EXISTS "Admins can read all users" ON public.users;
DROP POLICY IF EXISTS "Admins can update all users" ON public.users;
CREATE POLICY "Admins with users_access can read all users" ON public.users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid() AND users_access = TRUE)
  );
CREATE POLICY "Admins with users_access can update all users" ON public.users
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid() AND users_access = TRUE)
  );

DROP POLICY IF EXISTS "Admins can manage games" ON public.games;
CREATE POLICY "Admins can manage games" ON public.games
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admins a
      WHERE a.user_id = auth.uid()
      AND (
        a.is_master_admin = TRUE
        OR a.games_access_type = 'all'
        OR EXISTS (SELECT 1 FROM public.admin_allowed_games ag WHERE ag.admin_id = a.id AND ag.game_id = games.id)
      )
    )
  );

DROP POLICY IF EXISTS "Admins can manage game_modes" ON public.game_modes;
CREATE POLICY "Admins can manage game_modes" ON public.game_modes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admins a
      WHERE a.user_id = auth.uid()
      AND (
        a.is_master_admin = TRUE
        OR a.games_access_type = 'all'
        OR EXISTS (SELECT 1 FROM public.admin_allowed_games ag WHERE ag.admin_id = a.id AND ag.game_id = game_modes.game_id)
      )
    )
  );

DROP POLICY IF EXISTS "Admins can manage matches" ON public.matches;
CREATE POLICY "Admins can manage matches" ON public.matches
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admins a
      JOIN public.game_modes gm ON gm.id = matches.game_mode_id
      WHERE a.user_id = auth.uid()
      AND (
        a.is_master_admin = TRUE
        OR a.games_access_type = 'all'
        OR EXISTS (SELECT 1 FROM public.admin_allowed_games ag WHERE ag.admin_id = a.id AND ag.game_id = gm.game_id)
      )
    )
  );

DROP POLICY IF EXISTS "Admins can manage transactions" ON public.coin_transactions;
CREATE POLICY "Admins with coins_access can manage transactions" ON public.coin_transactions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid() AND coins_access = TRUE)
  );

DROP POLICY IF EXISTS "Admins can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete images" ON storage.objects;
CREATE POLICY "Admins can upload images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'images' AND
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
  );
CREATE POLICY "Admins can update images" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'images' AND
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
  );
CREATE POLICY "Admins can delete images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'images' AND
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
  );

-- =============================================================================
-- 003: Admin adminname credentials (adminname/password_hash already in 001; skip if exists)
-- =============================================================================

-- Make user_id nullable for adminname-only auth (no-op if already nullable)
DO $$ BEGIN
  ALTER TABLE public.admins ALTER COLUMN user_id DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- =============================================================================
-- 004: Coin transactions indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_coin_transactions_user_id_created_at
  ON public.coin_transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_created_at
  ON public.coin_transactions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_type
  ON public.coin_transactions (type);

-- =============================================================================
-- 005: Match type and team members
-- =============================================================================

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS match_type TEXT NOT NULL DEFAULT 'solo'
  CHECK (match_type IN ('solo', 'duo', 'squad'));

ALTER TABLE public.match_participants
  ADD COLUMN IF NOT EXISTS participant_2_name TEXT,
  ADD COLUMN IF NOT EXISTS participant_2_uid TEXT,
  ADD COLUMN IF NOT EXISTS participant_3_name TEXT,
  ADD COLUMN IF NOT EXISTS participant_3_uid TEXT,
  ADD COLUMN IF NOT EXISTS participant_4_name TEXT,
  ADD COLUMN IF NOT EXISTS participant_4_uid TEXT;

-- =============================================================================
-- 006: Prize pool and results
-- =============================================================================

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS coins_per_kill INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS rank_rewards JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.match_participants
  ADD COLUMN IF NOT EXISTS squad_rank INTEGER,
  ADD COLUMN IF NOT EXISTS coins_won INTEGER,
  ADD COLUMN IF NOT EXISTS kills INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS participant_2_kills INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS participant_3_kills INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS participant_4_kills INTEGER DEFAULT 0;

-- =============================================================================
-- 007: Deposits and app updates
-- =============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE;

ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_status_check;
ALTER TABLE public.matches ADD CONSTRAINT matches_status_check
  CHECK (status IN ('upcoming', 'ongoing', 'completed', 'ended', 'cancelled'));

ALTER TABLE public.coin_transactions DROP CONSTRAINT IF EXISTS coin_transactions_type_check;
ALTER TABLE public.coin_transactions ADD CONSTRAINT coin_transactions_type_check
  CHECK (type IN ('admin_add', 'match_entry', 'refund', 'deposit', 'deposit_failed'));

ALTER TABLE public.coin_transactions
  ADD COLUMN IF NOT EXISTS reference_text TEXT;

CREATE TABLE IF NOT EXISTS public.deposit_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  utr TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deposit_requests_status ON public.deposit_requests (status);
CREATE INDEX IF NOT EXISTS idx_deposit_requests_user_id ON public.deposit_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_deposit_requests_created_at ON public.deposit_requests (created_at DESC);

ALTER TABLE public.deposit_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins with coins_access can read deposit_requests" ON public.deposit_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid() AND coins_access = TRUE)
  );
CREATE POLICY "Admins with coins_access can update deposit_requests" ON public.deposit_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid() AND coins_access = TRUE)
  );
CREATE POLICY "Users can insert own deposit request" ON public.deposit_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read app_settings" ON public.app_settings
  FOR SELECT USING (true);
CREATE POLICY "Admins with coins_access can manage app_settings" ON public.app_settings
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid() AND coins_access = TRUE)
  );
CREATE POLICY "Admins with coins_access can update app_settings" ON public.app_settings
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid() AND coins_access = TRUE)
  );
CREATE POLICY "Admins with coins_access can delete app_settings" ON public.app_settings
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid() AND coins_access = TRUE)
  );

-- =============================================================================
-- 008: Withdrawals, signup bonus
-- =============================================================================

ALTER TABLE public.coin_transactions DROP CONSTRAINT IF EXISTS coin_transactions_type_check;
ALTER TABLE public.coin_transactions ADD CONSTRAINT coin_transactions_type_check
  CHECK (type IN (
    'admin_add', 'match_entry', 'refund', 'deposit', 'deposit_failed',
    'withdraw', 'withdraw_failed', 'signup_bonus'
  ));

CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  upi_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  charge_percent NUMERIC(5,2) DEFAULT 0 CHECK (charge_percent >= 0 AND charge_percent <= 100),
  reject_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON public.withdrawal_requests (status);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_id ON public.withdrawal_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_created_at ON public.withdrawal_requests (created_at DESC);

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins with coins_access can read withdrawal_requests" ON public.withdrawal_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid() AND coins_access = TRUE)
  );
CREATE POLICY "Admins with coins_access can update withdrawal_requests" ON public.withdrawal_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid() AND coins_access = TRUE)
  );
CREATE POLICY "Users can insert own withdrawal request" ON public.withdrawal_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read own withdrawal requests" ON public.withdrawal_requests
  FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS user_number TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_users_user_number ON public.users (user_number);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (LOWER(email));

CREATE OR REPLACE FUNCTION public.generate_user_number()
RETURNS TEXT AS $$
DECLARE
  new_num TEXT;
  exists_check BOOLEAN;
BEGIN
  LOOP
    new_num := LPAD(FLOOR(10000 + RANDOM() * 90000)::TEXT, 5, '0');
    SELECT EXISTS(SELECT 1 FROM public.users WHERE user_number = new_num) INTO exists_check;
    EXIT WHEN NOT exists_check;
  END LOOP;
  RETURN new_num;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  bonus INTEGER := 0;
BEGIN
  SELECT COALESCE((SELECT value::INTEGER FROM public.app_settings WHERE key = 'signup_bonus' LIMIT 1), 0) INTO bonus;

  INSERT INTO public.users (id, email, display_name, user_number, coins)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(SPLIT_PART(NEW.email, '@', 1), 'User'),
    public.generate_user_number(),
    GREATEST(0, bonus)
  );

  IF bonus > 0 THEN
    INSERT INTO public.coin_transactions (user_id, amount, type, description)
    VALUES (NEW.id, bonus, 'signup_bonus', 'Signup bonus');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 009: App users (custom auth flow)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.app_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT 'User',
  coins INTEGER NOT NULL DEFAULT 0,
  is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_users_email_lower ON public.app_users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_app_users_created_at ON public.app_users (created_at DESC);

CREATE TABLE IF NOT EXISTS public.app_coin_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'admin_add', 'match_entry', 'refund', 'deposit', 'deposit_failed',
    'withdraw', 'withdraw_failed', 'signup_bonus', 'match_winning'
  )),
  reference_id TEXT,
  reference_text TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_coin_transactions_user_id ON public.app_coin_transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_app_coin_transactions_created_at ON public.app_coin_transactions (created_at DESC);

CREATE TABLE IF NOT EXISTS public.app_deposit_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  utr TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_deposit_requests_status ON public.app_deposit_requests (status);
CREATE INDEX IF NOT EXISTS idx_app_deposit_requests_user_id ON public.app_deposit_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_app_deposit_requests_created_at ON public.app_deposit_requests (created_at DESC);

CREATE TABLE IF NOT EXISTS public.app_withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  upi_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  charge_percent NUMERIC(5,2) DEFAULT 0 CHECK (charge_percent >= 0 AND charge_percent <= 100),
  reject_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_withdrawal_requests_status ON public.app_withdrawal_requests (status);
CREATE INDEX IF NOT EXISTS idx_app_withdrawal_requests_user_id ON public.app_withdrawal_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_app_withdrawal_requests_created_at ON public.app_withdrawal_requests (created_at DESC);

CREATE OR REPLACE FUNCTION public.generate_app_user_id()
RETURNS TEXT AS $$
DECLARE
  new_id TEXT;
  exists_check BOOLEAN;
BEGIN
  LOOP
    new_id := LPAD(FLOOR(10000 + RANDOM() * 90000)::TEXT, 5, '0');
    SELECT EXISTS(SELECT 1 FROM public.app_users WHERE id = new_id) INTO exists_check;
    EXIT WHEN NOT exists_check;
  END LOOP;
  RETURN new_id;
END;
$$ LANGUAGE plpgsql;

INSERT INTO public.app_settings (key, value, updated_at)
VALUES
  ('signup_bonus', '0', NOW()),
  ('withdrawal_charge', '0', NOW()),
  ('deposit_qr_url', '', NOW()),
  ('customer_support_url', '', NOW())
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.admins (adminname, password_hash, is_master_admin, users_access, coins_access, games_access_type)
SELECT 'masteradmin', '$2b$10$FBJKxjXVVYsKXA9ChWsIfuW.3MTWBjsySWzrjgsaBFvj1m0.xtdbO', TRUE, TRUE, TRUE, 'all'
WHERE NOT EXISTS (SELECT 1 FROM public.admins LIMIT 1);

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_coin_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_deposit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access app_users" ON public.app_users
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access app_coin_transactions" ON public.app_coin_transactions
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access app_deposit_requests" ON public.app_deposit_requests
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access app_withdrawal_requests" ON public.app_withdrawal_requests
  FOR ALL USING (auth.role() = 'service_role');

-- =============================================================================
-- 010: Total prize pool
-- =============================================================================

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS total_prize_pool INTEGER DEFAULT 0;

-- Run in Supabase SQL Editor if uploads still fail
DROP POLICY IF EXISTS "Service role can manage images" ON storage.objects;
CREATE POLICY "Service role can manage images"
ON storage.objects FOR ALL
USING (auth.role() = 'service_role');

ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS fcm_token TEXT;

CREATE INDEX IF NOT EXISTS idx_app_users_fcm_token ON public.app_users (fcm_token) WHERE fcm_token IS NOT NULL;

-- =============================================================================
-- 011: App match participants (for app_users joining matches)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.app_match_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  app_user_id TEXT NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  in_game_name TEXT NOT NULL,
  in_game_uid TEXT NOT NULL,
  participant_2_name TEXT,
  participant_2_uid TEXT,
  participant_3_name TEXT,
  participant_3_uid TEXT,
  participant_4_name TEXT,
  participant_4_uid TEXT,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(match_id, app_user_id)
);

CREATE INDEX IF NOT EXISTS idx_app_match_participants_match ON public.app_match_participants (match_id);
CREATE INDEX IF NOT EXISTS idx_app_match_participants_user ON public.app_match_participants (app_user_id);

ALTER TABLE public.app_match_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access app_match_participants" ON public.app_match_participants
  FOR ALL USING (auth.role() = 'service_role');

-- Add kills and squad_rank for admin to update during ongoing matches
ALTER TABLE public.app_match_participants
  ADD COLUMN IF NOT EXISTS kills INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS squad_rank INTEGER;

-- =============================================================================
-- 012: App users password (for email+password auth)
-- =============================================================================

ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- =============================================================================
-- 013: App users lifetime earned points
-- =============================================================================

ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS lifetime_earned_points INTEGER NOT NULL DEFAULT 0;

-- =============================================================================
-- 014: App users and users matches played and total kills
-- =============================================================================

ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS matches_played INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_kills INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS matches_played INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_kills INTEGER NOT NULL DEFAULT 0;

-- =============================================================================
-- 015: Matches Map Column
-- =============================================================================

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS map TEXT NOT NULL DEFAULT 'BERMUDA';

-- =============================================================================
-- 016: App Users Google Auth Support
-- =============================================================================

ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- =============================================================================
-- 017: App Banners Multi-Banner System Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.app_banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url TEXT NOT NULL,
  link_url TEXT NOT NULL,
  display_play_carousel BOOLEAN DEFAULT false,
  display_earn BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.app_banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read app_banners" ON public.app_banners
  FOR SELECT USING (true);
CREATE POLICY "Admins with coins_access can manage app_banners" ON public.app_banners
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid() AND coins_access = TRUE)
  );

-- =============================================================================
-- 018: Referral System Integration
-- =============================================================================

-- Add username column to users & app_users tables
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- Create default usernames for existing mock users to prevent unique constraint failures
UPDATE public.app_users SET username = 'user_' || id WHERE username IS NULL;

-- Create app_referrals table
CREATE TABLE IF NOT EXISTS public.app_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id TEXT NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  referred_id TEXT NOT NULL UNIQUE REFERENCES public.app_users(id) ON DELETE CASCADE,
  reward_coins INTEGER NOT NULL DEFAULT 0,
  reward_granted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for app_referrals
ALTER TABLE public.app_referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access app_referrals" ON public.app_referrals
  FOR ALL USING (auth.role() = 'service_role');

-- Seed new referral system keys in app_settings
INSERT INTO public.app_settings (key, value, updated_at)
VALUES
  ('referral_system_enabled', 'false', NOW()),
  ('referral_reward_coins', '10', NOW()),
  ('referral_banner_url', '', NOW())
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- 019: Separate Wallets (Won Coins) and Username Primary Key
-- =============================================================================

-- 1. Drop existing foreign key constraints pointing to app_users(id)
ALTER TABLE public.app_coin_transactions DROP CONSTRAINT IF EXISTS app_coin_transactions_user_id_fkey;
ALTER TABLE public.app_deposit_requests DROP CONSTRAINT IF EXISTS app_deposit_requests_user_id_fkey;
ALTER TABLE public.app_withdrawal_requests DROP CONSTRAINT IF EXISTS app_withdrawal_requests_user_id_fkey;
ALTER TABLE public.app_match_participants DROP CONSTRAINT IF EXISTS app_match_participants_app_user_id_fkey;
ALTER TABLE public.app_referrals DROP CONSTRAINT IF EXISTS app_referrals_referrer_id_fkey;
ALTER TABLE public.app_referrals DROP CONSTRAINT IF EXISTS app_referrals_referred_id_fkey;

-- 2. Ensure all app_users have a username (generate if null)
UPDATE public.app_users SET username = 'user_' || id WHERE username IS NULL;

-- 3. Update all referencing tables: migrate foreign keys from old 'id' value to the 'username' value
UPDATE public.app_coin_transactions t
SET user_id = u.username
FROM public.app_users u
WHERE t.user_id = u.id;

UPDATE public.app_deposit_requests r
SET user_id = u.username
FROM public.app_users u
WHERE r.user_id = u.id;

UPDATE public.app_withdrawal_requests w
SET user_id = u.username
FROM public.app_users u
WHERE w.user_id = u.id;

UPDATE public.app_match_participants p
SET app_user_id = u.username
FROM public.app_users u
WHERE p.app_user_id = u.id;

UPDATE public.app_referrals r
SET referrer_id = u.username
FROM public.app_users u
WHERE r.referrer_id = u.id;

UPDATE public.app_referrals r
SET referred_id = u.username
FROM public.app_users u
WHERE r.referred_id = u.id;

-- 4. Modify app_users: drop old id PK, make username PK, add won_coins, drop id
ALTER TABLE public.app_users DROP CONSTRAINT IF EXISTS app_users_pkey;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS won_coins INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.app_users ALTER COLUMN username SET NOT NULL;
ALTER TABLE public.app_users ADD CONSTRAINT app_users_pkey PRIMARY KEY (username);
ALTER TABLE public.app_users DROP COLUMN IF EXISTS id;

-- 5. Re-add foreign key constraints pointing to app_users(username)
ALTER TABLE public.app_coin_transactions
  ADD CONSTRAINT app_coin_transactions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.app_users(username) ON DELETE CASCADE;

ALTER TABLE public.app_deposit_requests
  ADD CONSTRAINT app_deposit_requests_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.app_users(username) ON DELETE CASCADE;

ALTER TABLE public.app_withdrawal_requests
  ADD CONSTRAINT app_withdrawal_requests_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.app_users(username) ON DELETE CASCADE;

ALTER TABLE public.app_match_participants
  ADD CONSTRAINT app_match_participants_app_user_id_fkey
  FOREIGN KEY (app_user_id) REFERENCES public.app_users(username) ON DELETE CASCADE;

ALTER TABLE public.app_referrals
  ADD CONSTRAINT app_referrals_referrer_id_fkey
  FOREIGN KEY (referrer_id) REFERENCES public.app_users(username) ON DELETE CASCADE;

ALTER TABLE public.app_referrals
  ADD CONSTRAINT app_referrals_referred_id_fkey
  FOREIGN KEY (referred_id) REFERENCES public.app_users(username) ON DELETE CASCADE;

-- =============================================================================
-- 020: King Battle — Production schema (migration_production_schema.sql)
-- =============================================================================

ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS image TEXT;

ALTER TABLE public.app_banners ALTER COLUMN link_url DROP NOT NULL;

-- Server-side admin uses service role; disable RLS on admin-controlled catalog tables
ALTER TABLE public.games DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_modes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_banners DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings DISABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 021: Match presets (migration_match_presets.sql)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.match_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_mode_id UUID NOT NULL REFERENCES public.game_modes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  entry_fee INTEGER NOT NULL DEFAULT 0,
  max_participants INTEGER NOT NULL DEFAULT 16,
  match_type TEXT NOT NULL DEFAULT 'solo',
  map TEXT NOT NULL DEFAULT 'BERMUDA',
  coins_per_kill INTEGER NOT NULL DEFAULT 5,
  total_prize_pool INTEGER NOT NULL DEFAULT 0,
  rank_rewards JSONB NOT NULL DEFAULT '[]'::jsonb,
  image TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_match_presets_game_mode_id ON public.match_presets(game_mode_id);

ALTER TABLE public.match_presets DISABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 022: Match slot bookings (migration_match_slots.sql)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.match_slot_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  slot_index SMALLINT NOT NULL CHECK (slot_index > 0),
  app_user_id TEXT NOT NULL REFERENCES public.app_users(username) ON DELETE CASCADE,
  in_game_name TEXT,
  in_game_uid TEXT,
  kills SMALLINT NOT NULL DEFAULT 0,
  squad_rank SMALLINT,
  status TEXT NOT NULL DEFAULT 'held' CHECK (status IN ('held', 'confirmed')),
  hold_id UUID,
  hold_expires_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_match_slot_index UNIQUE (match_id, slot_index)
);

CREATE INDEX IF NOT EXISTS idx_match_slot_bookings_match
  ON public.match_slot_bookings (match_id);

CREATE INDEX IF NOT EXISTS idx_match_slot_bookings_user
  ON public.match_slot_bookings (match_id, app_user_id);

CREATE INDEX IF NOT EXISTS idx_match_slot_bookings_hold_expiry
  ON public.match_slot_bookings (hold_expires_at)
  WHERE status = 'held';

ALTER TABLE public.match_slot_bookings DISABLE ROW LEVEL SECURITY;

CREATE OR REPLACE VIEW public.v_match_participant_counts AS
SELECT
  m.id AS match_id,
  COALESCE(
    NULLIF(
      (
        SELECT COUNT(*)::INTEGER
        FROM public.match_slot_bookings b
        WHERE b.match_id = m.id AND b.status = 'confirmed'
      ),
      0
    ),
    (
      SELECT COUNT(*)::INTEGER
      FROM public.app_match_participants p
      WHERE p.match_id = m.id
    ),
    0
  ) AS participant_count
FROM public.matches m;

CREATE OR REPLACE FUNCTION public.cleanup_expired_slot_holds(p_match_id UUID DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.match_slot_bookings
  WHERE status = 'held'
    AND hold_expires_at IS NOT NULL
    AND hold_expires_at < now()
    AND (p_match_id IS NULL OR match_id = p_match_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.hold_match_slots(
  p_match_id UUID,
  p_app_user_id TEXT,
  p_slot_indices SMALLINT[],
  p_hold_seconds INT DEFAULT 300
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_hold_id UUID := gen_random_uuid();
  v_match RECORD;
  v_slot SMALLINT;
  v_existing INT;
BEGIN
  PERFORM public.cleanup_expired_slot_holds(p_match_id);

  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found';
  END IF;
  IF v_match.status <> 'upcoming' THEN
    RAISE EXCEPTION 'Registration closed';
  END IF;
  IF COALESCE(v_match.registration_locked, false) THEN
    RAISE EXCEPTION 'Registration locked';
  END IF;

  IF p_slot_indices IS NULL OR array_length(p_slot_indices, 1) IS NULL THEN
    RAISE EXCEPTION 'No slots selected';
  END IF;

  FOREACH v_slot IN ARRAY p_slot_indices LOOP
    IF v_slot < 1 OR v_slot > COALESCE(v_match.max_participants, 100) THEN
      RAISE EXCEPTION 'Invalid slot index';
    END IF;

    SELECT COUNT(*) INTO v_existing
    FROM public.match_slot_bookings
    WHERE match_id = p_match_id
      AND slot_index = v_slot
      AND status IN ('held', 'confirmed');

    IF v_existing > 0 THEN
      RAISE EXCEPTION 'Slot % is unavailable', v_slot;
    END IF;
  END LOOP;

  DELETE FROM public.match_slot_bookings
  WHERE match_id = p_match_id
    AND app_user_id = p_app_user_id
    AND status = 'held';

  FOREACH v_slot IN ARRAY p_slot_indices LOOP
    INSERT INTO public.match_slot_bookings (
      match_id, slot_index, app_user_id, status, hold_id, hold_expires_at
    ) VALUES (
      p_match_id, v_slot, p_app_user_id, 'held', v_hold_id,
      now() + make_interval(secs => p_hold_seconds)
    );
  END LOOP;

  RETURN v_hold_id;
END;
$$;

-- =============================================================================
-- 023: Match numbers & transaction IDs (migration_match_number_and_tx_ids.sql)
-- =============================================================================

ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS match_number INTEGER UNIQUE;

DROP SEQUENCE IF EXISTS public.match_number_seq;
CREATE SEQUENCE public.match_number_seq
  AS integer
  START WITH 0
  INCREMENT BY 1
  MINVALUE 0
  NO MAXVALUE
  CACHE 1;

WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC NULLS LAST, id ASC) - 1 AS num
  FROM public.matches
  WHERE match_number IS NULL
)
UPDATE public.matches m
SET match_number = numbered.num
FROM numbered
WHERE m.id = numbered.id;

SELECT setval(
  'public.match_number_seq',
  GREATEST(COALESCE((SELECT MAX(match_number) FROM public.matches), -1) + 1, 0),
  false
);

ALTER TABLE public.app_coin_transactions ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.app_coin_transactions ALTER COLUMN id TYPE TEXT USING id::text;

-- =============================================================================
-- 024: Admin tab access & block reason
-- (migration_admin_tab_access.sql, migration_user_block_reason.sql)
-- =============================================================================

ALTER TABLE public.admins
  ADD COLUMN IF NOT EXISTS tab_access JSONB DEFAULT NULL;

ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS block_reason TEXT;

-- =============================================================================
-- 025: Dashboard analytics (migration_dashboard_analytics.sql)
-- =============================================================================

CREATE OR REPLACE VIEW public.admin_dashboard_user_analytics AS
SELECT
  COUNT(*)::INTEGER AS total_users,
  COUNT(*) FILTER (WHERE COALESCE(is_blocked, false) = true)::INTEGER AS blocked_users,
  COUNT(*) FILTER (WHERE fcm_token IS NOT NULL AND TRIM(fcm_token) <> '')::INTEGER AS push_enabled_users,
  COUNT(*) FILTER (WHERE COALESCE(matches_played, 0) > 0)::INTEGER AS active_players,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 day')::INTEGER AS new_users_today,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::INTEGER AS new_users_7d,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::INTEGER AS new_users_30d,
  COALESCE(SUM(COALESCE(coins, 0)), 0)::BIGINT AS wallet_coins,
  COALESCE(SUM(COALESCE(won_coins, 0)), 0)::BIGINT AS withdrawable_winnings
FROM public.app_users;

CREATE OR REPLACE VIEW public.admin_dashboard_money_analytics AS
SELECT
  COALESCE((
    SELECT SUM(amount) FROM public.app_deposit_requests WHERE status = 'accepted'
  ), 0)::BIGINT AS total_deposits,
  COALESCE((
    SELECT SUM(amount) FROM public.app_withdrawal_requests WHERE status = 'accepted'
  ), 0)::BIGINT AS total_withdrawals,
  COALESCE((
    SELECT COUNT(*)::INTEGER FROM public.app_deposit_requests WHERE status = 'pending'
  ), 0)::INTEGER AS pending_deposits_count,
  COALESCE((
    SELECT SUM(amount) FROM public.app_deposit_requests WHERE status = 'pending'
  ), 0)::BIGINT AS pending_deposits_amount,
  COALESCE((
    SELECT COUNT(*)::INTEGER FROM public.app_withdrawal_requests WHERE status = 'pending'
  ), 0)::INTEGER AS pending_withdrawals_count,
  COALESCE((
    SELECT SUM(amount) FROM public.app_withdrawal_requests WHERE status = 'pending'
  ), 0)::BIGINT AS pending_withdrawals_amount,
  COALESCE((
    SELECT SUM(amount) FROM public.app_deposit_requests
    WHERE status = 'accepted' AND created_at >= NOW() - INTERVAL '1 day'
  ), 0)::BIGINT AS deposits_today,
  COALESCE((
    SELECT SUM(amount) FROM public.app_deposit_requests
    WHERE status = 'accepted' AND created_at >= NOW() - INTERVAL '7 days'
  ), 0)::BIGINT AS deposits_7d;

CREATE OR REPLACE VIEW public.admin_dashboard_match_analytics AS
SELECT
  COUNT(*) FILTER (WHERE status = 'upcoming')::INTEGER AS upcoming_count,
  COUNT(*) FILTER (WHERE status = 'ongoing')::INTEGER AS ongoing_count,
  COUNT(*) FILTER (WHERE status IN ('completed', 'ended'))::INTEGER AS completed_count,
  COUNT(*) FILTER (
    WHERE status IN ('completed', 'ended')
      AND starts_at IS NOT NULL
      AND starts_at >= NOW() - INTERVAL '7 days'
  )::INTEGER AS completed_7d,
  COUNT(*) FILTER (WHERE COALESCE(match_type, 'solo') = 'solo')::INTEGER AS solo_count,
  COUNT(*) FILTER (WHERE match_type = 'duo')::INTEGER AS duo_count,
  COUNT(*) FILTER (WHERE match_type = 'squad')::INTEGER AS squad_count,
  COALESCE((
    SELECT ROUND(AVG(
      CASE
        WHEN m.max_participants > 0
        THEN COALESCE(pc.participant_count, 0)::NUMERIC / m.max_participants
        ELSE 0
      END
    ), 4)
    FROM public.matches m
    LEFT JOIN public.v_match_participant_counts pc ON pc.match_id = m.id
    WHERE m.status = 'upcoming' AND m.status <> 'cancelled'
  ), 0)::NUMERIC AS avg_upcoming_fill_rate,
  COALESCE((
    SELECT SUM(m.entry_fee * COALESCE(pc.participant_count, 0))
    FROM public.matches m
    LEFT JOIN public.v_match_participant_counts pc ON pc.match_id = m.id
    WHERE m.status IN ('upcoming', 'ongoing') AND m.status <> 'cancelled'
  ), 0)::BIGINT AS entry_fees_collected
FROM public.matches
WHERE status <> 'cancelled';

CREATE OR REPLACE VIEW public.admin_dashboard_upcoming_matches AS
SELECT
  m.id,
  m.title,
  m.starts_at AS scheduled_at,
  m.max_participants,
  m.entry_fee,
  COALESCE(m.match_type, 'solo') AS match_type,
  COALESCE(pc.participant_count, 0)::INTEGER AS participant_count,
  CASE
    WHEN COALESCE(m.max_participants, 0) > 0
    THEN ROUND(COALESCE(pc.participant_count, 0)::NUMERIC / m.max_participants, 4)
    ELSE 0
  END AS fill_rate
FROM public.matches m
LEFT JOIN public.v_match_participant_counts pc ON pc.match_id = m.id
WHERE m.status = 'upcoming'
ORDER BY m.starts_at ASC NULLS LAST
LIMIT 10;

CREATE OR REPLACE VIEW public.admin_dashboard_pending_withdrawals AS
SELECT
  w.id,
  w.user_id,
  w.amount,
  w.upi_id,
  w.created_at,
  COALESCE(u.display_name, w.user_id) AS user_display_name,
  COALESCE(u.email, '') AS user_email
FROM public.app_withdrawal_requests w
LEFT JOIN public.app_users u ON u.username = w.user_id
WHERE w.status = 'pending'
ORDER BY w.created_at ASC
LIMIT 10;

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'generatedAt', NOW(),
    'users', (
      SELECT jsonb_build_object(
        'total', total_users,
        'blocked', blocked_users,
        'pushEnabled', push_enabled_users,
        'activePlayers', active_players,
        'newToday', new_users_today,
        'new7d', new_users_7d,
        'new30d', new_users_30d,
        'walletCoins', wallet_coins,
        'withdrawableWinnings', withdrawable_winnings
      )
      FROM public.admin_dashboard_user_analytics
    ),
    'money', (
      SELECT jsonb_build_object(
        'totalDeposits', total_deposits,
        'totalWithdrawals', total_withdrawals,
        'netFlow', total_deposits - total_withdrawals,
        'pendingDepositsCount', pending_deposits_count,
        'pendingDepositsAmount', pending_deposits_amount,
        'pendingWithdrawalsCount', pending_withdrawals_count,
        'pendingWithdrawalsAmount', pending_withdrawals_amount,
        'depositsToday', deposits_today,
        'deposits7d', deposits_7d
      )
      FROM public.admin_dashboard_money_analytics
    ),
    'matches', (
      SELECT jsonb_build_object(
        'upcoming', upcoming_count,
        'ongoing', ongoing_count,
        'completed', completed_count,
        'completed7d', completed_7d,
        'solo', solo_count,
        'duo', duo_count,
        'squad', squad_count,
        'avgUpcomingFillRate', avg_upcoming_fill_rate,
        'entryFeesCollected', entry_fees_collected
      )
      FROM public.admin_dashboard_match_analytics
    ),
    'upcomingMatches', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', id,
          'title', title,
          'scheduledAt', scheduled_at,
          'maxParticipants', max_participants,
          'entryFee', entry_fee,
          'matchType', match_type,
          'participantCount', participant_count,
          'fillRate', fill_rate
        )
        ORDER BY scheduled_at ASC NULLS LAST
      )
      FROM (
        SELECT * FROM public.admin_dashboard_upcoming_matches LIMIT 3
      ) u
    ), '[]'::jsonb),
    'pendingWithdrawals', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', id,
          'userId', user_id,
          'amount', amount,
          'upiId', upi_id,
          'createdAt', created_at,
          'userDisplayName', user_display_name,
          'userEmail', user_email
        )
        ORDER BY created_at ASC
      )
      FROM (
        SELECT * FROM public.admin_dashboard_pending_withdrawals LIMIT 5
      ) p
      ), '[]'::jsonb)
  );
$$;

-- =============================================================================
-- 026: King Battle app_settings defaults
-- =============================================================================

INSERT INTO public.app_settings (key, value, updated_at)
VALUES
  ('minimum_deposit', '0', NOW()),
  ('minimum_withdrawal', '0', NOW()),
  ('storage_purge_cursor', '', NOW()),
  ('announcement_text', '', NOW()),
  ('banner_image_url', '', NOW())
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- 027: Match scoring modes (migration_scoring_mode.sql)
-- =============================================================================

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS scoring_mode TEXT NOT NULL DEFAULT 'kills_only'
  CHECK (scoring_mode IN ('kills_only', 'rank_only', 'rank_kills', 'manual'));

ALTER TABLE public.match_presets
  ADD COLUMN IF NOT EXISTS scoring_mode TEXT NOT NULL DEFAULT 'kills_only'
  CHECK (scoring_mode IN ('kills_only', 'rank_only', 'rank_kills', 'manual'));

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS manual_entry_options JSONB DEFAULT NULL;

ALTER TABLE public.match_presets
  ADD COLUMN IF NOT EXISTS manual_entry_options JSONB DEFAULT NULL;
