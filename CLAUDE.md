# Noat — Engineering Standards

## Project overview

Noat is a minimalist note-taking app built with React Native (Expo). Notes are stored locally in SQLite via expo-sqlite and realtime cloud sync via Supabase Realtime. The app supports multiple notes (swipeable via FlatList), per-note color themes, markdown editing, and debounced autosave.

## Directory layout

```
app/          Expo Router screens — index.tsx is the main (and only) screen
components/   React components — presentational where possible
hooks/        Custom React hooks — encapsulate side effects and stateful logic
lib/          Non-React utilities — database access, theme definitions, markdown styles
assets/       Static assets (images, icons)
```

## Architecture patterns

**Separation of concerns.** The main screen (`app/index.tsx`) is an orchestration layer: it owns core state and CRUD handlers, delegates side effects to hooks, and delegates UI chrome to components.

- **Hooks** (`hooks/`) encapsulate stateful logic with side effects (timers, listeners, keyboard events). Each hook has a clear single responsibility and a documented interface.
- **Components** (`components/`) are presentational where possible — they receive props and render UI. Stateful components (like `NotePage`) keep state minimal and local.
- **Lib** (`lib/`) contains pure utilities with no React dependencies (database, theme palettes, markdown styles).

**Comment blocks for subtle interactions.** When code involves non-obvious coordination between multiple files or mechanisms (e.g., the keyboard/swipe interaction between `useKeyboardNavigation`, the FlatList, and `NotePage`), add a block comment explaining:

- What problem it solves
- How the pieces coordinate
- Cross-references to related files

Don't add comments for self-explanatory code. Only comment the "why", not the "what".

## Code Style

- TypeScript with `strict: true`
- Prettier: single quotes, trailing commas, 100 char line width, 2-space indent
- ESLint: expo config + prettier plugin
- Run `npm run lint` to check and `npm run format` to auto-format
- Path alias `@/*` maps to the project root

## Bug Fixing Guidelines

When fixing UI bugs (especially keyboard/focus/animation issues), try the simplest possible approach first. Do NOT layer complex workarounds (pointerEvents manipulation, delayed refs, event suppression hacks). If the first simple fix doesn't work, step back and question the overall approach before adding complexity.

When a fix introduces a regression (text disappearing, animations breaking, layout shifting), immediately revert the change rather than trying to patch the regression on top of it. Propose a cleaner alternative approach.

## Commands

- `npm run lint` — ESLint check
- `npm run format` — Prettier auto-format
- `npx tsc --noEmit` — type-check (ignore errors from `old-app-example/`)
- `npx expo start` — start dev server
