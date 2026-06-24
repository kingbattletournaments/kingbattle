-- Migration: FCM token storage for push notifications
-- Run in Supabase SQL Editor

ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS fcm_token TEXT;

CREATE INDEX IF NOT EXISTS idx_app_users_fcm_token
  ON public.app_users (fcm_token)
  WHERE fcm_token IS NOT NULL;
