# Noat Desktop

A minimalist, translucent note-taking app for macOS. Built with Tauri, React, and SQLite with realtime Supabase sync.

## Features

- Multiple notes with horizontal swipe navigation
- 5 color themes (paper, forest, ios, dark, cyberpunk)
- Translucent window mode
- Debounced autosave to local SQLite
- Realtime cloud sync via Supabase
- Global shortcut (Option+/) to toggle visibility
- Dock-less (accessory app on macOS)

## Tech stack

- **Frontend**: React 19, TypeScript, Vite
- **Backend**: Tauri 2 (Rust)
- **Storage**: SQLite via `@tauri-apps/plugin-sql`
- **Sync**: Supabase Realtime + REST

## Development

```bash
npm install
npm run tauri dev
```

## Build

```bash
npm run tauri build
```
