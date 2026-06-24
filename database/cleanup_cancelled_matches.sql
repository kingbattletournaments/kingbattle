-- One-time cleanup: remove matches that were cancelled before delete-on-cancel was implemented.
-- Run in Supabase SQL Editor if old cancelled matches still appear.

DELETE FROM public.app_match_participants
WHERE match_id IN (SELECT id FROM public.matches WHERE status = 'cancelled');

DELETE FROM public.match_participants
WHERE match_id IN (SELECT id FROM public.matches WHERE status = 'cancelled');

DELETE FROM public.matches WHERE status = 'cancelled';
