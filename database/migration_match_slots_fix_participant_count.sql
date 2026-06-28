-- Fix participant counts after slots migration.
-- Run in Supabase SQL Editor if counts show 0 while players are registered.

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
