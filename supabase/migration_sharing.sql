-- Add shared_token column for public sharing
ALTER TABLE public.notes ADD COLUMN shared_token text UNIQUE DEFAULT NULL;

-- Partial index for efficient lookups
CREATE INDEX notes_shared_token_idx ON public.notes(shared_token) WHERE shared_token IS NOT NULL;
