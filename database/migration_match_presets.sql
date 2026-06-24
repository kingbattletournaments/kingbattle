-- Migration: match_presets table for reusable match templates (no date/time)
-- Run in Supabase SQL Editor

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
