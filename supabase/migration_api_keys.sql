-- API Keys table for MCP server authentication
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  key_hash text not null,
  key_prefix text not null,
  scopes text[] not null default '{}',
  last_used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz default now(),
  revoked_at timestamptz
);

-- Fast lookup by prefix for non-revoked keys
create index idx_api_keys_prefix on public.api_keys(key_prefix) where revoked_at is null;

-- RLS: users can only manage their own keys
alter table public.api_keys enable row level security;

create policy "Users manage own keys"
  on public.api_keys for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
