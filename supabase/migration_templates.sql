-- ============================================================
-- Templates: add is_template column to notes table
-- ============================================================

-- 1. Add is_template column
ALTER TABLE public.notes ADD COLUMN is_template boolean NOT NULL DEFAULT false;

-- 2. Index for efficient template queries
CREATE INDEX notes_is_template_idx ON public.notes(is_template) WHERE is_template = true;
