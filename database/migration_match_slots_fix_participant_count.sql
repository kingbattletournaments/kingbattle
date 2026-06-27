-- Fix participant counts after slots migration (legacy joins were ignored).
-- Run in Supabase SQL Editor if you already applied migration_match_slots.sql.

CREATE OR REPLACE VIEW public.v_match_participant_counts AS
SELECT
  m.id AS match_id,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM public.match_slot_bookings b WHERE b.match_id = m.id
    ) THEN (
      SELECT COUNT(*)::INTEGER
      FROM public.match_slot_bookings b
      WHERE b.match_id = m.id AND b.status = 'confirmed'
    )
    ELSE (
      SELECT COUNT(*)::INTEGER
      FROM public.app_match_participants p
      WHERE p.match_id = m.id
    )
  END AS participant_count
FROM public.matches m;
