-- Enable Supabase Realtime on the notes table
-- Required for live UI updates when notes are created/updated/deleted externally (e.g. via MCP)
alter publication supabase_realtime add table notes;
