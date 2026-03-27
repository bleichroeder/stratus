# stratus — Supabase Setup Guide

Complete guide to setting up the Supabase backend from scratch.

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free project
2. Wait for the project to finish provisioning

## 2. Run the Database Setup

1. Go to **SQL Editor** in the Supabase dashboard
2. Paste the entire contents of `supabase/setup.sql` and run it
3. This creates all tables, indexes, triggers, RLS policies, FTS, and storage

If you need to run migrations incrementally on an existing database instead, use the individual files in order:

| File | What it does |
|------|-------------|
| `schema.sql` | Base tables (notes, tags, note_tags), RLS, storage bucket |
| `migration_archive.sql` | Adds `archived_at` column |
| `migration_fts.sql` | Adds FTS function, tsvector column, GIN index, search RPC |
| `migration_sharing.sql` | Adds `shared_token` and `shared_at` columns |
| `migration_vault.sql` | Adds `encrypted` column, recreates FTS to exclude encrypted content |

## 3. Get Your API Keys

Go to **Project Settings > API** and copy:

| Key | Env var | Where used |
|-----|---------|-----------|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` | Client + server |
| `anon` public key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client (RLS-protected) |
| `service_role` secret key | `SUPABASE_SERVICE_ROLE_KEY` | Server only (bypasses RLS, used for /share page) |

## 4. Configure Auth

### Email/Password (default)
Works out of the box. Supabase Auth handles signup, login, and email confirmation.

### Google OAuth (optional)
1. Go to **Authentication > Providers > Google** in Supabase dashboard
2. Enable it and paste your `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
3. Set the redirect URL in your Google Cloud Console to: `https://<your-supabase-url>/auth/v1/callback`

### Auth URL Configuration
1. Go to **Authentication > URL Configuration**
2. Set **Site URL** to your deployment URL (e.g. `https://your-app.vercel.app`)
3. Add **Redirect URLs**: `https://your-app.vercel.app/callback`

## 5. Environment Variables

Copy `.env.local.example` to `.env.local` and fill in values:

```bash
cp .env.local.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com    # optional
GOOGLE_CLIENT_SECRET=xxxxx                            # optional
```

## 6. Deploy to Vercel

1. Push to GitHub
2. Import in [Vercel](https://vercel.com)
3. Add all env vars in Vercel dashboard (Settings > Environment Variables)
4. Deploy

## Database Schema Overview

```
notes
├── id (uuid, PK)
├── user_id (uuid, FK → auth.users, RLS)
├── title (text, default 'Untitled')
├── content (jsonb, Tiptap ProseMirror JSON or encrypted payload)
├── parent_id (uuid, FK → notes.id, nullable — hierarchy)
├── is_folder (boolean)
├── archived_at (timestamptz, nullable — soft delete)
├── shared_token (text, unique, nullable — public sharing)
├── shared_at (timestamptz, nullable — share expiry tracking)
├── encrypted (boolean, default false — vault encryption flag)
├── fts (tsvector, generated — full-text search index)
├── created_at (timestamptz)
└── updated_at (timestamptz, auto-updated by trigger)

tags
├── id (uuid, PK)
├── user_id (uuid, FK)
├── name (text, unique per user)
└── created_at (timestamptz)

note_tags
├── note_id (uuid, FK)
└── tag_id (uuid, FK)

note_collaborators
├── id (uuid, PK)
├── note_id (uuid, FK)
├── user_id (uuid, FK)
├── role ('editor' | 'viewer')
├── invited_by (uuid, FK, nullable)
└── created_at (timestamptz)

storage: note-attachments bucket
└── {user_id}/{uuid}.{ext}
```

## Vault (E2E Encryption)

Vault encryption metadata is stored in Supabase **user_metadata** (per user, not in a table):

```json
{
  "vault_salt": "base64...",
  "vault_wrapped_key": "iv_base64:encrypted_key_base64",
  "vault_version": 1
}
```

- The vault key is AES-256-GCM, wrapped with a PBKDF2-derived key from the user's password
- Encrypted notes store `{"v":1,"iv":"...","ct":"..."}` in the `content` column
- The `encrypted` boolean column flags which notes are encrypted
- FTS excludes encrypted content (only indexes titles for vault notes)

## Troubleshooting

**"relation does not exist" errors**: Run `setup.sql` — a table is missing.

**FTS not working**: The `fts` column is `GENERATED ALWAYS`, so it updates automatically. Check that `extract_text_from_prosemirror` function exists: `SELECT extract_text_from_prosemirror('{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"hello"}]}]}'::jsonb);`

**RLS blocking queries**: Check that your anon key is correct and the user is authenticated. RLS policies require `auth.uid()` to match `user_id`.

**Storage upload fails**: Check that the storage bucket `note-attachments` exists and RLS policies are in place.

**pg_cron not available**: The cron jobs for auto-cleanup are optional. Without them, archived notes and expired share links are cleaned up at read time (the app handles this in code).
