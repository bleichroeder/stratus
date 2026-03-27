-- ============================================================
-- Collaboration: note_collaborators table, RLS updates, shared storage, FTS update
-- ============================================================

-- 1. Collaborators table
CREATE TABLE public.note_collaborators (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id uuid REFERENCES public.notes(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL DEFAULT 'editor' CHECK (role IN ('editor', 'viewer')),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (note_id, user_id)
);

CREATE INDEX note_collaborators_note_id_idx ON public.note_collaborators(note_id);
CREATE INDEX note_collaborators_user_id_idx ON public.note_collaborators(user_id);
ALTER TABLE public.note_collaborators ENABLE ROW LEVEL SECURITY;

-- 2. Helper function: check if user is a collaborator (SECURITY DEFINER avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.is_collaborator(
  p_note_id uuid,
  p_user_id uuid,
  p_roles text[] DEFAULT ARRAY['editor', 'viewer']
) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.note_collaborators
    WHERE note_id = p_note_id
      AND user_id = p_user_id
      AND role = ANY(p_roles)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 3. note_collaborators RLS policies
CREATE POLICY "Owner and collaborators can view collaborators"
  ON public.note_collaborators FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.notes
      WHERE notes.id = note_collaborators.note_id
        AND notes.user_id = auth.uid()
    )
  );

CREATE POLICY "Note owner can add collaborators"
  ON public.note_collaborators FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.notes
      WHERE notes.id = note_collaborators.note_id
        AND notes.user_id = auth.uid()
    )
  );

CREATE POLICY "Owner or self can remove collaborators"
  ON public.note_collaborators FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.notes
      WHERE notes.id = note_collaborators.note_id
        AND notes.user_id = auth.uid()
    )
  );

CREATE POLICY "Note owner can update roles"
  ON public.note_collaborators FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.notes
      WHERE notes.id = note_collaborators.note_id
        AND notes.user_id = auth.uid()
    )
  );

-- 4. Update notes RLS: add collaborator access to SELECT and UPDATE
DROP POLICY "Users can view their own notes" ON public.notes;
CREATE POLICY "Users can view own and collaborated notes"
  ON public.notes FOR SELECT
  USING (auth.uid() = user_id OR public.is_collaborator(id, auth.uid()));

DROP POLICY "Users can update their own notes" ON public.notes;
CREATE POLICY "Users can update own notes or notes where editor"
  ON public.notes FOR UPDATE
  USING (auth.uid() = user_id OR public.is_collaborator(id, auth.uid(), ARRAY['editor']));

-- INSERT and DELETE policies remain owner-only (unchanged)

-- 5. Update note_tags RLS for collaborator access
DROP POLICY "Users can view their own note tags" ON public.note_tags;
CREATE POLICY "Users can view note tags for accessible notes"
  ON public.note_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.notes
      WHERE notes.id = note_tags.note_id
        AND (notes.user_id = auth.uid() OR public.is_collaborator(notes.id, auth.uid()))
    )
  );

DROP POLICY "Users can manage their own note tags" ON public.note_tags;
CREATE POLICY "Users can manage note tags for editable notes"
  ON public.note_tags FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.notes
      WHERE notes.id = note_tags.note_id
        AND (notes.user_id = auth.uid() OR public.is_collaborator(notes.id, auth.uid(), ARRAY['editor']))
    )
  );

DROP POLICY "Users can remove their own note tags" ON public.note_tags;
CREATE POLICY "Users can remove note tags for editable notes"
  ON public.note_tags FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.notes
      WHERE notes.id = note_tags.note_id
        AND (notes.user_id = auth.uid() OR public.is_collaborator(notes.id, auth.uid(), ARRAY['editor']))
    )
  );

-- 6. Shared storage policies for collaborative note attachments
-- Path format: shared/{note_id}/{filename}
CREATE POLICY "Collaborators can upload shared attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'note-attachments'
    AND (storage.foldername(name))[1] = 'shared'
    AND (
      EXISTS (
        SELECT 1 FROM public.notes
        WHERE notes.id = ((storage.foldername(name))[2])::uuid
          AND notes.user_id = auth.uid()
      )
      OR public.is_collaborator(
        ((storage.foldername(name))[2])::uuid,
        auth.uid(),
        ARRAY['editor']
      )
    )
  );

CREATE POLICY "Collaborators can view shared attachments"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'note-attachments'
    AND (storage.foldername(name))[1] = 'shared'
    AND (
      EXISTS (
        SELECT 1 FROM public.notes
        WHERE notes.id = ((storage.foldername(name))[2])::uuid
          AND notes.user_id = auth.uid()
      )
      OR public.is_collaborator(
        ((storage.foldername(name))[2])::uuid,
        auth.uid()
      )
    )
  );

-- 7. User lookup by email (for invite flow, SECURITY DEFINER to access auth.users)
CREATE OR REPLACE FUNCTION public.lookup_user_by_email(p_email text)
RETURNS TABLE (id uuid, email text) AS $$
  SELECT u.id, u.email::text
  FROM auth.users u
  WHERE u.email = lower(p_email)
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 8. Update search_notes RPC to include collaborator notes
CREATE OR REPLACE FUNCTION search_notes(p_query text, p_limit int DEFAULT 20)
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
    n.id, n.user_id, n.title, n.content, n.parent_id, n.is_folder, n.archived_at,
    n.created_at, n.updated_at,
    ts_headline('english',
      coalesce(n.title, '') || ' ' || coalesce(extract_text_from_prosemirror(n.content), ''),
      tsquery_val,
      'StartSel=<mark>, StopSel=</mark>, MaxWords=30, MinWords=10'
    ) AS headline,
    ts_rank(n.fts, tsquery_val) AS rank
  FROM public.notes n
  WHERE (n.user_id = auth.uid() OR public.is_collaborator(n.id, auth.uid()))
    AND n.archived_at IS NULL
    AND n.is_folder = false
    AND n.fts @@ tsquery_val
  ORDER BY rank DESC, n.updated_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
