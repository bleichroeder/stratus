-- Track when a user last viewed a note (for unseen indicators)
-- Syncs across devices via Supabase Realtime
create table if not exists public.note_views (
  user_id uuid not null references auth.users(id) on delete cascade,
  note_id uuid not null references public.notes(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (user_id, note_id)
);

-- RLS: users can only see/manage their own views
alter table public.note_views enable row level security;

create policy "Users can read own views"
  on public.note_views for select
  using (auth.uid() = user_id);

create policy "Users can upsert own views"
  on public.note_views for insert
  with check (auth.uid() = user_id);

create policy "Users can update own views"
  on public.note_views for update
  using (auth.uid() = user_id);

-- Enable realtime so view status syncs across devices
alter publication supabase_realtime add table note_views;

-- Index for fast lookups
create index if not exists idx_note_views_user on public.note_views (user_id);
