# stratus

A developer-focused note-taking tool. Fast, minimal, and powerful.

## Features

- **Rich text editor** — Headings, lists, task lists, code blocks with syntax highlighting, images, blockquotes
- **Slash commands** — Type `/` to insert blocks without leaving the keyboard
- **Wiki links** — Type `[[` to link notes together and build a knowledge graph
- **Backlinks** — See which notes reference the current one
- **Command palette** — `Ctrl+K` to search notes, run actions, switch themes
- **Full-text search** — Searches across all note content, not just titles
- **Sketch pad** — Freehand drawing canvas with pen, eraser, colors, and pressure sensitivity
- **Tabs** — Multiple notes open at once, right-click for close/close others/close all
- **Folders & drag-drop** — Nested folder organization, rearrange by dragging
- **Daily notes** — One-click journal entries organized by date
- **Archive** — Soft delete with 7-day auto-cleanup
- **Public sharing** — Expiring read-only links for any note
- **Dark mode** — System-aware with manual toggle
- **Mobile responsive** — Drawer layout for phones and tablets
- **Multi-select** — `Ctrl+click` to select multiple notes for bulk archive

## Stack

- [Next.js](https://nextjs.org) — App Router, server components
- [Supabase](https://supabase.com) — Auth, Postgres, Storage
- [Tiptap](https://tiptap.dev) — Rich text editor
- [Tailwind CSS](https://tailwindcss.com) v4
- [perfect-freehand](https://github.com/steveruizok/perfect-freehand) — Sketch pad

## Setup

### 1. Install

```bash
npm install
```

### 2. Supabase

Create a free project at [supabase.com](https://supabase.com). Run the SQL files in order in the SQL Editor:

1. `supabase/schema.sql`
2. `supabase/migration_archive.sql`
3. `supabase/migration_fts.sql`
4. `supabase/migration_sharing.sql`

### 3. Environment

```bash
cp .env.local.example .env.local
```

Fill in your values from Supabase Project Settings > API.

### 4. Run

```bash
npm run dev
```

## Deploy

Push to GitHub, import in [Vercel](https://vercel.com), add the three env vars, deploy.

## License

MIT
