-- Migration schema to add a test user
-- Username: testuser
-- Email: test@user.com
-- Password: test123 (hashed using bcrypt with 10 rounds)
-- Balance: 100 coins (withdrawable/won_coins is 0)

INSERT INTO app_users (
  username,
  email,
  display_name,
  password_hash,
  coins,
  won_coins,
  lifetime_earned_points,
  matches_played,
  total_kills,
  is_blocked
)
VALUES (
  'testuser',
  'test@user.com',
  'Test User',
  '$2b$10$SYJURgeS.Kf/i8XdDCk.JOLsvk4CZjXtbFCW4dNPTJjtLftCmE/0O',
  100.00,
  0.00,
  0,
  0,
  0,
  false
)
ON CONFLICT (username) DO UPDATE 
SET 
  email = EXCLUDED.email,
  display_name = EXCLUDED.display_name,
  password_hash = EXCLUDED.password_hash;
