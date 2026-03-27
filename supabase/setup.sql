-- =============================================================================
-- stratus — Complete Database Setup Script
-- =============================================================================
-- Run this entire file in the Supabase SQL Editor to set up a fresh project.
-- Safe to run on an empty database. NOT safe to run on an existing database
-- with data (use the individual migration files for incremental changes).
--
-- Last updated: 2026-03-27
-- =============================================================================


-- =============================================================================
-- 1. TABLES
-- =============================================================================

-- Notes (hierarchical: folders + notes via parent_id)
CREATE TABLE public.notes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL DEFAULT auth.uid(),
  title text NOT NULL DEFAULT 'Untitled',
  content jsonb,
  parent_id uuid REFERENCES public.notes(id) ON DELETE SET NULL,
  is_folder boolean NOT NULL DEFAULT false,
  archived_at timestamptz DEFAULT NULL,
  shared_token text UNIQUE DEFAULT NULL,
  shared_at timestamptz DEFAULT NULL,
  encrypted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tags
CREATE TABLE public.tags (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

-- Note-Tag join table
CREATE TABLE public.note_tags (
  note_id uuid REFERENCES public.notes(id) ON DELETE CASCADE NOT NULL,
  tag_id uuid REFERENCES public.tags(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (note_id, tag_id)
);

-- Note collaborators
CREATE TABLE public.note_collaborators (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id uuid REFERENCES public.notes(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL DEFAULT 'editor' CHECK (role IN ('editor', 'viewer')),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (note_id, user_id)
);


-- =============================================================================
-- 2. INDEXES
-- =============================================================================

CREATE INDEX notes_user_id_idx ON public.notes(user_id);
CREATE INDEX notes_parent_id_idx ON public.notes(parent_id);
CREATE INDEX notes_archived_at_idx ON public.notes(archived_at);
CREATE INDEX notes_shared_token_idx ON public.notes(shared_token) WHERE shared_token IS NOT NULL;
CREATE INDEX notes_encrypted_idx ON public.notes(encrypted) WHERE encrypted = true;
CREATE INDEX tags_user_id_idx ON public.tags(user_id);
CREATE INDEX note_collaborators_note_id_idx ON public.note_collaborators(note_id);
CREATE INDEX note_collaborators_user_id_idx ON public.note_collaborators(user_id);


-- =============================================================================
-- 3. TRIGGERS
-- =============================================================================

-- Auto-update updated_at on notes
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- =============================================================================
-- 4. FULL-TEXT SEARCH
-- =============================================================================

-- Extract text from ProseMirror/Tiptap JSON for indexing
CREATE OR REPLACE FUNCTION extract_text_from_prosemirror(content jsonb)
RETURNS text AS $$
DECLARE
  result text := '';
  node jsonb;
BEGIN
  IF content IS NULL THEN RETURN ''; END IF;

  IF jsonb_typeof(content) = 'array' THEN
    FOR node IN SELECT jsonb_array_elements(content) LOOP
      result := result || extract_text_from_prosemirror(node) || ' ';
    END LOOP;
  ELSIF jsonb_typeof(content) = 'object' THEN
    IF content ? 'text' THEN
      result := result || (content->>'text') || ' ';
    END IF;
    IF content ? 'content' THEN
      result := result || extract_text_from_prosemirror(content->'content') || ' ';
    END IF;
  END IF;

  RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Generated tsvector column (encrypted notes only index title, not ciphertext)
ALTER TABLE public.notes ADD COLUMN fts tsvector GENERATED ALWAYS AS (
  to_tsvector('english',
    coalesce(title, '') || ' ' ||
    CASE WHEN encrypted THEN '' ELSE coalesce(extract_text_from_prosemirror(content), '') END
  )
) STORED;

CREATE INDEX notes_fts_gin_idx ON public.notes USING gin(fts);

-- Search RPC with ranking and headline snippets
CREATE OR REPLACE FUNCTION search_notes(
  p_query text,
  p_limit int DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  title text,
  content jsonb,
  parent_id uuid,
  is_folder boolean,
  archived_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  headline text,
  rank real
) AS $$
DECLARE
  tsquery_val tsquery;
BEGIN
  tsquery_val := to_tsquery('english',
    array_to_string(
      array(
        SELECT trim(word) || ':*'
        FROM unnest(string_to_array(trim(p_query), ' ')) AS word
        WHERE trim(word) != ''
      ),
      ' & '
    )
  );

  RETURN QUERY
  SELECT
    n.id,
    n.user_id,
    n.title,
    n.content,
    n.parent_id,
    n.is_folder,
    n.archived_at,
    n.created_at,
    n.updated_at,
    ts_headline('english',
      coalesce(n.title, '') || ' ' || coalesce(extract_text_from_prosemirror(n.content), ''),
      tsquery_val,
      'StartSel=<mark>, StopSel=</mark>, MaxWords=30, MinWords=10'
    ) AS headline,
    ts_rank(n.fts, tsquery_val) AS rank
  FROM public.notes n
  WHERE n.user_id = auth.uid()
    AND n.archived_at IS NULL
    AND n.is_folder = false
    AND n.fts @@ tsquery_val
  ORDER BY rank DESC, n.updated_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================================================
-- 5. ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_collaborators ENABLE ROW LEVEL SECURITY;

-- Notes policies
CREATE POLICY "Users can view their own notes"
  ON public.notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own notes"
  ON public.notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes"
  ON public.notes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes"
  ON public.notes FOR DELETE
  USING (auth.uid() = user_id);

-- Tags policies
CREATE POLICY "Users can view their own tags"
  ON public.tags FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tags"
  ON public.tags FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tags"
  ON public.tags FOR DELETE
  USING (auth.uid() = user_id);

-- Note_tags policies
CREATE POLICY "Users can view their own note tags"
  ON public.note_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.notes
      WHERE notes.id = note_tags.note_id
      AND notes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their own note tags"
  ON public.note_tags FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.notes
      WHERE notes.id = note_tags.note_id
      AND notes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can remove their own note tags"
  ON public.note_tags FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.notes
      WHERE notes.id = note_tags.note_id
      AND notes.user_id = auth.uid()
    )
  );

-- Note collaborators policies
CREATE POLICY "Note owners can manage collaborators"
  ON public.note_collaborators FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.notes
      WHERE notes.id = note_collaborators.note_id
      AND notes.user_id = auth.uid()
    )
  );

CREATE POLICY "Collaborators can view their own records"
  ON public.note_collaborators FOR SELECT
  USING (auth.uid() = user_id);


-- =============================================================================
-- 6. STORAGE
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('note-attachments', 'note-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload their own attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'note-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can view their own attachments"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'note-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete their own attachments"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'note-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


-- =============================================================================
-- 7. OPTIONAL: CRON JOBS (requires pg_cron — may not be available on free tier)
-- =============================================================================
-- Uncomment the following if pg_cron is available:

-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Hard-delete notes archived more than 7 days ago
-- SELECT cron.schedule(
--   'cleanup-archived-notes',
--   '0 3 * * *',
--   $$DELETE FROM public.notes WHERE archived_at IS NOT NULL AND archived_at < now() - interval '7 days'$$
-- );

-- Clear expired share links (older than 7 days)
-- SELECT cron.schedule(
--   'cleanup-expired-shares',
--   '0 4 * * *',
--   $$UPDATE public.notes SET shared_token = NULL, shared_at = NULL WHERE shared_at IS NOT NULL AND shared_at < now() - interval '7 days'$$
-- );
