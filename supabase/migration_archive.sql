-- Add archived_at column
alter table public.notes add column archived_at timestamptz default null;

-- Index for efficient filtering
create index notes_archived_at_idx on public.notes(archived_at);

-- Enable pg_cron extension (available on Supabase free tier)
create extension if not exists pg_cron;

-- Schedule daily cleanup: hard-delete notes archived more than 7 days ago
select cron.schedule(
  'cleanup-archived-notes',
  '0 3 * * *', -- 3 AM UTC daily
  $$delete from public.notes where archived_at is not null and archived_at < now() - interval '7 days'$$
);
