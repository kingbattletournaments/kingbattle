-- Ban reason shown to blocked players in the app account tab.
ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS block_reason TEXT;
