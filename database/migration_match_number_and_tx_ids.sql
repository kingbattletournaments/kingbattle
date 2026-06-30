-- Match display numbers (0000, 0001, … 9999, 10000, …)
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS match_number INTEGER UNIQUE;

-- Sequences default to MINVALUE 1; allow 0-based numbering for first match (0000)
DROP SEQUENCE IF EXISTS public.match_number_seq;
CREATE SEQUENCE public.match_number_seq
  AS integer
  START WITH 0
  INCREMENT BY 1
  MINVALUE 0
  NO MAXVALUE
  CACHE 1;

-- Backfill existing matches in creation order
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC NULLS LAST, id ASC) - 1 AS num
  FROM public.matches
  WHERE match_number IS NULL
)
UPDATE public.matches m
SET match_number = numbered.num
FROM numbered
WHERE m.id = numbered.id;

SELECT setval(
  'match_number_seq',
  GREATEST(COALESCE((SELECT MAX(match_number) FROM public.matches), -1) + 1, 0),
  false
);

-- Coin transactions: allow custom 10-char alphanumeric ids (existing UUID rows stay as text)
ALTER TABLE public.app_coin_transactions ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.app_coin_transactions ALTER COLUMN id TYPE TEXT USING id::text;
