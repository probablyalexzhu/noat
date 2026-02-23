# Noat Desktop — Engineering Standards

## Project overview

Noat Desktop is the Tauri (Rust + React + Vite) desktop client for Noat, a minimalist note-taking app. Notes are stored locally in SQLite via `@tauri-apps/plugin-sql` and synced to Supabase via realtime subscriptions and batch push/pull. The app supports multiple notes (horizontal scroll-snap), per-note color themes, and debounced autosave.

## Directory layout

```
src/
  main.tsx              React entry point
  App.tsx               Root orchestration — state, CRUD, scroll logic
  App.css               Global styles (resets, scrollbars, textarea)
  vite-env.d.ts         Vite type reference
  components/
    NotePage.tsx         Single note editor (textarea)
    NoteControls.tsx     Overlay positioning for HeaderBar + ThemePicker
    HeaderBar.tsx        Dot pagination, delete/add buttons
    ThemePicker.tsx      Expandable theme selector with translucency toggle
  hooks/
    useAutosave.ts       Debounced per-note autosave to SQLite
    useRealtimeSync.ts   Realtime subscription + push debounce lifecycle
  lib/
    database.ts          SQLite schema, CRUD, waitForDatabase, upsertNoteFromRemote
    sync.ts              Full push/pull with Supabase
    realtime.ts          Realtime postgres_changes subscription
    theme.ts             Color palettes, hex utilities
    utils.ts             Shared helpers (getTimestamp)
src-tauri/
  src/lib.rs             Tauri app setup — plugins, global shortcut, macOS mouse monitor
  src/main.rs            Rust entry point
  Cargo.toml             Rust dependencies
```

## Architecture

`App.tsx` is the orchestration layer: it owns note IDs, active index, theme map, and content caches. It delegates:

- **Persistence** to `useAutosave` (local SQLite debounce) and `useRealtimeSync` (cloud push/pull)
- **UI** to presentational components (`NotePage`, `NoteControls`, `HeaderBar`, `ThemePicker`)
- **Data access** to `lib/` modules (`database.ts`, `sync.ts`, `realtime.ts`)

Sync architecture:

- **Pull**: Realtime `postgres_changes` subscription delivers remote changes in <100ms
- **Push**: Event-driven debounce — `useAutosave` saves locally at 300ms, then `useRealtimeSync` pushes at 1.5s after last save

## Code style

- TypeScript `strict: true`, `noUnusedLocals`, `noUnusedParameters`
- Prettier: single quotes, trailing commas, 100 char line width, 2-space indent
- Path alias `@/*` maps to `src/*`
- Constants: `UPPER_SNAKE_CASE` at module top
- File headers: JSDoc block comment on every file explaining purpose

## Commands

- `npm run dev` — Vite dev server (port 1420)
- `npm run build` — TypeScript + Vite production build
- `npm run lint` — ESLint check
- `npm run format` — Prettier auto-format
- `npm run typecheck` — type-check (tsc --noEmit)
- `cargo check` — type-check Rust (run from `src-tauri/`)
- `npm run tauri dev` — full Tauri dev mode (Rust + Vite)
