-- Admin dashboard analytics: organized views + single RPC for efficient aggregates.
-- Run in Supabase SQL Editor after migration_production_schema.sql.

-- ---------------------------------------------------------------------------
-- Match participant counts (slot bookings + legacy fallback)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- User metrics (single row)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Money metrics (single row)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Match metrics (single row)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Quick lists for dashboard
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Single RPC: one round-trip for the admin dashboard
-- ---------------------------------------------------------------------------
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
