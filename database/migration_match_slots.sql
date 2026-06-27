-- Match slot booking system (movie-theater style seat locking).
-- Uses a dedicated table because UNIQUE(match_id, slot_index) is required for
-- concurrent booking safety — a single column on app_match_participants cannot enforce that.

CREATE TABLE IF NOT EXISTS match_slot_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  slot_index SMALLINT NOT NULL CHECK (slot_index > 0),
  app_user_id TEXT NOT NULL REFERENCES app_users(username) ON DELETE CASCADE,
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
  ON match_slot_bookings (match_id);

CREATE INDEX IF NOT EXISTS idx_match_slot_bookings_user
  ON match_slot_bookings (match_id, app_user_id);

CREATE INDEX IF NOT EXISTS idx_match_slot_bookings_hold_expiry
  ON match_slot_bookings (hold_expires_at)
  WHERE status = 'held';

-- Participant count = confirmed player slots (not legacy registration rows)
CREATE OR REPLACE VIEW v_match_participant_counts AS
SELECT
  m.id AS match_id,
  COALESCE(
    (SELECT COUNT(*)::int FROM match_slot_bookings b
     WHERE b.match_id = m.id AND b.status = 'confirmed'),
    0
  ) AS participant_count
FROM matches m;

-- Remove expired holds before any slot operation
CREATE OR REPLACE FUNCTION cleanup_expired_slot_holds(p_match_id UUID DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM match_slot_bookings
  WHERE status = 'held'
    AND hold_expires_at IS NOT NULL
    AND hold_expires_at < now()
    AND (p_match_id IS NULL OR match_id = p_match_id);
END;
$$;

-- Atomically reserve slots (FOR UPDATE on match row prevents double booking)
CREATE OR REPLACE FUNCTION hold_match_slots(
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
  PERFORM cleanup_expired_slot_holds(p_match_id);

  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
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
    FROM match_slot_bookings
    WHERE match_id = p_match_id
      AND slot_index = v_slot
      AND status IN ('held', 'confirmed');

    IF v_existing > 0 THEN
      RAISE EXCEPTION 'Slot % is unavailable', v_slot;
    END IF;
  END LOOP;

  -- Release prior holds by same user on this match
  DELETE FROM match_slot_bookings
  WHERE match_id = p_match_id
    AND app_user_id = p_app_user_id
    AND status = 'held';

  FOREACH v_slot IN ARRAY p_slot_indices LOOP
    INSERT INTO match_slot_bookings (
      match_id, slot_index, app_user_id, status, hold_id, hold_expires_at
    ) VALUES (
      p_match_id, v_slot, p_app_user_id, 'held', v_hold_id,
      now() + make_interval(secs => p_hold_seconds)
    );
  END LOOP;

  RETURN v_hold_id;
END;
$$;
