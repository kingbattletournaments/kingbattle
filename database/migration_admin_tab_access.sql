-- Per-tab admin permissions (JSON object keyed by tab id)
ALTER TABLE admins
  ADD COLUMN IF NOT EXISTS tab_access JSONB DEFAULT NULL;
