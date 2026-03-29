-- Add context_hint column to notes table
-- Used by templates to store their preferred context suggestion type
-- e.g. {"type": "daily_recent", "days": 1} or {"type": "tagged", "tag_id": "..."}
ALTER TABLE notes ADD COLUMN IF NOT EXISTS context_hint jsonb DEFAULT NULL;
