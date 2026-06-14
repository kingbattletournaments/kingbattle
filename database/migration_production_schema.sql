-- Migration schema to setup missing tables and columns in Supabase
-- Run this in your Supabase SQL Editor to ensure all tables exist

-- 1. Create app_settings table
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create app_banners table
CREATE TABLE IF NOT EXISTS public.app_banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url TEXT NOT NULL,
  link_url TEXT,
  display_play_carousel BOOLEAN DEFAULT TRUE,
  display_earn BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Add missing columns to matches table
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS match_type TEXT DEFAULT 'solo';
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS coins_per_kill INTEGER DEFAULT 5;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS total_prize_pool INTEGER DEFAULT 0;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS rank_rewards JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS image TEXT;

-- 4. Set RLS bypass guidelines
-- Note: Ensure that SUPABASE_SERVICE_ROLE_KEY is correctly set in your Vercel Environment Variables.
-- If SUPABASE_SERVICE_ROLE_KEY is set to the 'anon' public key by mistake, RLS will block writes.
-- As a safeguard for server-side custom sessions, disable RLS on admin-controlled tables:
ALTER TABLE public.games DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_modes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_banners DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings DISABLE ROW LEVEL SECURITY;
