-- Notes table
create table public.notes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null default auth.uid(),
  title text not null default 'Untitled',
  content jsonb,
  parent_id uuid references public.notes(id) on delete set null,
  is_folder boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tags table
create table public.tags (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null default auth.uid(),
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- Note-Tag join table
create table public.note_tags (
  note_id uuid references public.notes(id) on delete cascade not null,
  tag_id uuid references public.tags(id) on delete cascade not null,
  primary key (note_id, tag_id)
);

-- Indexes
create index notes_user_id_idx on public.notes(user_id);
create index notes_parent_id_idx on public.notes(parent_id);
create index tags_user_id_idx on public.tags(user_id);

-- Updated_at trigger
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger notes_updated_at
  before update on public.notes
  for each row execute function public.handle_updated_at();

-- Row Level Security
alter table public.notes enable row level security;
alter table public.tags enable row level security;
alter table public.note_tags enable row level security;

-- Notes policies
create policy "Users can view their own notes"
  on public.notes for select
  using (auth.uid() = user_id);

create policy "Users can create their own notes"
  on public.notes for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own notes"
  on public.notes for update
  using (auth.uid() = user_id);

create policy "Users can delete their own notes"
  on public.notes for delete
  using (auth.uid() = user_id);

-- Tags policies
create policy "Users can view their own tags"
  on public.tags for select
  using (auth.uid() = user_id);

create policy "Users can create their own tags"
  on public.tags for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own tags"
  on public.tags for delete
  using (auth.uid() = user_id);

-- Note_tags policies
create policy "Users can view their own note tags"
  on public.note_tags for select
  using (
    exists (
      select 1 from public.notes
      where notes.id = note_tags.note_id
      and notes.user_id = auth.uid()
    )
  );

create policy "Users can manage their own note tags"
  on public.note_tags for insert
  with check (
    exists (
      select 1 from public.notes
      where notes.id = note_tags.note_id
      and notes.user_id = auth.uid()
    )
  );

create policy "Users can remove their own note tags"
  on public.note_tags for delete
  using (
    exists (
      select 1 from public.notes
      where notes.id = note_tags.note_id
      and notes.user_id = auth.uid()
    )
  );

-- Storage bucket for note attachments
insert into storage.buckets (id, name, public)
values ('note-attachments', 'note-attachments', false);

-- Storage policies
create policy "Users can upload their own attachments"
  on storage.objects for insert
  with check (
    bucket_id = 'note-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can view their own attachments"
  on storage.objects for select
  using (
    bucket_id = 'note-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own attachments"
  on storage.objects for delete
  using (
    bucket_id = 'note-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
