-- Match scoring modes: kills_only, rank_only, rank_kills, manual
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

-- Backfill from existing prize pool configuration
UPDATE public.matches
SET scoring_mode = CASE
  WHEN COALESCE(coins_per_kill, 0) > 0 AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(rank_rewards, '[]'::jsonb)) AS r
    WHERE COALESCE((r->>'coins')::int, 0) > 0
  ) THEN 'rank_kills'
  WHEN COALESCE(coins_per_kill, 0) = 0 AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(rank_rewards, '[]'::jsonb)) AS r
    WHERE COALESCE((r->>'coins')::int, 0) > 0
  ) THEN 'rank_only'
  ELSE 'kills_only'
END
WHERE scoring_mode IS NULL OR scoring_mode = 'kills_only';

UPDATE public.match_presets
SET scoring_mode = CASE
  WHEN COALESCE(coins_per_kill, 0) > 0 AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(rank_rewards, '[]'::jsonb)) AS r
    WHERE COALESCE((r->>'coins')::int, 0) > 0
  ) THEN 'rank_kills'
  WHEN COALESCE(coins_per_kill, 0) = 0 AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(rank_rewards, '[]'::jsonb)) AS r
    WHERE COALESCE((r->>'coins')::int, 0) > 0
  ) THEN 'rank_only'
  ELSE 'kills_only'
END
WHERE scoring_mode IS NULL OR scoring_mode = 'kills_only';
