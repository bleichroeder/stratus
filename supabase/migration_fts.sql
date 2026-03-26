-- 1. Recursive function to extract text from ProseMirror/Tiptap JSON
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

-- 2. Add generated tsvector column for full-text search
ALTER TABLE public.notes
ADD COLUMN fts tsvector GENERATED ALWAYS AS (
  to_tsvector('english',
    coalesce(title, '') || ' ' ||
    coalesce(extract_text_from_prosemirror(content), '')
  )
) STORED;

-- 3. GIN index for fast FTS queries
CREATE INDEX notes_fts_gin_idx ON public.notes USING gin(fts);

-- 4. Search RPC function with ranking and headline snippets
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
  -- Build tsquery: split words, add prefix matching, join with &
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
