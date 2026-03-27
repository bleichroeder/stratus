-- Add encrypted flag to notes
ALTER TABLE public.notes ADD COLUMN encrypted boolean NOT NULL DEFAULT false;
CREATE INDEX notes_encrypted_idx ON public.notes(encrypted) WHERE encrypted = true;

-- Recreate FTS column: encrypted notes only index title, not ciphertext
ALTER TABLE public.notes DROP COLUMN fts;
ALTER TABLE public.notes ADD COLUMN fts tsvector GENERATED ALWAYS AS (
  to_tsvector('english',
    coalesce(title, '') || ' ' ||
    CASE WHEN encrypted THEN '' ELSE coalesce(extract_text_from_prosemirror(content), '') END
  )
) STORED;
CREATE INDEX notes_fts_gin_idx ON public.notes USING gin(fts);
